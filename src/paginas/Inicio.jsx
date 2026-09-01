import { Link } from 'react-router-dom';

const PERFILES = [
  { a: '/pasajero', lbl: 'Buscar viaje', titulo: 'Pasajero', desc: 'Ve colectivos 3012 y 2012 cerca de tu ubicación.' },
  { a: '/conductor', lbl: 'Gestionar recorrido', titulo: 'Conductor', desc: 'Actualiza tu turno y los asientos disponibles.' },
  { a: '/admin', lbl: 'Coordinar servicio', titulo: 'Administración', desc: 'Supervisa la operación y comunica novedades.' },
];

export default function Inicio() {
  return (
    <main className="shell">
      <span className="kicker">Red suroriente · Santiago</span>
      <h1>Tu colectivo, más cerca.</h1>
      <p style={{ maxWidth: '62ch', color: 'var(--ink2)', lineHeight: 1.6 }}>
        Consulta recorridos activos entre Peñalolén, La Florida, La Granja y La Pintana.
      </p>
      <div className="profile-list">
        {PERFILES.map(({ a, lbl, titulo, desc }) => (
          <Link className="card" to={a} key={a}>
            <div className="lbl">{lbl}</div>
            <h2>{titulo}</h2>
            <p>{desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
