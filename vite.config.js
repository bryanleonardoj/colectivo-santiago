import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El plugin de React habilita Fast Refresh: al guardar un archivo la pantalla
// se actualiza sin perder el estado (el turno abierto, la pestaña elegida).
export default defineConfig({
  plugins: [react()],
});
