import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createRefund } from '../services/refund.service';
import { releaseReserved } from '../services/order.service';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  UC11.3 - Xử lý sự cố giao hàng (người bán): giao chậm / thất bại / thất lạc.
// ============================================================

async function assertSellerOrder(orderId: number, user: JwtPayload) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { ok: false as const, code: 404, message: 'Không tìm thấy đơn hàng.' };
  if (user.role !== 'ADMIN') {
    const owns = await prisma.orderItem.count({ where: { orderId, product: { sellerId: user.userId } } });
    if (!owns) return { ok: false as const, code: 403, message: 'Đơn không thuộc gian hàng của bạn.' };
  }
  return { ok: true as const, order };
}

const createSchema = z.object({ type: z.enum(['LATE', 'FAILED', 'LOST']), note: z.string().trim().optional() });

// POST /api/seller/orders/:orderId/incident - ghi nhận sự cố
export async function createIncident(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const r = await assertSellerOrder(Number(req.params.orderId), req.user!);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    // 2E - cần có thông tin giao nhận trước khi xử lý sự cố
    if (!r.order.carrier && r.order.status !== 'SHIPPING' && r.order.status !== 'DELIVERED') {
      return res.status(400).json({ message: 'Đơn chưa có thông tin giao nhận để ghi nhận sự cố.' });
    }
    const inc = await prisma.deliveryIncident.create({ data: { orderId: r.order.id, type: body.data.type, note: body.data.note ?? null } });
    res.status(201).json({ incident: inc });
  } catch (err) {
    next(err);
  }
}

const resolveSchema = z.object({
  resolution: z.enum(['REDELIVER', 'UPDATE_ETA', 'LOST_REFUND', 'ESCALATE']),
  newEta: z.string().optional(),
  note: z.string().trim().optional(),
});

// PATCH /api/seller/incidents/:id/resolve - chọn phương án xử lý sự cố
export async function resolveIncident(req: Request, res: Response, next: NextFunction) {
  try {
    const body = resolveSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const inc = await prisma.deliveryIncident.findUnique({ where: { id: Number(req.params.id) } });
    if (!inc) return res.status(404).json({ message: 'Không tìm thấy sự cố.' });
    const r = await assertSellerOrder(inc.orderId, req.user!);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    const order = r.order;

    let refund = null;
    const data: any = { resolution: body.data.resolution, resolvedAt: new Date(), note: body.data.note ?? inc.note };

    if (body.data.resolution === 'UPDATE_ETA') {
      // 7a - giao chậm: cập nhật thời gian dự kiến mới
      if (body.data.newEta) await prisma.order.update({ where: { id: order.id }, data: { estimatedDelivery: new Date(body.data.newEta) } });
    } else if (body.data.resolution === 'REDELIVER') {
      // 7b - giao lại: đưa đơn về Đang giao nếu đang ở trạng thái sau đó
      if (order.status === 'DELIVERED') await prisma.order.update({ where: { id: order.id }, data: { status: 'SHIPPING', deliveredAt: null } });
    } else if (body.data.resolution === 'LOST_REFUND') {
      // 7c - xác nhận thất lạc: hủy đơn + hoàn kho + hoàn tiền nếu đã thanh toán
      await prisma.$transaction(async (db) => {
        await db.order.update({ where: { id: order.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: 'SELLER', cancelReason: 'Thất lạc trong vận chuyển' } });
        await releaseReserved(db, order.items);
      });
      refund = await createRefund(order.id, order.total, `Thất lạc đơn ${order.code}`, 'SELLER');
    }
    // ESCALATE: chỉ ghi nhận, khách có thể khiếu nại (UC11.2)

    const updated = await prisma.deliveryIncident.update({ where: { id: inc.id }, data });
    res.json({ ok: true, incident: updated, refund });
  } catch (err) {
    next(err);
  }
}

// GET /api/seller/incidents - danh sách sự cố của gian hàng
export async function listSellerIncidents(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const where: any = {};
    if (user.role !== 'ADMIN') where.order = { items: { some: { product: { sellerId: user.userId } } } };
    const rows = await prisma.deliveryIncident.findMany({ where, orderBy: { createdAt: 'desc' }, include: { order: { select: { code: true, status: true, carrier: true, trackingNumber: true } } } });
    res.json({ incidents: rows });
  } catch (err) {
    next(err);
  }
}
