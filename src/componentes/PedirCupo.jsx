import * as api from '../nucleo/api.js';
import { CONFIG } from '../config.js';

/**
 * PedirCupo.jsx — el pasajero declara qué necesita antes de esperar en la calle.
 *
 * Son dos datos: cuántos van y qué tiene que caber en el maletero. Con eso el
 * sistema puede hacer algo que hoy nadie hace en la calle: mostrar solo los
 * colectivos que de verdad pueden parar por ellos.
 *
 * La silla de ruedas es del pasajero y viaja plegada en el maletero. Por eso
 * no es una opción aparte del maletero, sino el tamaño más grande que se le
 * puede pedir.
 */

const MAXIMO = CONFIG.ASIENTOS_POR_VEHICULO;

const OPCIONES_MALETERO = [
  { clave: 'no', icono: '🚶', titulo: 'Nada', desc: 'Viajamos sin bultos' },
  { clave: 'equipaje', icono: '🧳', titulo: 'Equipaje', desc: 'Maleta o bulto grande' },
  { clave: 'silla', icono: '♿', titulo: 'Mi silla de ruedas', desc: 'Va plegada en el maletero' },
];

/** Resume en texto lo que se pidió, para reutilizarlo en varias pantallas. */
export function describir({ personas, maletero }) {
  const gente = `${personas} ${personas === 1 ? 'persona' : 'personas'}`;
  if (maletero === 'silla') return `${gente} · silla de ruedas en el maletero`;
  if (maletero === 'equipaje') return `${gente} · equipaje en el maletero`;
  return gente;
}

/** Formulario: cantidad de personas y qué debe caber en el maletero. */
export function FormularioCupo({ necesidad, onCambio, onPedir, aptos }) {
  const { personas, maletero } = necesidad;

  return (
    <div className="card cupo-card">
      <div className="lbl">¿Cuántos van?</div>
      <div className="cupo-personas" role="group" aria-label="Cantidad de personas">
        {Array.from({ length: MAXIMO }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            className="cupo-num"
            aria-pressed={personas === n}
            onClick={() => onCambio({ ...necesidad, personas: n })}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="lbl" style={{ marginTop: '.9rem' }}>¿Qué llevan en el maletero?</div>
      <div className="cupo-extras" role="group" aria-label="Qué debe caber en el maletero">
        {OPCIONES_MALETERO.map(({ clave, icono, titulo, desc }) => (
          <button
            key={clave}
            className="cupo-extra"
            aria-pressed={maletero === clave}
            onClick={() => onCambio({ ...necesidad, maletero: clave })}
          >
            <span aria-hidden="true">{icono}</span>
            <b>{titulo}</b>
            <small>{desc}</small>
          </button>
        ))}
      </div>

      <p className="helper" style={{ marginTop: '.8rem' }}>
        {aptos === 0
          ? 'Ningún colectivo en servicio puede tomarlos ahora mismo. Puedes pedir igual y quedas esperando.'
          : `${aptos} ${aptos === 1 ? 'colectivo puede' : 'colectivos pueden'} tomarlos con lo que pediste.`}
      </p>

      <button className="btn amber" onClick={onPedir}>Pedir cupo acá</button>
    </div>
  );
}

/**
 * Estado de una solicitud ya hecha.
 *
 * Mientras nadie apto viene cerca, el pasajero ve cuántos podrían tomarlo —
 * nunca un rechazo, porque el conductor que no puede jamás vio la solicitud.
 * Cuando uno apto entra en la ventana de aviso, aparece su patente.
 */
export function EstadoCupo({ solicitud, onRetirar }) {
  const enCamino = api.vehiculoEnCamino(solicitud);
  const aptos = api.aptosPara(solicitud, solicitud.linea);

  return (
    <div className={`card cupo-estado ${enCamino ? 'is-asignado' : ''}`}>
      <div className="lbl">{enCamino ? 'Viene en camino' : 'Esperando colectivo'}</div>

      {enCamino ? (
        <>
          <div className="cupo-patente">{enCamino.patente}</div>
          <div className="kv"><span>Línea</span><b>{enCamino.linea}</b></div>
          <div className="kv"><span>Conductor</span><b>{enCamino.conductor}</b></div>
          <div className="kv"><span>Llega en</span><b>{enCamino.eta} min</b></div>
          <p className="helper" style={{ marginTop: '.6rem' }}>
            {solicitud.maletero === 'silla'
              ? 'Su maletero da para tu silla. Hazle el alto cuando lo veas.'
              : 'Tiene el espacio que pediste. Hazle el alto cuando lo veas.'}
          </p>
        </>
      ) : (
        <>
          <div className="big">{aptos}</div>
          <p className="helper">
            {aptos === 0
              ? 'Ningún colectivo con ese espacio está en servicio. Seguimos buscando.'
              : `${aptos === 1 ? 'colectivo puede' : 'colectivos pueden'} tomarlos. Te mostramos la patente cuando uno esté a menos de ${CONFIG.REVELAR_PATENTE_MIN} minutos.`}
          </p>
        </>
      )}

      <div className="cupo-etiquetas">
        <span className="pill warn">{describir(solicitud)}</span>
      </div>

      <button className="btn ghost sm" style={{ marginTop: '.7rem' }} onClick={onRetirar}>
        Retirar solicitud
      </button>
    </div>
  );
}
