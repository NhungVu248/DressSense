import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  UC14.4 - Báo cáo doanh thu gian hàng (chỉ dữ liệu của Người bán).
//  Doanh thu tính từ đơn hợp lệ; đơn hủy không tính; hoàn tiền phản ánh vào báo cáo.
// ============================================================

function resolveRange(q: any): { from: Date; to: Date; preset: string } {
  const now = new Date();
  const preset = typeof q.preset === 'string' ? q.preset : q.from ? 'custom' : '30d';
  const to = q.to ? new Date(String(q.to)) : now;
  let from: Date;
  if (q.from) {
    from = new Date(String(q.from));
  } else {
    from = new Date(now);
    switch (preset) {
      case 'today':
        from.setHours(0, 0, 0, 0);
        break;
      case '7d':
        from.setDate(now.getDate() - 6);
        from.setHours(0, 0, 0, 0);
        break;
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case '30d':
      default:
        from.setDate(now.getDate() - 29);
        from.setHours(0, 0, 0, 0);
        break;
    }
  }
  return { from, to, preset };
}

// GET /api/seller/report?preset=30d | from=&to=
export async function getSellerReport(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const { from, to, preset } = resolveRange(req.query);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return res.status(400).json({ message: 'Khoảng thời gian không hợp lệ. Vui lòng chọn lại.' }); // 4E
    }
    const sellerId = user.userId;

    const orders = await prisma.order.findMany({
      where: { sellerId, createdAt: { gte: from, lte: to } },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    // Đơn hợp lệ cho doanh thu: loại đơn đã hủy và đơn chưa thanh toán (chờ thanh toán)
    const isValid = (s: string) => s !== 'CANCELLED' && s !== 'AWAITING_PAYMENT';
    const valid = orders.filter((o) => isValid(o.status));

    const revenue = valid.reduce((s, o) => s + o.total, 0);
    const soldQuantity = valid.reduce((s, o) => s + o.items.reduce((a, it) => a + it.quantity, 0), 0);
    const orderCount = valid.length;
    const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;
    const cancelledCount = orders.filter((o) => o.status === 'CANCELLED').length;
    const avgOrderValue = orderCount ? Math.round(revenue / orderCount) : 0;

    // Hoàn tiền trong kỳ (UC11.4) - phản ánh vào báo cáo
    const refundAgg = await prisma.paymentTransaction.aggregate({
      _sum: { amount: true },
      where: {
        kind: 'REFUND',
        status: { in: ['PAID', 'REFUNDED'] },
        createdAt: { gte: from, lte: to },
        order: { sellerId },
      },
    });
    const refundAmount = refundAgg._sum.amount ?? 0;
    const netRevenue = revenue - refundAmount; // doanh thu thực nhận ước tính

    // Biểu đồ doanh thu theo ngày
    const byDay = new Map<string, number>();
    for (const o of valid) {
      const key = o.createdAt.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + o.total);
    }
    const timeSeries = [...byDay.entries()].sort().map(([date, total]) => ({ date, revenue: total }));

    // Sản phẩm bán chạy (giữ cả SP đã ngừng bán - dùng snapshot tên trong đơn)
    const prodMap = new Map<number, { productId: number; name: string; quantity: number; revenue: number }>();
    for (const o of valid) {
      for (const it of o.items) {
        const cur = prodMap.get(it.productId) ?? {
          productId: it.productId,
          name: it.name ?? `Sản phẩm #${it.productId}`,
          quantity: 0,
          revenue: 0,
        };
        cur.quantity += it.quantity;
        cur.revenue += it.price * it.quantity;
        prodMap.set(it.productId, cur);
      }
    }
    const bestSellers = [...prodMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

    res.json({
      range: { from, to, preset },
      metrics: { revenue, orderCount, soldQuantity, avgOrderValue, completedCount, cancelledCount, refundAmount, netRevenue },
      timeSeries,
      bestSellers,
    });
  } catch (err) {
    next(err);
  }
}
