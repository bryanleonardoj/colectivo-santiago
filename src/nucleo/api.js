/**
 * api.js — capa de acceso a datos.
 *
 * Es la ÚNICA pieza que las vistas usan para leer o escribir información.
 * Hoy resuelve todo en memoria; mañana hará `fetch` a un servicio REST y
 * escuchará Firestore. Como la firma de cada función no cambia, migrar a
 * producción no obliga a tocar ninguna vista.
 *
 * Modelo de datos que refleja:
 *   Relacional  → lineas, vehiculos, conductores, viajes, pagos
 *   No relacional → posiciones, estado_asientos, avisos
 */
import { CONFIG } from '../config.js';
import { store } from './store.js';
import { LINEAS, VEHICULOS, MI_VEHICULO, linea, cargarRecorridos } from '../datos/lineas.js';
import { puntoEnRecorrido, distanciaSobreRecorrido } from './geo.js';
import { hhmm, acotar } from './util.js';

/* ---------- consultas ---------- */

export const obtenerLineas = () => LINEAS;
export const obtenerLinea = (id) => linea(id);
export const miVehiculo = () => VEHICULOS.find((v) => v.id === MI_VEHICULO);

/**
 * Pide a OSRM la geometría real de los recorridos.
 * Se reexporta acá para que las páginas nunca importen `datos/` directamente.
 */
export const cargarGeometrias = () =>
  cargarRecorridos().then((lineas) => lineas.map((l) => ({ ...l, recorrido: [...l.recorrido] })));

/**
 * Avance del vehículo sobre su recorrido en el instante `ahora`.
 *
 * Es una función pura: mismos argumentos, mismo resultado. El vehículo hace
 * ida y vuelta, así que se usa una onda triangular sobre el ciclo 0→2.
 * Al no guardar estado, dos pestañas abiertas coinciden sin sincronizarse.
 */
function avance(vehiculo, ahora) {
  const l = linea(vehiculo.linea);
  const vueltasPorMs = vehiculo.velocidad / (l.medida.total * 90_000);
  const ciclo = (vehiculo.fase + ahora * vueltasPorMs) % 2;
  return ciclo <= 1 ? ciclo : 2 - ciclo;   // ida y regreso
}

/** Posición geográfica actual de un vehículo. */
export function posicionDe(vehiculo, ahora = Date.now()) {
  return puntoEnRecorrido(linea(vehiculo.linea), avance(vehiculo, ahora));
}

/**
 * Vehículos visibles para el pasajero.
 * Solo aparecen los que tienen turno activo: es la restricción de privacidad
 * comprometida en el informe (medida S4).
 */
export function vehiculosActivos(idLinea = 'todas') {
  const e = store.get();
  return VEHICULOS
    .filter((v) => e.turnos[v.id])
    .filter((v) => idLinea === 'todas' || v.linea === idLinea)
    .map((v) => ({
      ...v,
      asientosLibres: e.asientos[v.id] ?? 0,
      maletero: e.maleteros[v.id] ?? 'no',
      posicion: posicionDe(v),
    }));
}

/** Minutos que le toma a un vehículo llegar a un punto por su recorrido. */
export function etaHasta(vehiculo, punto) {
  const km = distanciaSobreRecorrido(linea(vehiculo.linea), vehiculo.posicion, punto);
  return Math.max(1, Math.round((km / CONFIG.VELOCIDAD_COMERCIAL_KMH) * 60));
}

/** Nivel numérico de un tamaño de maletero, para poder compararlos. */
export const nivelMaletero = (clave) => CONFIG.MALETERO[clave]?.nivel ?? 0;

/**
 * ¿Este vehículo puede tomar esta necesidad?
 *
 * Es la regla central del sistema y son dos condiciones. Los asientos tienen
 * que alcanzar para todo el grupo, y el maletero del vehículo tiene que dar
 * para lo que el pasajero necesita guardar.
 *
 * Lo segundo es una comparación de tamaño, no de tipo: la silla de ruedas es
 * del pasajero y viaja plegada en el maletero, así que un maletero donde cabe
 * una silla acepta también una maleta. Por eso basta con que el nivel del
 * vehículo sea mayor o igual al de la solicitud.
 *
 * Ningún conductor queda comprometido: si baja lo que ofrece, deja de calificar
 * y esas solicitudes dejan de aparecerle.
 */
export function puedeTomar(vehiculo, { personas = 1, maletero = 'no' } = {}) {
  if (vehiculo.asientosLibres < personas) return false;
  return nivelMaletero(vehiculo.maletero) >= nivelMaletero(maletero);
}

/**
 * Vehículos ordenados por cercanía a un punto, con su tiempo de llegada.
 * `necesidad` filtra a los que de verdad pueden parar por este pasajero.
 */
export function vehiculosCercanos(punto, idLinea = 'todas', necesidad = {}, limite = 6) {
  return vehiculosActivos(idLinea)
    .map((v) => ({ ...v, eta: etaHasta(v, punto), apto: puedeTomar(v, necesidad) }))
    // Los que no pueden tomar a este pasajero se muestran igual, para que no
    // parezca que la línea está muerta, pero van al final: de nada sirve
    // encabezar la lista con el que llega en dos minutos y no va a parar.
    .sort((a, b) => (a.apto === b.apto ? a.eta - b.eta : a.apto ? -1 : 1))
    .slice(0, limite);
}

/* ---------- solicitudes de cupo ---------- */

/**
 * Solicitudes que siguen en pie.
 *
 * Nadie espera media hora en la esquina, así que una solicitud caduca sola.
 * Se filtran al leer en vez de borrarlas con un temporizador: así el cálculo
 * es una función pura del reloj, igual que la posición de los vehículos.
 */
export function solicitudesVigentes(ahora = Date.now()) {
  return store.get().solicitudes.filter((s) => ahora - s.creada < CONFIG.SOLICITUD_VIGENTE_MS);
}

/**
 * Solicitudes que este conductor puede tomar.
 *
 * Esta es la idea central: una solicitud NO se dibuja en el mapa de un
 * conductor que no puede atenderla. El que hoy lleva el maletero ocupado baja
 * lo que ofrece y esas solicitudes dejan de existir para él — no tiene que
 * rechazar a nadie, y el pasajero nunca ve un rechazo.
 */
export function solicitudesPara(idVehiculo) {
  const vehiculo = vehiculosActivos().find((v) => v.id === idVehiculo);
  if (!vehiculo) return [];
  return solicitudesVigentes()
    .filter((s) => s.linea === 'todas' || s.linea === vehiculo.linea)
    .filter((s) => puedeTomar(vehiculo, s))
    .map((s) => ({ ...s, eta: etaHasta(vehiculo, s.punto) }))
    .sort((a, b) => a.eta - b.eta);
}

/**
 * Vehículo que en este momento viene en camino por una solicitud: el apto más
 * cercano que ya esté dentro de la ventana de aviso.
 *
 * No hay aceptación de por medio. El conductor no toca nada, solo maneja; el
 * sistema le muestra su patente al pasajero cuando ese vehículo es el que
 * viene llegando. Devuelve `null` mientras nadie esté lo bastante cerca.
 */
export function vehiculoEnCamino(solicitud) {
  const candidatos = vehiculosActivos(solicitud.linea)
    .filter((v) => puedeTomar(v, solicitud))
    .map((v) => ({ ...v, eta: etaHasta(v, solicitud.punto) }))
    .sort((a, b) => a.eta - b.eta);
  const primero = candidatos[0];
  return primero && primero.eta <= CONFIG.REVELAR_PATENTE_MIN ? primero : null;
}

/** Cuántos vehículos en servicio podrían tomar una solicitud así. */
export const aptosPara = (necesidad, idLinea = 'todas') =>
  vehiculosActivos(idLinea).filter((v) => puedeTomar(v, necesidad)).length;

/** Estado completo de la flota, para la vista de administración. */
export function flota() {
  const e = store.get();
  return VEHICULOS.map((v) => ({
    ...v,
    enTurno: !!e.turnos[v.id],
    asientosLibres: e.asientos[v.id] ?? 0,
    maletero: e.maleteros[v.id] ?? 'no',
  }));
}

/** Indicadores agregados. La administración nunca ve posiciones individuales. */
export function indicadores() {
  const e = store.get();
  const activos = VEHICULOS.filter((v) => e.turnos[v.id]);
  const capacidad = activos.reduce((a, v) => a + v.asientosTotal, 0);
  const libres = activos.reduce((a, v) => a + (e.asientos[v.id] ?? 0), 0);
  const pendientes = solicitudesVigentes();
  return {
    enTurno: activos.length,
    total: VEHICULOS.length,
    ocupacion: capacidad ? Math.round(((capacidad - libres) / capacidad) * 100) : 0,
    pagos: e.pagos.length,
    recaudado: e.pagos.reduce((a, p) => a + p.monto, 0),
    solicitudes: pendientes.length,
    // Solicitudes que ningún vehículo en servicio puede tomar. Es la demanda
    // que la asociación está dejando pasar, y el único número de este panel
    // sobre el que la dirigencia puede actuar.
    sinCobertura: pendientes.filter((s) => aptosPara(s, s.linea) === 0).length,
    // Vehículos en servicio cuyo maletero da para guardar una silla de ruedas.
    conEspacioSilla: activos.filter((v) => nivelMaletero(e.maleteros[v.id]) >= 2).length,
  };
}

export const avisos = () => store.get().avisos;
export const avisosPara = (idLinea) =>
  store.get().avisos.filter((a) => a.destino === 'todas' || a.destino === idLinea);
export const avisosSinLeer = () => store.get().avisos.filter((a) => !a.leido).length;
export const pagosDe = (patente) => store.get().pagos.filter((p) => p.patente === patente);

/* ---------- comandos ---------- */

/** Abre o cierra el turno de un vehículo (RF-05). */
export function fijarTurno(idVehiculo, activo) {
  store.set((e) => { e.turnos[idVehiculo] = !!activo; });
}

/**
 * Declara qué da el maletero del vehículo: nada, equipaje voluminoso o una
 * silla de ruedas plegada.
 *
 * Es reversible en cualquier momento del día y a propósito no pide ningún
 * compromiso: prestar el maletero es un plus, no parte del servicio. Bajarlo
 * solo hace que esas solicitudes dejen de aparecerle a este conductor.
 */
export function fijarMaletero(idVehiculo, clave) {
  const valido = CONFIG.MALETERO[clave] ? clave : 'no';
  store.set((e) => { e.maleteros[idVehiculo] = valido; });
}

/**
 * El pasajero pide cupo (RF-02).
 * Solo puede haber una solicitud viva por persona: pedir de nuevo reemplaza
 * la anterior en vez de sembrar el mapa de puntos repetidos.
 */
export function pedirCupo({ punto, personas = 1, maletero = 'no', linea = 'todas' }) {
  const solicitud = {
    id: `s${Date.now()}`,
    punto,
    personas: acotar(Number(personas) || 1, 1, CONFIG.ASIENTOS_POR_VEHICULO),
    // Qué necesita guardar en el maletero: nada, equipaje o su silla de ruedas.
    maletero: CONFIG.MALETERO[maletero] ? maletero : 'no',
    linea,
    creada: Date.now(),
  };
  store.set((e) => { e.solicitudes.push(solicitud); });
  return solicitud;
}

/** Retira una solicitud: el pasajero se subió, o se cansó de esperar. */
export function retirarCupo(idSolicitud) {
  store.set((e) => { e.solicitudes = e.solicitudes.filter((s) => s.id !== idSolicitud); });
}

/**
 * Declara la ocupación del vehículo (RF-06).
 * El conductor cuenta pasajeros, no asientos libres; el store guarda los
 * asientos disponibles porque es lo que consulta el pasajero.
 */
export function fijarPasajeros(idVehiculo, cantidad) {
  const v = VEHICULOS.find((x) => x.id === idVehiculo);
  const pasajeros = acotar(Number(cantidad) || 0, 0, v.asientosTotal);
  store.set((e) => { e.asientos[idVehiculo] = v.asientosTotal - pasajeros; });
}

/** Publica un aviso de la dirigencia (RF-09). */
export function publicarAviso({ titulo, texto, destino = 'todas' }) {
  store.set((e) => {
    e.avisos.push({
      id: Date.now(),
      titulo: titulo || 'Aviso de la asociación',
      texto: texto || 'Sin detalle adicional.',
      hora: hhmm(),
      destino,
      leido: false,
    });
  });
}

export function marcarLeido(idAviso) {
  store.set((e) => {
    const a = e.avisos.find((x) => x.id === idAviso);
    if (a) a.leido = true;
  });
}

/**
 * Registra un pago (RF-07 y RF-08).
 *
 * La demora simula la respuesta del procesador. En producción esta función
 * inicia una transacción de Webpay Plus y el comprobante se confirma contra
 * el estado real informado por Transbank, nunca contra el resultado local:
 * así se evita el cobro duplicado del escenario 3 de HU-PAS-04.
 *
 * El pago ocupa los asientos por sí solo. Antes el conductor tenía que
 * contarlos a mano mientras manejaba; si el pasajero ya declaró cuántos van
 * y pagó, el sistema tiene el dato y no hay razón para pedírselo de nuevo.
 */
export function pagarViaje(vehiculo, personas = 1) {
  const l = linea(vehiculo.linea);
  const cantidad = acotar(Number(personas) || 1, 1, vehiculo.asientosTotal);
  return new Promise((resolve) => {
    setTimeout(() => {
      let comprobante;
      store.set((e) => {
        e.folio += 1;
        comprobante = {
          folio: e.folio,
          monto: l.tarifa * cantidad,
          personas: cantidad,
          linea: vehiculo.linea,
          patente: vehiculo.patente,
          hora: hhmm(),
        };
        e.pagos.push(comprobante);
        const libres = e.asientos[vehiculo.id] ?? 0;
        e.asientos[vehiculo.id] = Math.max(0, libres - cantidad);
      });
      resolve(comprobante);
    }, CONFIG.DEMORA_PAGO_MS);
  });
}

/* ---------- suscripción ---------- */

/** Reexportado para que las vistas no dependan de store.js directamente. */
export const suscribir = (fn) => store.suscribir(fn);
export const estadoActual = () => store.get();
export const reiniciar = () => store.reiniciar();
