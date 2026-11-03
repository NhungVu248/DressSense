import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// ============================================================
//  Admin #6 - Quản lý đơn hàng (theo dõi TẤT CẢ đơn toàn sàn, chỉ đọc).
//  Thao tác xử lý đơn vẫn thuộc Người bán; Admin chỉ theo dõi/tìm kiếm/lọc.
// ============================================================

// GET /api/admin/orders?status=&q=&payment=
export async function listAllOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const where: any = {};
    if (typeof req.query.status === 'string' && req.query.status) where.status = req.query.status;
    if (typeof req.query.payment === 'string' && req.query.payment) where.paymentStatus = req.query.payment;
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) where.OR = [{ code: { contains: q } }, { recipientName: { contains: q } }, { phone: { contains: q } }];

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        user: { select: { fullName: true, email: true } },
        items: { select: { id: true, name: true, quantity: true } },
      },
    });

    const counts = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } });
    res.json({
      orders,
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/orders/:id - chi tiết đơn (chỉ đọc)
export async function getOrderDetailAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        items: true,
        payments: true,
      },
    });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    res.json({ order });
  } catch (err) {
    next(err);
  }
}
