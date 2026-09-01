/**
 * store.js — estado compartido entre los tres perfiles.
 *
 * Guarda solo lo que es consecuencia de una acción humana: turnos, asientos,
 * avisos y pagos. La posición de los vehículos NO vive acá, porque se calcula
 * a partir del reloj (ver api.js).
 *
 * Persiste en localStorage y avisa a las demás pestañas con BroadcastChannel.
 * Ese par cumple, en el prototipo, el mismo rol que tendrán las suscripciones
 * en tiempo real del backend definitivo: cuando se migre a Firestore, cambia
 * la implementación de este archivo y ninguna vista se entera.
 */
import { CONFIG } from '../config.js';
import { VEHICULOS, MI_VEHICULO } from '../datos/lineas.js';

/** Estado inicial cuando no hay nada guardado. */
function estadoInicial() {
  const turnos = {};
  const asientos = {};
  const maleteros = {};
  const NIVELES = ['no', 'equipaje', 'silla'];
  VEHICULOS.forEach((v, i) => {
    turnos[v.id] = true;
    asientos[v.id] = (i * 3) % (v.asientosTotal + 1);
    // Nadie está obligado a poner el maletero a disposición: es un plus que
    // cada conductor decide cuándo dar. Se parte con una mezcla para que el
    // prototipo tenga algo que mostrar.
    maleteros[v.id] = NIVELES[i % 3];
  });
  asientos[MI_VEHICULO] = 3;
  maleteros[MI_VEHICULO] = 'equipaje';

  return {
    turnos,     // { idVehiculo: boolean }
    asientos,   // { idVehiculo: numero de asientos libres }
    maleteros,  // { idVehiculo: 'no' | 'equipaje' | 'silla' }
    solicitudes: [],  // { id, punto, personas, maletero, linea, creada }
    avisos: [
      { id: 1, titulo: 'Corte de tránsito en Alameda', texto: 'Desvío por Av. Matta entre 08:00 y 11:00 por evento en Plaza Baquedano.', hora: '07:42', destino: 'todas', leido: true },
      { id: 2, titulo: 'Reunión de asociación', texto: 'Miércoles 20:00 en la sede. Se tratará la tarifa de invierno.', hora: '09:15', destino: 'todas', leido: false },
    ],
    pagos: [],  // { folio, monto, linea, patente, hora }
    folio: CONFIG.FOLIO_INICIAL,
  };
}

let estado = cargar();
const suscriptores = new Set();

/** Canal entre pestañas. Puede no existir en navegadores antiguos. */
const canal = (() => {
  try { return new BroadcastChannel(CONFIG.CANAL); } catch { return null; }
})();

if (canal) {
  canal.onmessage = (e) => {
    if (e.data?.tipo === 'estado') {
      estado = e.data.estado;
      notificar(false);   // llegó de otra pestaña: no reenviar
    }
  };
}

window.addEventListener('storage', (e) => {
  if (e.key !== CONFIG.STORAGE_KEY || !e.newValue) return;
  try {
    estado = JSON.parse(e.newValue);
    notificar(false);
  } catch {
  }
});

function cargar() {
  const inicial = estadoInicial();
  try {
    const crudo = localStorage.getItem(CONFIG.STORAGE_KEY);
    // Se mezcla con el estado inicial para que una versión guardada antes de
    // agregar un campo nuevo no deje la aplicación sin ese campo.
    if (crudo) return { ...inicial, ...JSON.parse(crudo) };
  } catch {
    // Modo incógnito o almacenamiento bloqueado: se sigue en memoria.
  }
  return inicial;
}

function guardar() {
  try {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(estado));
  } catch {
    // Si no se puede persistir, el prototipo igual funciona en esta pestaña.
  }
}

function notificar(propagar = true) {
  if (propagar) {
    guardar();
    canal?.postMessage({ tipo: 'estado', estado });
  }
  suscriptores.forEach((fn) => fn(estado));
}

export const store = {
  /** Lectura del estado actual. Nunca se muta desde afuera. */
  get: () => estado,

  /**
   * Aplica un cambio y avisa a todos los suscriptores.
   * @param {(e:object)=>void} mutacion función que modifica el estado
   */
  set(mutacion) {
    mutacion(estado);
    notificar();
  },

  /**
   * Registra un observador. Devuelve la función para darse de baja.
   * Equivale al `onSnapshot` de Firestore.
   */
  suscribir(fn) {
    suscriptores.add(fn);
    fn(estado);
    return () => suscriptores.delete(fn);
  },

  /** Vuelve al estado inicial. Útil para demostrar el prototipo de nuevo. */
  reiniciar() {
    estado = estadoInicial();
    notificar();
  },
};
