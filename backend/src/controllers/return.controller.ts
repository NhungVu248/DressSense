import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createRefund } from '../services/refund.service';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  UC11.1 - Đổi/trả hàng. Khách tạo yêu cầu trên đơn đã nhận (trong thời hạn),
//  người bán xét duyệt; trả hàng được duyệt -> hoàn tiền (UC11.4).
// ============================================================

const RETURN_WINDOW_DAYS = 7;

function reqCode(): string {
  return 'DSRT' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

const createSchema = z.object({
  orderId: z.coerce.number().int(),
  type: z.enum(['EXCHANGE', 'RETURN']),
  items: z.array(z.object({ orderItemId: z.coerce.number().int(), quantity: z.coerce.number().int().min(1) })).min(1),
  reason: z.string().trim().min(1),
  description: z.string().trim().optional(),
  evidence: z.string().trim().optional(),
  exchangeSize: z.string().trim().optional(),
});

// POST /api/returns - khách tạo yêu cầu đổi/trả
export async function createReturn(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const body = createSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const { orderId, type, items, reason, description, evidence, exchangeSize } = body.data;

    const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: { items: true } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' }); // 4E
    // chỉ đổi/trả khi đã nhận hàng
    if (order.status !== 'DELIVERED' && order.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Chỉ có thể đổi/trả đơn đã giao/đã nhận.' });
    }
    // 3E - trong thời hạn đổi/trả
    const ref = order.completedAt ?? order.deliveredAt ?? order.createdAt;
    if (Date.now() - new Date(ref).getTime() > RETURN_WINDOW_DAYS * 86400_000) {
      return res.status(400).json({ message: `Quá thời hạn đổi/trả (${RETURN_WINDOW_DAYS} ngày kể từ khi nhận hàng).`, code: 'WINDOW_EXPIRED' });
    }
    // 4E - các mục phải thuộc đơn, số lượng hợp lệ
    const orderItemMap = new Map(order.items.map((i) => [i.id, i]));
    for (const it of items) {
      const oi = orderItemMap.get(it.orderItemId);
      if (!oi) return res.status(400).json({ message: 'Sản phẩm không thuộc đơn hàng.' });
      if (it.quantity > oi.quantity) return res.status(400).json({ message: `Số lượng đổi/trả vượt quá đã mua (${oi.name}).` });
    }
    // 1 yêu cầu đang xử lý cho cùng mục (quy tắc nghiệp vụ)
    const active = await prisma.returnRequest.findFirst({
      where: { orderId, status: { in: ['PENDING', 'APPROVED'] }, items: { some: { orderItemId: { in: items.map((i) => i.orderItemId) } } } },
    });
    if (active) return res.status(409).json({ message: 'Sản phẩm đã có yêu cầu đổi/trả đang xử lý.', code: 'DUPLICATE' });

    const refundAmount = type === 'RETURN'
      ? items.reduce((a, it) => a + (orderItemMap.get(it.orderItemId)!.price * it.quantity), 0)
      : null;

    const rr = await prisma.returnRequest.create({
      data: {
        code: reqCode(), orderId, userId, type, reason, description: description ?? null, evidence: evidence ?? null,
        exchangeSize: exchangeSize ?? null, refundAmount, status: 'PENDING',
        items: { create: items.map((it) => ({ orderItemId: it.orderItemId, quantity: it.quantity })) },
      },
      include: { items: true },
    });
    res.status(201).json({ request: rr });
  } catch (err) {
    next(err);
  }
}

// GET /api/returns - danh sách yêu cầu của khách
export async function listReturns(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.returnRequest.findMany({
      where: { userId: req.user!.userId }, orderBy: { createdAt: 'desc' },
      include: { items: { include: { orderItem: true } }, order: { select: { code: true } } },
    });
    res.json({ requests: rows });
  } catch (err) {
    next(err);
  }
}

// ---- Người bán (UC11.1 xét duyệt) ----
async function assertSellerReturn(id: number, user: JwtPayload) {
  const rr = await prisma.returnRequest.findUnique({ where: { id }, include: { items: { include: { orderItem: true } }, order: true } });
  if (!rr) return { ok: false as const, code: 404, message: 'Không tìm thấy yêu cầu.' };
  if (user.role !== 'ADMIN') {
    const owns = await prisma.orderItem.count({ where: { orderId: rr.orderId, product: { sellerId: user.userId } } });
    if (!owns) return { ok: false as const, code: 403, message: 'Yêu cầu không thuộc gian hàng của bạn.' };
  }
  return { ok: true as const, rr };
}

// GET /api/seller/returns - danh sách yêu cầu đổi/trả của gian hàng
export async function listSellerReturns(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const where: any = {};
    if (user.role !== 'ADMIN') where.order = { items: { some: { product: { sellerId: user.userId } } } };
    const rows = await prisma.returnRequest.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { items: { include: { orderItem: true } }, order: { select: { code: true } }, user: { select: { fullName: true } } },
    });
    res.json({ requests: rows });
  } catch (err) {
    next(err);
  }
}

const rejectSchema = z.object({ note: z.string().trim().min(1, 'Vui lòng nhập lý do từ chối.') });

// PATCH /api/seller/returns/:id/approve - duyệt yêu cầu (trả -> hoàn tiền + hoàn kho)
export async function approveReturn(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await assertSellerReturn(Number(req.params.id), req.user!);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    const rr = r.rr;
    if (rr.status !== 'PENDING') return res.status(400).json({ message: 'Yêu cầu đã được xử lý.' });

    if (rr.type === 'EXCHANGE') {
      // 5b - kiểm tra biến thể thay thế còn hàng (nếu có chọn size)
      if (rr.exchangeSize) {
        const oi = rr.items[0]?.orderItem;
        if (oi) {
          const v = await prisma.productVariant.findFirst({ where: { productId: oi.productId, size: rr.exchangeSize } });
          if (!v || v.stock - v.reserved <= 0) return res.status(409).json({ message: `Size ${rr.exchangeSize} đã hết hàng. Vui lòng chọn phương án khác.`, code: 'EXCHANGE_OUT_OF_STOCK' });
        }
      }
      await prisma.returnRequest.update({ where: { id: rr.id }, data: { status: 'COMPLETED', sellerNote: req.body?.note ?? 'Đã chấp thuận đổi hàng', resolvedAt: new Date() } });
      return res.json({ ok: true, status: 'COMPLETED', exchange: true });
    }

    // RETURN -> hoàn kho + hoàn tiền (UC11.4)
    await prisma.$transaction(async (db) => {
      for (const ri of rr.items) {
        if (ri.orderItem.variantId) await db.productVariant.update({ where: { id: ri.orderItem.variantId }, data: { stock: { increment: ri.quantity } } });
      }
      await db.returnRequest.update({ where: { id: rr.id }, data: { status: 'APPROVED', resolvedAt: new Date(), sellerNote: req.body?.note ?? 'Đã chấp thuận trả hàng' } });
    });
    const refund = await createRefund(rr.orderId, rr.refundAmount ?? 0, `Trả hàng ${rr.code}`, 'SELLER');
    await prisma.returnRequest.update({ where: { id: rr.id }, data: { status: 'COMPLETED' } });
    res.json({ ok: true, status: 'COMPLETED', refund });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/seller/returns/:id/reject - từ chối (phải ghi lý do)
export async function rejectReturn(req: Request, res: Response, next: NextFunction) {
  try {
    const body = rejectSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Vui lòng nhập lý do từ chối.' });
    const r = await assertSellerReturn(Number(req.params.id), req.user!);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    if (r.rr.status !== 'PENDING') return res.status(400).json({ message: 'Yêu cầu đã được xử lý.' });
    await prisma.returnRequest.update({ where: { id: r.rr.id }, data: { status: 'REJECTED', sellerNote: body.data.note, resolvedAt: new Date() } });
    res.json({ ok: true, status: 'REJECTED' });
  } catch (err) {
    next(err);
  }
}

// POST /api/returns/upload hoặc /api/complaints/upload - tải ảnh/video bằng chứng (UC11)
export async function uploadEvidenceHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    res.json({ urls: files.map((f) => `/uploads/evidence/${f.filename}`) });
  } catch (err) {
    next(err);
  }
}
