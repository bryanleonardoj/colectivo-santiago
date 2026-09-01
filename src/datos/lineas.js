/**
 * lineas.js — líneas de colectivo y flota inicial.
 *
 * En producción estas dos colecciones vienen de la base de datos relacional:
 *   lineas(id, nombre, via, tarifa, recorrido_id)
 *   vehiculos(patente, linea_id, conductor_id, asientos_total)
 * Acá están en memoria para que el prototipo funcione sin backend.
 */
import { CONFIG } from '../config.js';
import { medirRecorrido } from '../nucleo/geo.js';

export const LINEAS = [
  {
    id: '3012',
    nombre: 'Peñalolén ↔ La Pintana',
    via: 'Av. Grecia · Vicuña Mackenna',
    color: '--l12',
    tarifa: 950,
    puntosPaso: [[-33.4600,-70.5580],[-33.4550,-70.6300],[-33.5950,-70.5800]],
    recorrido: [[-33.4600,-70.5580],[-33.4550,-70.6300],[-33.5950,-70.5800]],
  },
  {
    id: '2012',
    nombre: 'Peñalolén ↔ La Pintana',
    via: 'Av. Grecia · Av. La Florida · Santa Rosa',
    color: '--l27',
    tarifa: 950,
    puntosPaso: [[-33.4600,-70.5580],[-33.5200,-70.5800],[-33.5450,-70.6300],[-33.6020,-70.6300]],
    recorrido: [[-33.4600,-70.5580],[-33.5200,-70.5800],[-33.5450,-70.6300],[-33.6020,-70.6300]],
  },
];

// Se precalculan las longitudes una sola vez, al cargar el módulo.
LINEAS.forEach((l) => { l.medida = medirRecorrido(l.recorrido); });

/** Obtiene la geometría siguiendo calles reales desde OSRM. */
export async function cargarRecorridos() {
  await Promise.all(LINEAS.map(async (l) => {
    try {
      const coordenadas = l.puntosPaso.map(([lat, lon]) => `${lon},${lat}`).join(';');
      const respuesta = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordenadas}?overview=full&geometries=geojson&steps=false`);
      if (!respuesta.ok) throw new Error(`OSRM ${respuesta.status}`);
      const datos = await respuesta.json();
      const geometria = datos.routes?.[0]?.geometry?.coordinates;
      if (!geometria?.length) throw new Error('Ruta sin geometría');
      l.recorrido = geometria.map(([lon, lat]) => [lat, lon]);
      l.medida = medirRecorrido(l.recorrido);
    } catch {
      // Conserva los puntos de respaldo si el servicio no está disponible.
    }
  }));
  return LINEAS;
}

/** Busca una línea por su identificador. */
export const linea = (id) => LINEAS.find((l) => l.id === id);

const CONDUCTORES = [
  'J. Rojas', 'M. Salinas', 'P. Aguilera', 'C. Muñoz',
  'R. Tapia', 'L. Fuentes', 'A. Cárdenas', 'D. Peña',
  'H. Vergara', 'S. Navarro', 'E. Bustos', 'G. Riquelme', 'F. Contreras',
];

const PREFIJOS = ['JK', 'LP', 'RT', 'BV', 'CX', 'DH'];

/**
 * Flota inicial.
 *
 * `fase` y `velocidad` no son estado mutable: son parámetros que permiten
 * calcular la posición del vehículo como función del reloj. Por eso dos
 * pestañas abiertas ven exactamente lo mismo sin sincronizarse.
 */
export const VEHICULOS = (() => {
  const flota = [];
  let n = 0;
  LINEAS.forEach((l, li) => {
    const cuantos = li === 0 ? 4 : 3;
    for (let k = 0; k < cuantos; k++) {
      n++;
      flota.push({
        id: 'v' + n,
        patente: `${PREFIJOS[n % PREFIJOS.length]}-${10 + n}-${20 + n}`,
        conductor: CONDUCTORES[(n - 1) % CONDUCTORES.length],
        linea: l.id,
        asientosTotal: CONFIG.ASIENTOS_POR_VEHICULO,
        fase: k / cuantos,                 // punto de partida sobre el recorrido
        velocidad: 0.55 + (n % 5) * 0.09,  // determinista, no aleatoria
      });
    }
  });
  return flota;
})();

/** El vehículo que conduce el usuario del perfil 2. */
export const MI_VEHICULO = VEHICULOS[0].id;
