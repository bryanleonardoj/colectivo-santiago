/**
 * util.js — utilidades sin dependencias.
 *
 * React escapa el texto por sí solo, así que acá ya no viven los ayudantes de
 * DOM (`$`, `$$`, `esc`) que necesitaba la versión con innerHTML.
 */

/** Formatea un monto en pesos chilenos. */
export const clp = (n) => '$' + Number(n).toLocaleString('es-CL');

/** Hora actual como HH:MM. */
export const hhmm = (d = new Date()) =>
  String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

/** Lee el valor calculado de una variable CSS (por ejemplo '--l12'). */
export const cssVar = (nombre) =>
  getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();

/** Limita un número a un rango. */
export const acotar = (n, min, max) => Math.max(min, Math.min(max, n));
