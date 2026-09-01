import { useEffect, useState } from 'react';
import * as api from './api.js';

/**
 * ganchos.js — puentes entre el store y React.
 *
 * Las páginas no tocan `store.js`: se suscriben desde acá. Cuando el store
 * pase a ser Firestore, cambia la implementación de `api.suscribir` y estos
 * ganchos siguen sirviendo igual.
 */

/** Re-renderiza la página con cada cambio del estado compartido. */
export function useEstado() {
  const [estado, setEstado] = useState(api.estadoActual);
  useEffect(() => api.suscribir((siguiente) => setEstado({ ...siguiente })), []);
  return estado;
}

/**
 * Vehículos en marcha de una línea, refrescados con el reloj.
 * La posición es función pura del tiempo, así que basta con volver a pedirla.
 */
export function useVehiculos(idLinea, refrescoMs) {
  const [vehiculos, setVehiculos] = useState(() => api.vehiculosActivos(idLinea));

  useEffect(() => {
    const actualizar = () => setVehiculos(api.vehiculosActivos(idLinea));
    actualizar();
    const cancelar = api.suscribir(actualizar);
    const reloj = setInterval(actualizar, refrescoMs);
    return () => { cancelar(); clearInterval(reloj); };
  }, [idLinea, refrescoMs]);

  return vehiculos;
}
