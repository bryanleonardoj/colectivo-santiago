/**
 * geo.js — geometría de los recorridos.
 *
 * Resuelve distancias, posiciones sobre un recorrido y tiempos de llegada.
 * El dibujo del mapa lo hace Leaflet, así que acá ya no hay proyección al
 * lienzo SVG: solo cálculo geográfico.
 *
 * A la escala de una ciudad la curvatura terrestre es despreciable, así que
 * basta una aproximación lineal. Para un despliegue nacional habría que pasar
 * a distancia de haversine.
 */

// 1° de latitud ≈ 111 km; 1° de longitud a la latitud de Santiago ≈ 92,6 km.
const KM_POR_GRADO_LAT = 111;
const KM_POR_GRADO_LON = 92.6;

/** Distancia aproximada en kilómetros entre dos puntos [lat, lon]. */
export function distanciaKm(a, b) {
  const dy = (a[0] - b[0]) * KM_POR_GRADO_LAT;
  const dx = (a[1] - b[1]) * KM_POR_GRADO_LON;
  return Math.hypot(dx, dy);
}

/** Precalcula la longitud de cada tramo de un recorrido y su total. */
export function medirRecorrido(puntos) {
  const tramos = [];
  let total = 0;
  for (let i = 0; i < puntos.length - 1; i++) {
    const d = distanciaKm(puntos[i], puntos[i + 1]);
    tramos.push(d);
    total += d;
  }
  return { tramos, total };
}

/**
 * Avance en kilómetros de un punto proyectado sobre el recorrido de una línea.
 * Busca el tramo más cercano al punto y acumula la distancia hasta ahí.
 */
function avanceEnKm(linea, punto) {
  let acumulado = 0;
  let mejor = Infinity;
  let distanciaMejor = 0;

  for (let i = 0; i < linea.recorrido.length - 1; i++) {
    const actual = linea.recorrido[i];
    const siguiente = linea.recorrido[i + 1];

    const x = (punto[1] - actual[1]) * KM_POR_GRADO_LON;
    const y = (punto[0] - actual[0]) * KM_POR_GRADO_LAT;
    const dx = (siguiente[1] - actual[1]) * KM_POR_GRADO_LON;
    const dy = (siguiente[0] - actual[0]) * KM_POR_GRADO_LAT;

    const largo = dx * dx + dy * dy;
    const factor = largo ? Math.max(0, Math.min(1, (x * dx + y * dy) / largo)) : 0;
    const distanciaAlTramo = Math.hypot(x - dx * factor, y - dy * factor);

    if (distanciaAlTramo < mejor) {
      mejor = distanciaAlTramo;
      distanciaMejor = acumulado + linea.medida.tramos[i] * factor;
    }
    acumulado += linea.medida.tramos[i];
  }
  return distanciaMejor;
}

/**
 * Distancia por la ruta entre dos puntos, ambos proyectados sobre el recorrido.
 * Es lo que se usa para el ETA: un vehículo que va por la calle no llega en
 * línea recta.
 */
export function distanciaSobreRecorrido(linea, a, b) {
  return Math.abs(avanceEnKm(linea, a) - avanceEnKm(linea, b));
}

/**
 * Punto geográfico correspondiente a un avance `t` (de 0 a 1) sobre el recorrido.
 * Interpola linealmente dentro del tramo que contiene ese avance.
 */
export function puntoEnRecorrido(linea, t) {
  const { tramos, total } = linea.medida;
  let restante = t * total;
  let i = 0;
  while (i < tramos.length && restante > tramos[i]) {
    restante -= tramos[i];
    i++;
  }
  if (i >= tramos.length) { i = tramos.length - 1; restante = tramos[i]; }
  const a = linea.recorrido[i];
  const b = linea.recorrido[i + 1];
  const f = tramos[i] ? restante / tramos[i] : 0;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
