import { PrismaClient } from '@prisma/client';

// UC16.5 - Giá trị cấu hình hệ thống mặc định.
const prisma = new PrismaClient();

const DEFAULTS = [
  { key: 'returnWindowDays', value: '7', type: 'number', label: 'Thời hạn đổi/trả (ngày)', group: 'Chính sách', description: 'Số ngày Khách hàng được yêu cầu đổi/trả sau khi nhận hàng.' },
  { key: 'complaintGraceDays', value: '3', type: 'number', label: 'Thời gian kích hoạt khiếu nại (ngày)', group: 'Chính sách', description: 'Quá thời gian giao dự kiến + N ngày mới cho phép khiếu nại.' },
  { key: 'lowStockThreshold', value: '5', type: 'number', label: 'Ngưỡng cảnh báo tồn kho thấp (mặc định)', group: 'Kho vận', description: 'Dùng khi biến thể chưa đặt ngưỡng riêng.' },
  { key: 'freeShipThreshold', value: '500000', type: 'number', label: 'Ngưỡng miễn phí vận chuyển (đ)', group: 'Kho vận', description: 'Đơn đạt ngưỡng này được xét miễn phí vận chuyển.' },
  { key: 'siteName', value: 'DressSense', type: 'string', label: 'Tên hệ thống', group: 'Chung', description: 'Tên hiển thị của nền tảng.' },
  { key: 'supportEmail', value: 'support@dresssense.vn', type: 'string', label: 'Email hỗ trợ', group: 'Chung', description: 'Email CSKH hiển thị cho người dùng.' },
  { key: 'maintenanceMode', value: 'false', type: 'boolean', label: 'Chế độ bảo trì', group: 'Chung', description: 'Bật để tạm dừng một số chức năng khi bảo trì.' },
];

async function main() {
  let n = 0;
  for (const s of DEFAULTS) {
    await prisma.systemSetting.upsert({ where: { key: s.key }, update: {}, create: s });
    n++;
  }
  console.log(`[seed-setting] Đã đảm bảo ${n} tham số cấu hình hệ thống.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
