import { Route, Routes } from 'react-router-dom';
import NavegacionInferior from './componentes/NavegacionInferior.jsx';
import Inicio from './paginas/Inicio.jsx';
import Pasajero from './paginas/Pasajero.jsx';
import Conductor from './paginas/Conductor.jsx';
import Admin from './paginas/Admin.jsx';

/**
 * App.jsx — solo el enrutado y el armazón común.
 * Cada perfil vive en su propio archivo dentro de `paginas/`.
 */
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/pasajero" element={<Pasajero />} />
        <Route path="/conductor" element={<Conductor />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <NavegacionInferior />
    </>
  );
}
