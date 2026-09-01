/**
 * config.js — constantes del sistema.
 * Todo valor que un día pueda cambiar por decisión de negocio vive acá,
 * nunca escrito dentro de una vista.
 */
export const CONFIG = {
  // Velocidad comercial promedio de un colectivo, en km/h.
  // Se usa para estimar el tiempo de llegada.
  VELOCIDAD_COMERCIAL_KMH: 18,

  // Cada cuánto se repinta la capa de vehículos.
  REFRESCO_MS: 700,

  // Asientos de un colectivo estándar.
  ASIENTOS_POR_VEHICULO: 4,

  /**
   * Qué se puede guardar en el maletero, de menos a más.
   *
   * No son tres cosas distintas sino el mismo espacio en tres tamaños, así que
   * se comparan por nivel: un maletero que da para una silla de ruedas plegada
   * da también para una maleta. La silla es del pasajero; lo que declara el
   * conductor es si le cabe.
   */
  MALETERO: {
    no: { nivel: 0, icono: '—', breve: 'Sin maletero' },
    equipaje: { nivel: 1, icono: '🧳', breve: 'Equipaje' },
    silla: { nivel: 2, icono: '♿', breve: 'Silla de ruedas' },
  },

  // Una solicitud de cupo se borra sola pasado este lapso: nadie espera en la
  // esquina media hora, y el mapa del conductor no debe llenarse de fantasmas.
  SOLICITUD_VIGENTE_MS: 10 * 60_000,

  // Cuando un vehículo apto queda a esta distancia en minutos de quien pidió
  // cupo, el pasajero pasa a ver su patente. No hace falta que el conductor
  // acepte nada: basta con que venga en camino.
  REVELAR_PATENTE_MIN: 5,

  // Folio inicial de los comprobantes de pago simulados.
  FOLIO_INICIAL: 78_400,

  // Demora simulada del procesador de pagos.
  DEMORA_PAGO_MS: 1_500,

  // Clave de persistencia local y canal de sincronización entre pestañas.
  STORAGE_KEY: 'colectivo-santiago:v3',
  CANAL: 'colectivo-santiago',
};
