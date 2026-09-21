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
        // target: 'https://47.108.250.245:8888',
        target: 'https://mesh.xiaonext.com',
        changeOrigin: true,
        ws: true,
        cookieDomainRewrite: '', // cookie 域名重写
        cookiePathRewrite: '/api', // cookie 路径重写
        rewrite: (path) => path.replace(/^\/api/, '')
      },
    },
  },
});
