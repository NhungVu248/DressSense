import { prisma } from '../lib/prisma';
import { finalizeStock } from './order.service';
import { notify } from './notification.service';

// ============================================================
//  Tác vụ định kỳ (in-process scheduler).
//  UC10.3 7a - tự động Hoàn tất đơn Đã giao sau thời hạn nếu khách không xác nhận.
// ============================================================

const AUTO_COMPLETE_DAYS = 7;          // số ngày sau "Đã giao" thì tự hoàn tất
const RUN_EVERY_MS = 60 * 60 * 1000;   // chạy mỗi giờ

// Chạy một lượt tự hoàn tất; trả về số đơn đã xử lý (export để kiểm thử/gọi thủ công)
export async function runAutoComplete(): Promise<number> {
  const cutoff = new Date(Date.now() - AUTO_COMPLETE_DAYS * 86400_000);
  const orders = await prisma.order.findMany({
    where: { status: 'DELIVERED', deliveredAt: { lte: cutoff } },
    include: { items: true },
  });
  for (const o of orders) {
    try {
      await prisma.$transaction(async (db) => {
        await db.order.update({ where: { id: o.id }, data: { status: 'COMPLETED', completedAt: new Date() } });
        await finalizeStock(db, o.items); // chốt tồn kho như khi khách xác nhận nhận hàng
      });
      notify(o.userId, 'ORDER', 'Đơn hàng đã hoàn tất', `Đơn ${o.code} được tự động hoàn tất sau ${AUTO_COMPLETE_DAYS} ngày kể từ khi giao.`, `/orders/${o.id}`);
    } catch {
      /* lỗi một đơn không chặn các đơn khác */
    }
  }
  if (orders.length) console.log(`[scheduler] auto-completed ${orders.length} đơn hàng.`);
  return orders.length;
}

// Khởi động bộ hẹn giờ: chạy ngay một lượt rồi lặp lại theo chu kỳ
export function startScheduler() {
  runAutoComplete().catch(() => {});
  setInterval(() => { runAutoComplete().catch(() => {}); }, RUN_EVERY_MS);
  console.log(`[scheduler] đã bật - tự hoàn tất đơn Đã giao quá ${AUTO_COMPLETE_DAYS} ngày (mỗi ${RUN_EVERY_MS / 60000} phút).`);
}
