import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, /api é encaminhado para a API local (sem CORS).
// Em produção, VITE_API_URL aponta para a API publicada.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: { '/api': { target: env.VITE_API_PROXY ?? 'http://localhost:3333', changeOrigin: true } },
    },
    css: {
      // o Bootstrap 5.3 ainda usa @import; os avisos dele não ajudam aqui
      preprocessorOptions: { scss: { quietDeps: true, silenceDeprecations: ['import', 'global-builtin', 'color-functions'] } },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      css: false,
    },
  };
});
