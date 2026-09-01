import { useState } from 'react';
import * as api from '../nucleo/api.js';
import { useEstado } from '../nucleo/ganchos.js';
import { clp } from '../nucleo/util.js';
import { CONFIG } from '../config.js';

const PESTANAS = [
  { id: 'panel', texto: 'Panel' },
  { id: 'flota', texto: 'Flota' },
  { id: 'avisos', texto: 'Avisos' },
];

/** Formulario de difusión + historial de lo ya publicado (RF-09). */
function Avisos() {
  const [titulo, setTitulo] = useState('');
  const [texto, setTexto] = useState('');
  const [destino, setDestino] = useState('todas');
  const publicados = api.avisos();

  function publicar(e) {
    e.preventDefault();
    api.publicarAviso({ titulo, texto, destino });
    setTitulo('');
    setTexto('');
  }

  return (
    <>
      <form className="card" onSubmit={publicar}>
        <h3>Nuevo aviso</h3>
        <select value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Destinatarios del aviso">
          <option value="todas">Toda la asociación</option>
          {api.obtenerLineas().map((l) => (
            <option key={l.id} value={l.id}>Solo línea {l.id}</option>
          ))}
        </select>
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" aria-label="Título del aviso" />
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Mensaje" aria-label="Mensaje del aviso" />
        <button className="btn amber" type="submit" disabled={!titulo.trim() && !texto.trim()}>
          Publicar aviso
        </button>
      </form>

      <div className="card">
        <div className="lbl">Publicados · {api.avisosSinLeer()} sin leer</div>
        {publicados.length === 0 && <p className="empty">Todavía no se ha publicado ningún aviso.</p>}
        {[...publicados].reverse().map((a) => (
          <article className={`msg ${a.leido ? '' : 'unread'}`} key={a.id} style={{ marginTop: '.55rem' }}>
            <div className="m-h"><b>{a.titulo}</b><time>{a.hora}</time></div>
            <p>{a.texto}</p>
            <small style={{ color: 'var(--ink3)', fontSize: '.66rem' }}>
              {a.destino === 'todas' ? 'Toda la asociación' : `Línea ${a.destino}`}
            </small>
          </article>
        ))}
      </div>
    </>
  );
}

export default function Admin() {
  useEstado();                       // repinta con cada cambio del estado compartido
  const [pestana, setPestana] = useState('panel');
  const k = api.indicadores();

  return (
    <main className="shell">
      <div className="card">
        <div className="lbl">ADMINISTRACIÓN</div>
        <h1>Asoc. Santiago Sur</h1>
        <div className="tabs" role="tablist">
          {PESTANAS.map((p) => (
            <button key={p.id} role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)}>
              {p.texto}
            </button>
          ))}
        </div>
      </div>

      {pestana === 'panel' && (
        <>
          <div className="kpis">
            <div className="kpi">
              <div className="lbl">En turno</div>
              <div className="big">{k.enTurno}<span style={{ fontSize: '.9rem', color: 'var(--ink3)' }}> / {k.total}</span></div>
            </div>
            <div className="kpi"><div className="lbl">Ocupación</div><div className="big">{k.ocupacion}%</div></div>
            <div className="kpi"><div className="lbl">Pagos hoy</div><div className="big">{k.pagos}</div></div>
            <div className="kpi"><div className="lbl">Recaudado</div><div className="big">{clp(k.recaudado)}</div></div>
          </div>

          <div className={`card ${k.sinCobertura ? 'alerta' : ''}`}>
            <div className="lbl">Demanda en la calle</div>
            <div className="kv"><span>Solicitudes activas</span><b>{k.solicitudes}</b></div>
            <div className="kv">
              <span>Sin ningún vehículo capaz</span>
              <b style={{ color: k.sinCobertura ? 'var(--bad)' : 'var(--ok)' }}>{k.sinCobertura}</b>
            </div>
            <div className="kv"><span>En turno con maletero para silla</span><b>{k.conEspacioSilla}</b></div>
            <p className="helper" style={{ marginTop: '.6rem' }}>
              {k.sinCobertura > 0
                ? 'Hay gente esperando que ningún colectivo en servicio puede tomar. Es demanda que la asociación está dejando pasar.'
                : 'Toda la demanda declarada tiene al menos un vehículo capaz de atenderla.'}
            </p>
          </div>
        </>
      )}

      {pestana === 'flota' && (
        <div className="card">
          {api.flota().map((v) => (
            <div className="kv" key={v.id}>
              <span>
                <b style={{ color: 'var(--ink)' }}>{v.patente}</b> · {v.linea}
                {v.maletero !== 'no' && (
                  <span title={v.maletero === 'silla' ? 'Maletero para silla de ruedas' : 'Maletero para equipaje'}>
                    {' '}{CONFIG.MALETERO[v.maletero].icono}
                  </span>
                )}
              </span>
              <b>
                <span className={`pill ${v.enTurno ? 'on' : 'off'}`}><i />{v.enTurno ? 'EN TURNO' : 'FUERA'}</span>
              </b>
            </div>
          ))}
        </div>
      )}

      {pestana === 'avisos' && <Avisos />}
    </main>
  );
}
