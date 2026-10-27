import { createApp } from './app';
import { env } from './config/env';
import { startScheduler } from './services/scheduler';

const app = createApp();

app.listen(env.port, () => {
  console.log(`🚀 DressSense API đang chạy tại http://localhost:${env.port}`);
  console.log(`   Health check: http://localhost:${env.port}/api/health`);
  startScheduler(); // UC10.3 7a - tự động hoàn tất đơn theo thời hạn
});
