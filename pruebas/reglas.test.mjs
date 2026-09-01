/**
 * reglas.test.mjs — pruebas de la regla central del sistema.
 *
 * Comprueba, sin navegador, que una solicitud de cupo solo llegue a los
 * conductores que de verdad pueden atenderla. Se ejecuta con:
 *
 *   node pruebas/reglas.test.mjs
 *
 * El núcleo corre en el navegador, así que acá se simulan las tres cosas del
 * entorno que usa `store.js`: localStorage, window y BroadcastChannel.
 */
globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; },
  setItem(k, v) { this._d.set(k, String(v)); },
  removeItem(k) { this._d.delete(k); },
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const api = await import('../src/nucleo/api.js');
const { CONFIG } = await import('../src/config.js');

let fallos = 0;
function comprobar(descripcion, condicion) {
  if (condicion) {
    console.log(`  ok   ${descripcion}`);
  } else {
    console.log(`  FALLA ${descripcion}`);
    fallos++;
  }
}

/** Deja un solo vehículo en servicio, con los asientos y el maletero pedidos. */
function prepararFlota({ asientosLibres, maletero }) {
  const flota = api.estadoActual();
  const mio = api.miVehiculo();
  Object.keys(flota.turnos).forEach((id) => api.fijarTurno(id, id === mio.id));
  api.fijarPasajeros(mio.id, mio.asientosTotal - asientosLibres);
  api.fijarMaletero(mio.id, maletero);
  return mio;
}

const PUNTO = [-33.456, -70.625];
const limpiar = () => api.estadoActual().solicitudes.slice().forEach((s) => api.retirarCupo(s.id));

console.log('\nAsientos: el grupo tiene que caber completo');
{
  const mio = prepararFlota({ asientosLibres: 2, maletero: 'silla' });
  limpiar();
  api.pedirCupo({ punto: PUNTO, personas: 2 });
  comprobar('un grupo de 2 cabe en 2 asientos libres', api.solicitudesPara(mio.id).length === 1);

  limpiar();
  api.pedirCupo({ punto: PUNTO, personas: 3 });
  comprobar('un grupo de 3 NO cabe en 2 asientos libres', api.solicitudesPara(mio.id).length === 0);
}

console.log('\nMaletero: quien no lo presta no ve esas solicitudes');
{
  const mio = prepararFlota({ asientosLibres: 4, maletero: 'no' });
  limpiar();
  api.pedirCupo({ punto: PUNTO, personas: 1, maletero: 'equipaje' });
  comprobar('sin maletero disponible no le llega', api.solicitudesPara(mio.id).length === 0);

  api.fijarMaletero(mio.id, 'equipaje');
  comprobar('al ofrecerlo, la misma solicitud aparece', api.solicitudesPara(mio.id).length === 1);

  api.fijarMaletero(mio.id, 'no');
  comprobar('al dejar de ofrecerlo, desaparece sin rechazar a nadie', api.solicitudesPara(mio.id).length === 0);
}

console.log('\nSilla de ruedas: es del pasajero y necesita un maletero que le dé');
{
  const mio = prepararFlota({ asientosLibres: 4, maletero: 'equipaje' });
  limpiar();
  api.pedirCupo({ punto: PUNTO, personas: 1, maletero: 'silla' });
  comprobar('un maletero que solo da para equipaje no califica',
            api.solicitudesPara(mio.id).length === 0);

  api.fijarMaletero(mio.id, 'silla');
  comprobar('un maletero donde cabe la silla sí califica',
            api.solicitudesPara(mio.id).length === 1);

  // El tamaño es acumulativo: donde cabe una silla cabe también una maleta.
  limpiar();
  api.pedirCupo({ punto: PUNTO, personas: 1, maletero: 'equipaje' });
  comprobar('quien acepta sillas acepta también equipaje',
            api.solicitudesPara(mio.id).length === 1);

  limpiar();
  api.pedirCupo({ punto: PUNTO, personas: 1, maletero: 'no' });
  comprobar('quien no necesita maletero califica en cualquier vehículo',
            api.solicitudesPara(mio.id).length === 1);
}

console.log('\nTurno: fuera de servicio no se ve nada (medida S4)');
{
  const mio = prepararFlota({ asientosLibres: 4, maletero: 'silla' });
  limpiar();
  api.pedirCupo({ punto: PUNTO, personas: 1 });
  comprobar('en turno la ve', api.solicitudesPara(mio.id).length === 1);
  api.fijarTurno(mio.id, false);
  comprobar('con el turno cerrado no ve ninguna', api.solicitudesPara(mio.id).length === 0);
}

console.log('\nVigencia: una solicitud vieja se cae sola');
{
  const mio = prepararFlota({ asientosLibres: 4, maletero: 'silla' });
  limpiar();
  const s = api.pedirCupo({ punto: PUNTO, personas: 1 });
  comprobar('recién creada está vigente', api.solicitudesPara(mio.id).length === 1);
  // Se envejece la solicitud más allá de la ventana de vigencia.
  api.estadoActual().solicitudes.find((x) => x.id === s.id).creada -= CONFIG.SOLICITUD_VIGENTE_MS + 1000;
  comprobar('pasada la vigencia ya no aparece', api.solicitudesPara(mio.id).length === 0);
}

console.log('\nPatente: se revela sola cuando un vehículo apto viene cerca');
{
  const mio = prepararFlota({ asientosLibres: 4, maletero: 'silla' });
  limpiar();
  // El punto de espera es la posición actual del propio vehículo: ETA mínimo.
  const encima = api.posicionDe(mio);
  const cerca = api.pedirCupo({ punto: encima, personas: 1 });
  const enCamino = api.vehiculoEnCamino(cerca);
  comprobar('con un apto encima, aparece la patente', enCamino?.patente === mio.patente);

  // Ahora el mismo vehículo, pero con un maletero que no da para la silla.
  api.fijarMaletero(mio.id, 'equipaje');
  const conSilla = api.pedirCupo({ punto: encima, personas: 1, maletero: 'silla' });
  comprobar('si no puede tomarla, no se revela ninguna patente', api.vehiculoEnCamino(conSilla) === null);
}

console.log('\nPago: ocupa los asientos por sí solo');
{
  const mio = prepararFlota({ asientosLibres: 4, maletero: 'silla' });
  const antes = api.flota().find((v) => v.id === mio.id).asientosLibres;
  const enMarcha = api.vehiculosActivos().find((v) => v.id === mio.id);
  const comprobante = await api.pagarViaje(enMarcha, 2);
  const despues = api.flota().find((v) => v.id === mio.id).asientosLibres;
  comprobar('cobra la tarifa por cada pasajero', comprobante.monto === api.obtenerLinea(mio.linea).tarifa * 2);
  comprobar('descuenta 2 asientos sin que el conductor toque nada', despues === antes - 2);
}

console.log(fallos === 0 ? '\nTodo en orden.\n' : `\n${fallos} comprobación(es) fallaron.\n`);
process.exit(fallos === 0 ? 0 : 1);
