import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxy /api + /uploads -> backend (http://localhost:4000) để frontend và API CÙNG ORIGIN.
// Nhờ vậy chỉ cần MỘT tunnel ngrok trỏ vào cổng 5173 là công khai được cả app (HTTPS ở biên ngrok).
// Đích backend có thể đổi qua VITE_PROXY_TARGET (mặc định cổng 4000).
const TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:4000';
const proxy = {
  '/api': { target: TARGET, changeOrigin: true },
  '/uploads': { target: TARGET, changeOrigin: true },
};

export default defineConfig({
  plugins: [react()],
  // allowedHosts: true -> cho phép truy cập qua tên miền ngrok (vd *.ngrok-free.app).
  // Có thể thay bằng danh sách tên miền cụ thể nếu muốn chặt hơn.
  server: { host: true, port: 5173, allowedHosts: true, proxy },
  preview: { host: true, port: 5173, allowedHosts: true, proxy },
});
