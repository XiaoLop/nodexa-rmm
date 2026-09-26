import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  const gatewayTarget = process.env.VITE_GATEWAY_PROXY_TARGET ?? 'http://localhost:3000';
  const meshcentralTarget = process.env.VITE_MESHCENTRAL_PROXY_TARGET ?? 'http://localhost:8443';
  const stripApiPrefix = (path: string) => path.replace(/^\/api/, '');

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
        '/api/login': {
          target: gatewayTarget,
          changeOrigin: false,
        },
        '/api/control.ashx': {
          target: meshcentralTarget,
          changeOrigin: true,
          ws: true,
          rewriteWsOrigin: true,
          rewrite: stripApiPrefix,
        },
        '/api/meshrelay.ashx': {
          target: meshcentralTarget,
          changeOrigin: true,
          ws: true,
          rewriteWsOrigin: true,
          rewrite: stripApiPrefix,
        },
        '/api/meshagents': {
          target: meshcentralTarget,
          changeOrigin: true,
          rewrite: stripApiPrefix,
        },
        '/api/logout': {
          target: meshcentralTarget,
          changeOrigin: true,
          rewrite: stripApiPrefix,
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
