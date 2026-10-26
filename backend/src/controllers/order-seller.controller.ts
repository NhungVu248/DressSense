import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { SELLER_NEXT, type OrderStatusValue } from '../constants/order-status';
import { releaseReserved } from '../services/order.service';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  UC10.4 - Người bán cập nhật đơn hàng (Seller Portal).
//  Lưu ý (bản gọn): đơn có thể gồm SP nhiều gian hàng; ở đây người bán thao tác
//  trên cả đơn nếu đơn chứa SP của mình (seed hiện 1 người bán). Thực tế nên tách
//  theo từng gian hàng.
// ============================================================

// Đơn "thuộc" người bán nếu có ít nhất 1 mục là SP của họ (ADMIN xem tất cả)
async function loadSellerOrder(req: Request) {
  const orderId = Number(req.params.id);
  const user = req.user as JwtPayload;
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { ok: false as const, code: 404, message: 'Không tìm thấy đơn hàng.' };
  if (user.role !== 'ADMIN') {
    const owns = await prisma.orderItem.count({ where: { orderId, product: { sellerId: user.userId } } });
    if (!owns) return { ok: false as const, code: 403, message: 'Đơn không thuộc gian hàng của bạn.' }; // 2E
  }
  return { ok: true as const, order };
}

// GET /api/seller/orders?status= - danh sách đơn của gian hàng người bán
export async function listSellerOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const where: any = {};
    if (user.role !== 'ADMIN') where.items = { some: { product: { sellerId: user.userId } } };
    if (status) where.status = status;
    const orders = await prisma.order.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { items: true, user: { select: { fullName: true } } },
    });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

const statusSchema = z.object({
  to: z.enum(['CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED']),
  carrier: z.string().trim().optional(),
  trackingNumber: z.string().trim().optional(),
  estimatedDelivery: z.string().optional(), // ISO date
});

// PATCH /api/seller/orders/:id/status - UC10.4 cập nhật trạng thái (theo đúng thứ tự)
export async function updateOrderStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const body = statusSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const r = await loadSellerOrder(req);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    const order = r.order;
    const cur = order.status as OrderStatusValue;

    // Đơn hoàn tất / đã hủy không cập nhật theo luồng giao hàng
    if (cur === 'COMPLETED' || cur === 'CANCELLED') return res.status(400).json({ message: 'Đơn đã kết thúc, không thể cập nhật.' });
    // 5E - chỉ cho bước kế tiếp đúng thứ tự, không nhảy cóc/quay ngược
    if (SELLER_NEXT[cur] !== body.data.to) {
      return res.status(400).json({ message: `Không thể chuyển từ trạng thái hiện tại sang "${body.data.to}".`, code: 'INVALID_TRANSITION' });
    }

    const data: any = { status: body.data.to };
    const now = new Date();
    if (body.data.to === 'CONFIRMED') data.confirmedAt = now;
    if (body.data.to === 'DELIVERED') data.deliveredAt = now;
    if (body.data.to === 'SHIPPING') {
      // 8E - chuyển sang Đang giao phải có thông tin vận chuyển
      if (!body.data.carrier) return res.status(400).json({ message: 'Vui lòng nhập đơn vị vận chuyển trước khi chuyển sang Đang giao.', code: 'SHIPPING_INFO_REQUIRED' });
      data.carrier = body.data.carrier;
      data.trackingNumber = body.data.trackingNumber ?? null;
      data.estimatedDelivery = body.data.estimatedDelivery ? new Date(body.data.estimatedDelivery) : null;
      data.shippedAt = now;
    }
    const updated = await prisma.order.update({ where: { id: order.id }, data });
    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/seller/orders/:id/shipping - cập nhật thông tin vận chuyển (khi đã có thay đổi hợp lệ - 8a)
const shipInfoSchema = z.object({ carrier: z.string().trim().optional(), trackingNumber: z.string().trim().optional(), estimatedDelivery: z.string().optional() });
export async function updateShippingInfo(req: Request, res: Response, next: NextFunction) {
  try {
    const body = shipInfoSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const r = await loadSellerOrder(req);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    if (!['SHIPPING', 'DELIVERED'].includes(r.order.status)) return res.status(400).json({ message: 'Chỉ cập nhật vận chuyển khi đơn đang giao.' });
    const updated = await prisma.order.update({
      where: { id: r.order.id },
      data: {
        carrier: body.data.carrier ?? r.order.carrier,
        trackingNumber: body.data.trackingNumber ?? r.order.trackingNumber,
        estimatedDelivery: body.data.estimatedDelivery ? new Date(body.data.estimatedDelivery) : r.order.estimatedDelivery,
      },
    });
    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/seller/orders/:id/cancel/approve - UC10.5 3b người bán chấp nhận yêu cầu hủy
export async function approveCancel(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await loadSellerOrder(req);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    const order = r.order;
    if (!order.cancelRequested) return res.status(400).json({ message: 'Đơn không có yêu cầu hủy.' });
    if (order.status === 'CANCELLED' || order.status === 'COMPLETED') return res.status(400).json({ message: 'Đơn đã kết thúc.' });

    const needRefund = order.paymentStatus === 'PAID';
    await prisma.$transaction(async (db) => {
      await db.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'SELLER', cancelRequested: false, refundStatus: needRefund ? 'PENDING' : null },
      });
      await releaseReserved(db, order.items); // hoàn kho
    });
    res.json({ ok: true, status: 'CANCELLED', refund: needRefund });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/seller/orders/:id/cancel/reject - UC10.5 3c người bán từ chối, đơn tiếp tục
export async function rejectCancel(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await loadSellerOrder(req);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    if (!r.order.cancelRequested) return res.status(400).json({ message: 'Đơn không có yêu cầu hủy.' });
    await prisma.order.update({ where: { id: r.order.id }, data: { cancelRequested: false } });
    res.json({ ok: true, rejected: true });
  } catch (err) {
    next(err);
  }
}
