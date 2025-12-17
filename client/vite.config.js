// client/vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const base =
    env.VITE_BASE_PATH ||
    (mode === 'production' ? '/CS425-NetworkGameShow/' : '/');

  return {
    base,
    plugins: [react()],
    server: {
      port: 5173,
      host: 'localhost'
    }
  };
});
