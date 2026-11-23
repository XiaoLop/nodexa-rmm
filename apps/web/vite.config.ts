import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, isPreview, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const meshcentralTarget = env.MESHCENTRAL_PROXY_TARGET?.trim();
  if (command === 'serve' && !isPreview && mode !== 'test' && !meshcentralTarget) {
    throw new Error(
      'Set MESHCENTRAL_PROXY_TARGET in apps/web/.env.local before starting Web development.',
    );
  }
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
      proxy: meshcentralTarget
        ? {
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
          }
        : undefined,
    },
  };
});
