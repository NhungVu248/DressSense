import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api -> backend (http://localhost:4000) khi chạy dev
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
