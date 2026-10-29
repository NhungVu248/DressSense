import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC16.1 - Dashboard quản trị (chỉ tổng hợp & điều hướng).
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

export async function getAdminDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to, preset } = resolveRange(req.query);
    if (isNaN(+from) || isNaN(+to) || from > to) return res.status(400).json({ message: 'Khoảng thời gian không hợp lệ.' });

    // KPI tổng (không phụ thuộc thời gian) + theo kỳ
    const [customers, sellers, activeShops, activeProducts] = await Promise.all([
      prisma.user.count({ where: { role: 'CUSTOMER' } }),
      prisma.user.count({ where: { role: 'SELLER' } }),
      prisma.shop.count({ where: { status: 'ACTIVE' } }),
      prisma.product.count({ where: { status: 'ACTIVE', deletedAt: null } }),
    ]);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });
    const valid = orders.filter((o) => o.status !== 'CANCELLED' && o.status !== 'AWAITING_PAYMENT');
    const revenue = valid.reduce((s, o) => s + o.total, 0);
    const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED').length;
    const refundAgg = await prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: { kind: 'REFUND', status: { in: ['PAID', 'REFUNDED'] }, createdAt: { gte: from, lte: to } },
    });
    const refundAmount = refundAgg._sum.amount ?? 0;

    // Mục cần xử lý (điều hướng tới UC tương ứng)
    const [pendingShops, pendingProducts, escalatedComplaints, hiddenReviews] = await Promise.all([
      prisma.shop.count({ where: { status: { in: ['PENDING', 'NEEDS_INFO'] } } }),
      prisma.product.count({ where: { status: 'PENDING', deletedAt: null } }),
      prisma.complaint.count({ where: { status: 'ESCALATED' } }),
      prisma.review.count({ where: { status: 'HIDDEN' } }),
    ]);

    // Biểu đồ
    const byDay = new Map<string, number>();
    for (const o of valid) { const k = o.createdAt.toISOString().slice(0, 10); byDay.set(k, (byDay.get(k) ?? 0) + o.total); }
    const revenueSeries = [...byDay.entries()].sort().map(([date, revenue]) => ({ date, revenue }));

    const newUsers = await prisma.user.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { createdAt: true } });
    const uDay = new Map<string, number>();
    for (const u of newUsers) { const k = u.createdAt.toISOString().slice(0, 10); uDay.set(k, (uDay.get(k) ?? 0) + 1); }
    const newUserSeries = [...uDay.entries()].sort().map(([date, count]) => ({ date, count }));

    const prod = new Map<number, { productId: number; name: string; quantity: number; revenue: number }>();
    for (const o of valid) for (const it of o.items) {
      const p = prod.get(it.productId) ?? { productId: it.productId, name: it.name ?? `SP #${it.productId}`, quantity: 0, revenue: 0 };
      p.quantity += it.quantity; p.revenue += it.price * it.quantity; prod.set(it.productId, p);
    }
    const bestSellers = [...prod.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);

    res.json({
      range: { from, to, preset },
      kpis: { customers, sellers, activeShops, activeProducts, totalOrders: valid.length, revenue, cancelledOrders, refundAmount },
      todo: { pendingShops, pendingProducts, escalatedComplaints, hiddenReviews },
      revenueSeries, newUserSeries, bestSellers,
    });
  } catch (err) { next(err); }
}
