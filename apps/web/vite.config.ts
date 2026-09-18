import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
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
        target: 'https://mesh.xiaonext.com',
        changeOrigin: true,
        ws: true,
        cookieDomainRewrite: '',
        cookiePathRewrite: '/api',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
