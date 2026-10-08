import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  const meshcentralTarget = 'https://mesh.xiaonext.com';
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
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/agent.ashx': {
          target: meshcentralTarget,
          changeOrigin: true,
          ws: true,
        },
        '/meshagents': {
          target: meshcentralTarget,
          changeOrigin: true
        }
      },
    },
  };
});
