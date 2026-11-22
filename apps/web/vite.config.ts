import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const meshcentralTarget = env.MESHCENTRAL_PROXY_TARGET || 'https://mesh.xiaonext.com';
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
        },
        '^/(?:[^/]+/)?agent[.]ashx(?:[?]|$)': {
          target: meshcentralTarget,
          changeOrigin: true,
          ws: true,
        },
        '^/(?:[^/]+/)?(?:meshagents|meshsettings|meshosxagent)(?:[?]|$)': {
          target: meshcentralTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
