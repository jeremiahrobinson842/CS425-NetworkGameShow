// client/vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // VITE_BASE_PATH lets us override the base for GitHub Pages/custom domains.
  // For GitHub Pages on a repo named "NetworkGameShow", base should be "/NetworkGameShow/".
  // For a custom domain, base should be "/".
  const env = loadEnv(mode, process.cwd(), '');
  const base =
    env.VITE_BASE_PATH ||
    (mode === 'production' ? '/NetworkGameShow/' : '/');

  return {
    base,
    plugins: [react()],
    server: {
      port: 5173,
      host: 'localhost'
    }
  };
});
