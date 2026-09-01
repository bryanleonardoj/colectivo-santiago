import { useEffect, useMemo, useState } from 'react';
import Mapa from '../componentes/Mapa.jsx';
import * as api from '../nucleo/api.js';
import { useEstado } from '../nucleo/ganchos.js';
import { CONFIG } from '../config.js';
import { describir } from '../componentes/PedirCupo.jsx';

const PESTANAS = [
  { id: 'turno', texto: 'Turno' },
  { id: 'radar', texto: 'Radar' },
  { id: 'avisos', texto: 'Avisos' },
  { id: 'jornada', texto: 'Jornada' },
];

/**
 * Qué da el maletero hoy.
 *
 * Son tres niveles del mismo espacio, no tres funciones distintas. El conductor
 * no ofrece una silla de ruedas: la silla es del pasajero y viaja plegada
 * atrás, así que lo único que él declara es si le cabe.
 *
 * Se cambia cuando sea, sin dar explicaciones ni comprometerse con nada.
 * Bajarlo no rechaza a nadie: hace que esas solicitudes no le lleguen, así que
 * el pasajero nunca ve un "no".
 */
const NIVELES_MALETERO = [
  { clave: 'no', icono: '🚫', titulo: 'No presto el maletero', desc: 'Hoy lo llevo ocupado o prefiero no usarlo' },
  { clave: 'equipaje', icono: '🧳', titulo: 'Cabe equipaje', desc: 'Una maleta o un bulto grande' },
  { clave: 'silla', icono: '♿', titulo: 'Cabe una silla de ruedas', desc: 'Espacio para guardar la silla del pasajero, plegada' },
];

function Maletero({ vehiculo, maletero }) {
  return (
    <div className="card">
      <div className="lbl">Mi maletero hoy</div>
      <p className="helper">
        Cámbialo cuando quieras. Lo que elijas define qué solicitudes te aparecen: si bajas el nivel,
        esas dejan de llegarte y nadie recibe un rechazo.
      </p>
      <div role="radiogroup" aria-label="Qué da mi maletero hoy">
        {NIVELES_MALETERO.map(({ clave, icono, titulo, desc }) => (
          <button
            key={clave}
            className="switch-fila"
            role="radio"
            aria-checked={maletero === clave}
            onClick={() => api.fijarMaletero(vehiculo.id, clave)}
          >
            <span className="switch-icono" aria-hidden="true">{icono}</span>
            <span className="switch-texto"><b>{titulo}</b><small>{desc}</small></span>
            <span className="switch-marca" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Radar: las solicitudes de cupo que este vehículo puede tomar.
 *
 * No hay botón de aceptar. El conductor solo maneja; si pasa cerca y quiere,
 * para. Cuando su vehículo es el apto más cercano, el pasajero ve su patente
 * sin que él haya tocado nada.
 */
function Radar({ vehiculo, lineas, solicitudes, enTurno }) {
  // El vehículo se mueve cada 700 ms; si el encuadre se recalculara con él, el
  // mapa saltaría sin parar. Se recalcula solo cuando cambia quién espera.
  const clave = solicitudes.map((s) => s.id).join(',');
  const encuadre = useMemo(
    () => [vehiculo.posicion, ...solicitudes.map((s) => s.punto)],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clave]
  );

  if (!enTurno) {
    return (
      <div className="card">
        <p className="empty">Inicia tu turno para ver a quién puedes recoger.</p>
      </div>
    );
  }
  return (
    <>
      <div className="card radar-card">
        <div className="radar-mapa">
          <Mapa
            vehiculos={[vehiculo]}
            lineaActiva={vehiculo.linea}
            lineas={lineas.filter((l) => l.id === vehiculo.linea)}
            solicitudes={solicitudes}
            encuadre={encuadre}
          />
        </div>
      </div>

      <div className="card">
        <div className="lbl">Te pueden estar esperando · {solicitudes.length}</div>
        {solicitudes.length === 0 && (
          <p className="empty">Nadie con lo que puedes ofrecer, por ahora.</p>
        )}
        {solicitudes.map((s) => (
          <div className="kv" key={s.id}>
            <span>
              <b style={{ color: 'var(--ink)' }} aria-hidden="true">
                {s.maletero === 'no' ? '👤' : CONFIG.MALETERO[s.maletero].icono}{' '}
              </b>
              {describir(s)}
            </span>
            <b>a {s.eta} min</b>
          </div>
        ))}
      </div>
    </>
  );
}

/** Contador de pasajeros a bordo, compartido por el panel y el mockup. */
function ContadorPasajeros({ vehiculo, pasajeros, conNumero = true }) {
  return (
    <div className="quick-counter">
      <button
        aria-label="Quitar pasajero"
        disabled={pasajeros <= 0}
        onClick={() => api.fijarPasajeros(vehiculo.id, pasajeros - 1)}
      >
        −
      </button>
      {conNumero && <strong>{pasajeros}</strong>}
      <button
        aria-label="Agregar pasajero"
        disabled={pasajeros >= vehiculo.asientosTotal}
        onClick={() => api.fijarPasajeros(vehiculo.id, pasajeros + 1)}
      >
        +
      </button>
    </div>
  );
}

/** Control rápido en marcha: el conductor solo suma o resta pasajeros. */
function ControlRapido({ vehiculo, pasajeros, libres, onCerrar }) {
  return (
    <div className="quick-overlay" role="dialog" aria-modal="true" aria-labelledby="quick-title">
      <div className="quick-panel">
        <button className="close-button" aria-label="Cerrar control rápido" onClick={onCerrar}>×</button>
        <div className="lbl">CONTROL EN MARCHA</div>
        <h2 id="quick-title">Pasajeros a bordo</h2>
        <p className="helper">El cambio se comparte inmediatamente con pasajero y administración.</p>
        <ContadorPasajeros vehiculo={vehiculo} pasajeros={pasajeros} />
        <div className="quick-capacity">{libres} asientos libres</div>
        <button className="btn" onClick={onCerrar}>Cerrar control</button>
      </div>
    </div>
  );
}

/**
 * Mockup del control desde la pantalla bloqueada del teléfono.
 * Acá también va el nivel del maletero: si el conductor no puede desbloquear
 * el teléfono para contar pasajeros, tampoco va a poder hacerlo para avisar
 * que ahora sí le cabe la silla de alguien.
 */
function MockupBloqueado({ vehiculo, pasajeros, enTurno, maletero, solicitudes, onCerrar }) {
  return (
    <div className="quick-overlay support-overlay" role="dialog" aria-modal="true" aria-labelledby="support-title">
      <div className="locked-phone">
        <div className="locked-status"><span>9:41</span><span>▰ ◔</span></div>
        <div className="locked-time">9:41</div>
        <div className="locked-date" id="support-title">Martes, 25 de agosto</div>
        <div className="locked-service">
          <span className={`pill ${enTurno ? 'on' : 'off'}`}><i />{enTurno ? 'EN SERVICIO' : 'FUERA DE SERVICIO'}</span>
          <b>{vehiculo.linea}</b>
          <small>{vehiculo.patente}</small>
        </div>
        <div className="locked-passengers">
          <span>Pasajeros a bordo</span>
          <strong>{pasajeros}<small> / {vehiculo.asientosTotal}</small></strong>
          <ContadorPasajeros vehiculo={vehiculo} pasajeros={pasajeros} conNumero={false} />
        </div>
        <div className="locked-espacio" role="radiogroup" aria-label="Qué da mi maletero">
          {NIVELES_MALETERO.map(({ clave, icono, titulo }) => (
            <button
              key={clave}
              className="locked-chip"
              role="radio"
              aria-checked={maletero === clave}
              aria-label={titulo}
              onClick={() => api.fijarMaletero(vehiculo.id, clave)}
            >
              <span aria-hidden="true">{icono}</span>
              {CONFIG.MALETERO[clave].breve}
            </button>
          ))}
        </div>

        <div className="locked-hint">
          {solicitudes.length > 0
            ? `${solicitudes.length} ${solicitudes.length === 1 ? 'persona te puede estar esperando' : 'personas te pueden estar esperando'} adelante`
            : 'Control disponible desde la pantalla bloqueada'}
        </div>
        <button className="btn ghost" onClick={onCerrar}>Cerrar mockup</button>
      </div>
    </div>
  );
}

export default function Conductor() {
  const estado = useEstado();
  const vehiculo = api.miVehiculo();
  const [pestana, setPestana] = useState('turno');
  const [controlAbierto, setControlAbierto] = useState(false);
  const [mockupAbierto, setMockupAbierto] = useState(false);
  const [tic, setTic] = useState(0);
  const [lineas, setLineas] = useState(() =>
    api.obtenerLineas().map((l) => ({ ...l, recorrido: [...l.recorrido] }))
  );

  const enTurno = !!estado.turnos[vehiculo.id];
  const libres = estado.asientos[vehiculo.id] ?? 0;
  const pasajeros = vehiculo.asientosTotal - libres;
  const maletero = estado.maleteros[vehiculo.id] ?? 'no';
  const avisos = api.avisosPara(vehiculo.linea);
  const pagos = api.pagosDe(vehiculo.patente);
  const solicitudes = api.solicitudesPara(vehiculo.id);
  const enMarcha = api.vehiculosActivos().find((v) => v.id === vehiculo.id);

  useEffect(() => {
    let vigente = true;
    api.cargarGeometrias().then((rutas) => { if (vigente) setLineas(rutas); });
    return () => { vigente = false; };
  }, []);

  // El radar se mueve con el reloj: las posiciones y los ETA son función del
  // tiempo, así que basta con volver a pedirlos.
  useEffect(() => {
    if (pestana !== 'radar') return undefined;
    const reloj = setInterval(() => setTic((n) => n + 1), CONFIG.REFRESCO_MS);
    return () => clearInterval(reloj);
  }, [pestana]);
  void tic;

  return (
    <main className="shell">
      <div className="card">
        <div className="lbl">CONDUCTOR · CONTROL INTERNO</div>
        <h1>{vehiculo.patente} · {vehiculo.linea}</h1>
        <div className="tabs" role="tablist">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={pestana === p.id}
              onClick={() => setPestana(p.id)}
            >
              {p.texto}
            </button>
          ))}
        </div>
      </div>

      {pestana === 'turno' && (
        <>
          <div className={`card status-card ${enTurno ? 'is-active' : ''}`}>
            <div className="status-line">
              <div>
                <div className="lbl">Estado del turno</div>
                <div className="big">{enTurno ? 'Activo' : 'Cerrado'}</div>
              </div>
              <span className={`pill ${enTurno ? 'on' : 'off'}`}><i />{enTurno ? 'VISIBLE' : 'OCULTO'}</span>
            </div>
            <p className="helper">
              {enTurno
                ? 'Tu vehículo aparece en el mapa del pasajero.'
                : 'Tu vehículo está fuera de servicio.'}
            </p>
            <button className={`btn ${enTurno ? 'danger' : 'amber'}`} onClick={() => api.fijarTurno(vehiculo.id, !enTurno)}>
              {enTurno ? 'Finalizar turno' : 'Iniciar turno'}
            </button>
          </div>

          <div className="card passenger-card">
            <div className="lbl">Control rápido · pasajeros a bordo</div>
            <div className="passenger-count">
              <span className="big">{pasajeros}</span>
              <span>/ {vehiculo.asientosTotal} pasajeros</span>
            </div>
            <p className="helper">Actualiza la ocupación que verán los pasajeros en tiempo real.</p>
            <button className="btn amber" disabled={!enTurno} onClick={() => setControlAbierto(true)}>
              Abrir control rápido
            </button>
            <button className="btn ghost support-launch" disabled={!enTurno} onClick={() => setMockupAbierto(true)}>
              Ver mockup · celular bloqueado
            </button>
          </div>

          <Maletero vehiculo={vehiculo} maletero={maletero} />
        </>
      )}

      {pestana === 'radar' && (
        <Radar
          vehiculo={enMarcha ?? { ...vehiculo, posicion: api.posicionDe(vehiculo), asientosLibres: libres, maletero }}
          lineas={lineas}
          solicitudes={solicitudes}
          enTurno={enTurno}
        />
      )}

      {pestana === 'avisos' && (
        <div className="card">
          {avisos.length === 0 && <p className="empty">Sin avisos para tu línea.</p>}
          {avisos.map((a) => (
            <article className={`msg ${a.leido ? '' : 'unread'}`} key={a.id}>
              <div className="m-h"><b>{a.titulo}</b><time>{a.hora}</time></div>
              <p>{a.texto}</p>
              {!a.leido && (
                <button className="btn ghost sm" style={{ marginTop: '.5rem' }} onClick={() => api.marcarLeido(a.id)}>
                  Marcar como leído
                </button>
              )}
            </article>
          ))}
        </div>
      )}

      {pestana === 'jornada' && (
        <div className="card">
          <div className="lbl">Viajes pagados</div>
          <div className="big">{pagos.length}</div>
          {pagos.length === 0 && <p className="helper" style={{ marginTop: '.5rem' }}>Aún no se registran pagos en este vehículo.</p>}
          {pagos.map((p) => (
            <div className="kv" key={p.folio}>
              <span>Folio {p.folio} · {p.hora}</span>
              <b>${p.monto.toLocaleString('es-CL')}</b>
            </div>
          ))}
        </div>
      )}

      {controlAbierto && (
        <ControlRapido vehiculo={vehiculo} pasajeros={pasajeros} libres={libres} onCerrar={() => setControlAbierto(false)} />
      )}
      {mockupAbierto && (
        <MockupBloqueado
          vehiculo={vehiculo}
          pasajeros={pasajeros}
          enTurno={enTurno}
          maletero={maletero}
          solicitudes={solicitudes}
          onCerrar={() => setMockupAbierto(false)}
        />
      )}
    </main>
  );
}
