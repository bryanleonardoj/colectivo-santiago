import { useEffect, useState } from 'react';
import Mapa from '../componentes/Mapa.jsx';
import Pago from '../componentes/Pago.jsx';
import { FormularioCupo, EstadoCupo } from '../componentes/PedirCupo.jsx';
import * as api from '../nucleo/api.js';
import { useVehiculos, useEstado } from '../nucleo/ganchos.js';
import { clp } from '../nucleo/util.js';
import { CONFIG } from '../config.js';

/** Punto de espera inicial. En producción lo entrega la geolocalización. */
const PUNTO_PASAJERO = [-33.456, -70.625];

const NECESIDAD_INICIAL = { personas: 1, maletero: 'no' };

/** Ficha del vehículo elegido, con el botón que abre el pago. */
function DetalleViaje({ vehiculo, personas, onPagar }) {
  const linea = api.obtenerLinea(vehiculo.linea);
  const total = linea.tarifa * personas;
  return (
    <div className="card" style={{ margin: '.55rem .75rem' }}>
      <div className="lbl">Viaje seleccionado</div>
      <div className="kv"><span>Línea</span><b>{vehiculo.linea} · {linea.via}</b></div>
      <div className="kv"><span>Vehículo</span><b>{vehiculo.patente}</b></div>
      <div className="kv"><span>Llega en</span><b>{vehiculo.apto ? `${vehiculo.eta} min` : '—'}</b></div>
      <div className="kv">
        <span>Tarifa</span>
        <b>{personas > 1 ? `${clp(linea.tarifa)} × ${personas} = ${clp(total)}` : clp(total)}</b>
      </div>
      <button className="btn amber" style={{ marginTop: '.7rem' }} disabled={!vehiculo.apto} onClick={onPagar}>
        {vehiculo.apto ? `Pagar ${clp(total)}` : 'No tiene el espacio que pediste'}
      </button>
    </div>
  );
}

/** Por qué un colectivo no sirve para lo que se pidió. */
function motivoNoApto(vehiculo, necesidad) {
  if (vehiculo.asientosLibres < necesidad.personas) {
    return vehiculo.asientosLibres === 0
      ? 'Sin asientos disponibles'
      : `Solo ${vehiculo.asientosLibres} ${vehiculo.asientosLibres === 1 ? 'asiento' : 'asientos'} libres`;
  }
  if (api.nivelMaletero(vehiculo.maletero) < api.nivelMaletero(necesidad.maletero)) {
    return necesidad.maletero === 'silla'
      ? 'Su maletero no da para una silla de ruedas'
      : 'Hoy no presta el maletero';
  }
  return null;
}

export default function Pasajero() {
  const [lineaActiva, setLineaActiva] = useState('todas');
  const [punto, setPunto] = useState(PUNTO_PASAJERO);
  const [seleccionado, setSeleccionado] = useState(null);
  const [pagando, setPagando] = useState(null);
  const [necesidad, setNecesidad] = useState(NECESIDAD_INICIAL);
  const [miSolicitud, setMiSolicitud] = useState(null);
  const [lineas, setLineas] = useState(() =>
    api.obtenerLineas().map((linea) => ({ ...linea, recorrido: [...linea.recorrido] }))
  );

  const estado = useEstado();
  const vehiculos = useVehiculos(lineaActiva, CONFIG.REFRESCO_MS);
  const cercanos = api.vehiculosCercanos(punto, lineaActiva, necesidad);
  const elegido = cercanos.find((v) => v.id === seleccionado);
  const aptos = api.aptosPara(necesidad, lineaActiva);

  // La solicitud caduca sola: si el store ya no la tiene, se limpia la vista.
  const solicitudViva = miSolicitud
    ? estado.solicitudes.find((s) => s.id === miSolicitud.id) && api.solicitudesVigentes().find((s) => s.id === miSolicitud.id)
    : null;

  // La geometría real de los recorridos llega desde OSRM una sola vez.
  useEffect(() => {
    let vigente = true;
    api.cargarGeometrias().then((rutas) => { if (vigente) setLineas(rutas); });
    return () => { vigente = false; };
  }, []);

  function pedir() {
    setMiSolicitud(api.pedirCupo({ punto, ...necesidad, linea: lineaActiva }));
  }

  function retirar() {
    if (miSolicitud) api.retirarCupo(miSolicitud.id);
    setMiSolicitud(null);
  }

  return (
    <main className="centro">
      <div className="phone">
        <div className="appbar">
          <div className="brand">
            <div className="mark amber">C</div>
            <div className="t">Cerca de ti</div>
          </div>
          <span className="s">{aptos} con tu espacio</span>
        </div>

        <div className="screen">
          <Mapa
            vehiculos={vehiculos}
            puntoEspera={punto}
            seleccionado={seleccionado}
            lineaActiva={lineaActiva}
            lineas={lineas}
            onSelect={setSeleccionado}
            onMove={(p) => { setPunto(p); setSeleccionado(null); }}
          />

          <button
            className="locate-button"
            onClick={() => { setPunto(PUNTO_PASAJERO); setSeleccionado(null); }}
          >
            Centrar en mi ubicación
          </button>

          <div className="chips">
            <button className="chip" aria-pressed={lineaActiva === 'todas'} onClick={() => setLineaActiva('todas')}>
              Todas
            </button>
            {api.obtenerLineas().map((linea) => (
              <button
                key={linea.id}
                className="chip"
                aria-pressed={lineaActiva === linea.id}
                onClick={() => setLineaActiva(linea.id)}
              >
                {linea.id}
              </button>
            ))}
          </div>

          <div className="cupo-zona">
            {solicitudViva
              ? <EstadoCupo solicitud={solicitudViva} onRetirar={retirar} />
              : <FormularioCupo necesidad={necesidad} onCambio={setNecesidad} onPedir={pedir} aptos={aptos} />}
          </div>

          {elegido && (
            <DetalleViaje
              vehiculo={elegido}
              personas={necesidad.personas}
              onPagar={() => setPagando(elegido)}
            />
          )}

          <div className="sheet">
            <div className="grab" />
            <div className="sheet-h">
              <div>
                <span className="eyebrow">Servicio activo</span>
                <h3>{lineaActiva === 'todas' ? 'Colectivos cerca de ti' : api.obtenerLinea(lineaActiva).nombre}</h3>
              </div>
              <span>{cercanos.length} unidades</span>
            </div>

            <div className="sheet-b">
              {cercanos.length === 0 && (
                <p className="empty">No hay colectivos en servicio en esta línea ahora mismo.</p>
              )}
              {cercanos.map((v) => {
                const motivo = motivoNoApto(v, necesidad);
                return (
                  <button
                    key={v.id}
                    className={`row ${seleccionado === v.id ? 'sel' : ''} ${v.apto ? '' : 'no-apto'}`}
                    onClick={() => setSeleccionado(v.id)}
                  >
                    <span className="badge" style={{ background: `var(${api.obtenerLinea(v.linea).color})` }}>
                      {v.linea}
                    </span>
                    <span className="info">
                      <b>{v.patente} · {v.conductor}</b>
                      <small>{api.obtenerLinea(v.linea).via}</small>
                      <small className={v.apto ? 'availability' : 'sin-espacio'}>
                        {motivo || `${v.asientosLibres} de ${v.asientosTotal} asientos libres`}
                      </small>
                      {v.maletero !== 'no' && (
                        <span className="capacidades">
                          <i aria-hidden="true">{CONFIG.MALETERO[v.maletero].icono}</i>
                          <em>
                            {v.maletero === 'silla'
                              ? 'Maletero para silla de ruedas'
                              : 'Maletero para equipaje'}
                          </em>
                        </span>
                      )}
                    </span>
                    <span className="eta">
                      <b>{v.apto ? v.eta : '—'}</b>
                      <small>{v.apto ? 'min' : 'no aplica'}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {pagando && (
            <Pago
              vehiculo={pagando}
              personas={necesidad.personas}
              onCerrar={() => setPagando(null)}
              onPagado={retirar}
            />
          )}
        </div>
      </div>
    </main>
  );
}
