import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import 'leaflet/dist/leaflet.css';
import './css/tokens.css';
import './css/base.css';
import './css/componentes.css';
import './css/mapa.css';
import './css/app.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
