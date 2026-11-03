import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getNumberSetting } from './settings.service';

// ============================================================
//  Dịch vụ hoa hồng sàn (mục 2/5 - quản lý hoa hồng & đối soát).
//  - Hoa hồng ghi nhận theo TỪNG dòng hàng khi đơn COMPLETED (CONFIRMED).
//  - base_amount = hàng CHƯA thuế, SAU giảm giá (phân bổ theo tỷ trọng dòng).
//  - Tỷ lệ áp dụng: chính sách theo danh mục > chính sách mặc định > setting cũ.
//  - Không tính hoa hồng hai lần (idempotent theo orderId).
// ============================================================

type Db = Prisma.TransactionClient | typeof prisma;

export interface ResolvedRate {
  rate: number; // % (vd 5 = 5%)
  policyId: number | null; // chính sách đã áp dụng (null nếu dùng setting mặc định)
}

// 2.1 - Xác định tỷ lệ hoa hồng áp dụng cho một danh mục tại một thời điểm.
// Ưu tiên: chính sách theo danh mục đang hiệu lực > chính sách mặc định (categoryId null) > setting platformFeeRate.
export async function resolveCommissionRate(categoryId: number | null, at: Date, db: Db = prisma): Promise<ResolvedRate> {
  const effective = {
    status: 'ACTIVE' as const,
    effectiveFrom: { lte: at },
    OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
  };
  if (categoryId != null) {
    const p = await db.commissionPolicy.findFirst({ where: { ...effective, categoryId }, orderBy: { effectiveFrom: 'desc' } });
    if (p) return { rate: p.commissionRate, policyId: p.id };
  }
  const def = await db.commissionPolicy.findFirst({ where: { ...effective, categoryId: null }, orderBy: { effectiveFrom: 'desc' } });
  if (def) return { rate: def.commissionRate, policyId: def.id };
  const fallback = await getNumberSetting('platformFeeRate', 0);
  return { rate: fallback > 0 ? fallback : 0, policyId: null };
}

// Mục 4 - Ghi nhận hoa hồng khi đơn hoàn tất. Idempotent: bỏ qua nếu đơn đã có bản ghi.
export async function generateOrderCommissions(db: Db, orderId: number): Promise<void> {
  const existing = await db.orderCommission.count({ where: { orderId } });
  if (existing > 0) return; // không tính hai lần

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: { select: { categoryId: true } } } } },
  });
  if (!order || !order.sellerId) return;

  // base pool của cả đơn = hàng chưa thuế, sau giảm giá
  const basePool = Math.max(0, order.subtotal - order.discount - order.taxAmount);
  const lineTotal = order.items.reduce((s, it) => s + it.price * it.quantity, 0);
  const at = order.completedAt ?? new Date();

  const rows: Prisma.OrderCommissionCreateManyInput[] = [];
  let allocated = 0;
  for (let i = 0; i < order.items.length; i++) {
    const it = order.items[i];
    const line = it.price * it.quantity;
    // phân bổ theo tỷ trọng dòng; dòng cuối nhận phần dư để tránh lệch do làm tròn
    const isLast = i === order.items.length - 1;
    const base = isLast ? Math.max(0, basePool - allocated) : (lineTotal > 0 ? Math.round((basePool * line) / lineTotal) : 0);
    if (!isLast) allocated += base;
    const { rate, policyId } = await resolveCommissionRate(it.product?.categoryId ?? null, at, db);
    rows.push({
      orderId,
      orderItemId: it.id,
      sellerId: order.sellerId,
      categoryId: it.product?.categoryId ?? null,
      policyId,
      baseAmount: base,
      commissionRate: rate,
      commissionAmount: Math.round((base * rate) / 100),
      method: order.paymentMethod,
      status: 'CONFIRMED',
    });
  }
  if (rows.length) await db.orderCommission.createMany({ data: rows });
}

// Mục 4 - Điều chỉnh hoa hồng khi trả hàng (chỉ phần hàng được hoàn).
// Giả định xử lý một yêu cầu trả cho mỗi dòng (ràng buộc "1 yêu cầu đang xử lý/mục" ở UC11.1).
// Khoản đã đưa vào đợt đối soát (settlementId != null) được bỏ qua để Admin điều chỉnh đợt sau.
export async function adjustCommissionsForReturn(db: Db, orderId: number, items: { orderItemId: number; quantity: number }[]): Promise<void> {
  for (const it of items) {
    const oc = await db.orderCommission.findFirst({ where: { orderId, orderItemId: it.orderItemId, status: 'CONFIRMED' } });
    if (!oc || oc.settlementId) continue;
    const oi = await db.orderItem.findUnique({ where: { id: it.orderItemId } });
    if (!oi || oi.quantity <= 0) continue;
    const remainingQty = Math.max(0, oi.quantity - it.quantity);
    const newBase = Math.round((oc.baseAmount * remainingQty) / oi.quantity);
    await db.orderCommission.update({
      where: { id: oc.id },
      data: {
        baseAmount: newBase,
        commissionAmount: Math.round((newBase * oc.commissionRate) / 100),
        status: remainingQty === 0 ? 'REFUNDED' : 'CONFIRMED',
        note: `Điều chỉnh hoàn ${it.quantity}/${oi.quantity} sản phẩm`,
      },
    });
  }
}

// Giá trị hàng được quyết toán của một đơn (net phần hàng) = hàng chưa thuế sau giảm giá − hoàn tiền.
// Dùng cho đối soát: online -> sàn phải trả Seller số này; COD -> chỉ dùng để hiển thị.
export function orderSettlementGoods(subtotal: number, discount: number, taxAmount: number): number {
  return Math.max(0, subtotal - discount - taxAmount);
}
