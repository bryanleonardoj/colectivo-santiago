import { NavLink } from 'react-router-dom';

const ENLACES = [
  { a: '/', icono: '⌂', texto: 'Inicio' },
  { a: '/pasajero', icono: '◎', texto: 'Pasajero' },
  { a: '/conductor', icono: '◉', texto: 'Conductor' },
  { a: '/admin', icono: '▦', texto: 'Admin' },
];

/** Barra fija inferior. El perfil activo lo marca `NavLink` con aria-current. */
export default function NavegacionInferior() {
  return (
    <nav className="mobile-nav" aria-label="Navegación principal">
      {ENLACES.map(({ a, icono, texto }) => (
        <NavLink key={a} to={a} end={a === '/'}>
          <span aria-hidden="true">{icono}</span>
          {texto}
        </NavLink>
      ))}
    </nav>
  );
}
