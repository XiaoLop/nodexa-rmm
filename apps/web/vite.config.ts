import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  const meshcentralTarget = process.env.VITE_MESHCENTRAL_PROXY_TARGET ?? 'http://localhost:8443';
  const rewriteMeshcentralPath = (path: string) =>
    path.startsWith('/api/auth/') ? path : path.replace(/^\/api/, '');

  return {
    plugins: [react()],
    build: {
      sourcemap: false,
    },
    css: {
      devSourcemap: false,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: meshcentralTarget,
          changeOrigin: true,
          ws: true,
          rewriteWsOrigin: true,
          rewrite: rewriteMeshcentralPath,
        },
        '/agent.ashx': {
          target: meshcentralTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  };
});
