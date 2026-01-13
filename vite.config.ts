
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // CRÍTICO: Define o caminho base como relativo. 
  // Isso permite que o app rode em subpastas (como no GitHub Pages) sem tela branca.
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true, // Ajuda a debugar erros em produção
  },
  server: {
    port: 3000,
  }
});
