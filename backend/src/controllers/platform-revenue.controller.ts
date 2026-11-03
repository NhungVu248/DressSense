import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { getPlatformFeeRate, platformFeeOfOrder } from '../services/revenue.service';

// ============================================================
//  Backlog C.42 - Quản lý doanh thu của SÀN (chỉ Quản trị viên).
//  Doanh thu sàn = phí hoa hồng thu từ người bán + phí chạy banner quảng cáo.
//  (Doanh thu banner được bổ sung khi cụm "Banner quảng cáo" hoàn tất.)
// ============================================================

function resolveRange(q: any): { from: Date; to: Date; preset: string } {
  const now = new Date();
  const preset = typeof q.preset === 'string' ? q.preset : q.from ? 'custom' : '30d';
  const to = q.to ? new Date(String(q.to)) : now;
  let from: Date;
  if (q.from) from = new Date(String(q.from));
  else {
    from = new Date(now);
    if (preset === 'today') from.setHours(0, 0, 0, 0);
    else if (preset === '7d') { from.setDate(now.getDate() - 6); from.setHours(0, 0, 0, 0); }
    else if (preset === 'month') from = new Date(now.getFullYear(), now.getMonth(), 1);
    else { from.setDate(now.getDate() - 29); from.setHours(0, 0, 0, 0); }
  }
  return { from, to, preset };
}

// GET /api/admin/platform-revenue?preset=30d | from=&to=
export async function getPlatformRevenue(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to, preset } = resolveRange(req.query);
    if (isNaN(+from) || isNaN(+to) || from > to) return res.status(400).json({ message: 'Khoảng thời gian không hợp lệ.' });

    const feeRate = await getPlatformFeeRate();

    const orders = await prisma.order.findMany({
      where: { status: { notIn: ['CANCELLED', 'AWAITING_PAYMENT'] }, createdAt: { gte: from, lte: to } },
      select: { id: true, sellerId: true, total: true, subtotal: true, discount: true, taxAmount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Tổng hợp toàn sàn + chuỗi theo ngày
    let gmv = 0; // tổng giá trị giao dịch (khách trả)
    let taxTotal = 0; // VAT thu hộ nhà nước
    let commissionTotal = 0; // hoa hồng sàn thu từ người bán
    const byDay = new Map<string, number>();
    const byShop = new Map<number, { gmv: number; commission: number }>();
    for (const o of orders) {
      const fee = platformFeeOfOrder(o, feeRate);
      gmv += o.total;
      taxTotal += o.taxAmount;
      commissionTotal += fee;
      const k = o.createdAt.toISOString().slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + fee);
      if (o.sellerId) {
        const s = byShop.get(o.sellerId) ?? { gmv: 0, commission: 0 };
        s.gmv += o.total; s.commission += fee; byShop.set(o.sellerId, s);
      }
    }

    // Doanh thu banner quảng cáo trong kỳ (phí đã thanh toán) - nếu model đã có
    const bannerRevenue = await bannerFeeInRange(from, to);

    // Hoàn tiền (giảm doanh thu người bán, không ảnh hưởng phí sàn)
    const refundAgg = await prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: { kind: 'REFUND', status: { in: ['PAID', 'REFUNDED'] }, createdAt: { gte: from, lte: to } },
    });
    const refundTotal = refundAgg._sum.amount ?? 0;

    const platformIncome = commissionTotal + bannerRevenue; // tổng thu của sàn
    const sellerNet = gmv - taxTotal - commissionTotal - refundTotal; // tổng thực nhận của người bán

    const commissionSeries = [...byDay.entries()].sort().map(([date, commission]) => ({ date, commission }));

    // Bảng theo gian hàng (top theo hoa hồng)
    const shopIds = [...byShop.keys()];
    const shops = shopIds.length
      ? await prisma.shop.findMany({ where: { ownerId: { in: shopIds } }, select: { ownerId: true, name: true } })
      : [];
    const shopName = new Map(shops.map((s) => [s.ownerId, s.name] as const));
    const byShopRows = [...byShop.entries()]
      .map(([sellerId, v]) => ({ sellerId, shopName: shopName.get(sellerId) ?? `Gian hàng #${sellerId}`, gmv: v.gmv, commission: v.commission }))
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 20);

    res.json({
      range: { from, to, preset },
      feeRate,
      metrics: { gmv, taxTotal, commissionTotal, bannerRevenue, platformIncome, refundTotal, sellerNet, orderCount: orders.length },
      commissionSeries,
      byShop: byShopRows,
    });
  } catch (err) { next(err); }
}

// Tổng phí banner đã thanh toán trong kỳ. Bảo vệ bằng try/catch để không phụ thuộc
// vào việc model BannerOrder đã tồn tại hay chưa (bổ sung ở cụm Banner quảng cáo).
async function bannerFeeInRange(from: Date, to: Date): Promise<number> {
  try {
    const anyPrisma = prisma as any;
    if (!anyPrisma.bannerOrder) return 0;
    const agg = await anyPrisma.bannerOrder.aggregate({
      _sum: { amount: true },
      where: { paymentStatus: 'PAID', paidAt: { gte: from, lte: to } },
    });
    return agg._sum.amount ?? 0;
  } catch {
    return 0;
  }
}
