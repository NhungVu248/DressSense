import { prisma } from '../src/lib/prisma';
import { generateOrderCommissions } from '../src/services/commission.service';

// ============================================================
//  Seed hoa hồng:
//   1) Đảm bảo có chính sách hoa hồng MẶC ĐỊNH (toàn sàn) đang hiệu lực,
//      lấy tỷ lệ từ setting platformFeeRate (mặc định 5%).
//   2) Backfill hoa hồng cho các đơn đã COMPLETED trước đó (idempotent).
// ============================================================

async function ensureDefaultPolicy(): Promise<number> {
  const now = new Date();
  const existing = await prisma.commissionPolicy.findFirst({
    where: { status: 'ACTIVE', categoryId: null, effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }] },
  });
  if (existing) return existing.commissionRate;

  const setting = await prisma.systemSetting.findUnique({ where: { key: 'platformFeeRate' } });
  const rate = setting ? Number(setting.value) || 5 : 5;
  await prisma.commissionPolicy.create({
    data: {
      name: 'Hoa hồng mặc định toàn sàn',
      categoryId: null,
      commissionRate: rate,
      effectiveFrom: new Date('2020-01-01T00:00:00Z'), // phủ toàn bộ đơn cũ
      effectiveTo: null,
      status: 'ACTIVE',
      note: 'Chính sách mặc định sinh tự động từ cấu hình platformFeeRate.',
    },
  });
  console.log(`[seed-commission] Tạo chính sách mặc định ${rate}%.`);
  return rate;
}

async function backfillCompletedOrders(): Promise<number> {
  const orders = await prisma.order.findMany({ where: { status: 'COMPLETED', sellerId: { not: null } }, select: { id: true } });
  let done = 0;
  for (const o of orders) {
    const before = await prisma.orderCommission.count({ where: { orderId: o.id } });
    if (before > 0) continue;
    await generateOrderCommissions(prisma, o.id);
    done++;
  }
  return done;
}

async function main() {
  await ensureDefaultPolicy();
  const filled = await backfillCompletedOrders();
  console.log(`[seed-commission] Backfill hoa hồng cho ${filled} đơn đã hoàn tất.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
