import { prisma } from '../lib/prisma';
import { finalizeStock } from './order.service';
import { notify } from './notification.service';
import { dispatchCampaign } from '../controllers/campaign.controller';

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

// UC13 - vòng đời khuyến mãi: tự chuyển trạng thái voucher/flash/banner theo thời gian.
// SCHEDULED -> RUNNING khi tới giờ bắt đầu; RUNNING -> ENDED khi hết giờ (hoặc Flash hết suất).
export async function runPromoLifecycle(): Promise<void> {
  const now = new Date();
  try {
    // Kích hoạt khi tới giờ
    await prisma.voucher.updateMany({ where: { status: 'SCHEDULED', startsAt: { lte: now } }, data: { status: 'RUNNING' } });
    await prisma.flashSale.updateMany({ where: { status: 'SCHEDULED', startsAt: { lte: now } }, data: { status: 'RUNNING' } });
    await prisma.banner.updateMany({ where: { status: 'SCHEDULED', startsAt: { lte: now } }, data: { status: 'RUNNING' } });
    // Kết thúc khi hết giờ
    await prisma.voucher.updateMany({ where: { status: 'RUNNING', endsAt: { lt: now } }, data: { status: 'ENDED' } });
    await prisma.flashSale.updateMany({ where: { status: 'RUNNING', endsAt: { lt: now } }, data: { status: 'ENDED' } });
    await prisma.banner.updateMany({ where: { status: 'RUNNING', endsAt: { lt: now } }, data: { status: 'ENDED' } });
    // Flash Sale hết suất -> kết thúc (SP trở về giá bán thường)
    const soldOut = await prisma.flashSale.findMany({ where: { status: 'RUNNING' }, select: { id: true, quantity: true, soldCount: true } });
    const doneIds = soldOut.filter((s) => s.soldCount >= s.quantity).map((s) => s.id);
    if (doneIds.length) await prisma.flashSale.updateMany({ where: { id: { in: doneIds } }, data: { status: 'ENDED' } });

    // UC13.3 - gửi các chiến dịch đã tới giờ lên lịch
    const due = await prisma.campaign.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } }, select: { id: true } });
    for (const c of due) await dispatchCampaign(c.id).catch(() => {});
  } catch {
    /* lỗi vòng đời khuyến mãi không chặn tác vụ khác */
  }
}

// Khởi động bộ hẹn giờ: chạy ngay một lượt rồi lặp lại theo chu kỳ
export function startScheduler() {
  runAutoComplete().catch(() => {});
  runPromoLifecycle().catch(() => {});
  setInterval(() => { runAutoComplete().catch(() => {}); runPromoLifecycle().catch(() => {}); }, RUN_EVERY_MS);
  console.log(`[scheduler] đã bật - tự hoàn tất đơn + vòng đời khuyến mãi (mỗi ${RUN_EVERY_MS / 60000} phút).`);
}
