import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { createRefund } from '../services/refund.service';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  UC11.2 - Khiếu nại đơn hàng. Khách gửi -> người bán phản hồi/đề xuất ->
//  khách đồng ý (Giải quyết) hoặc không đồng ý -> Quản trị viên phân xử.
// ============================================================

function cmpCode(): string {
  return 'DSKN' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

const createSchema = z.object({
  orderId: z.coerce.number().int(),
  type: z.string().trim().min(1),
  content: z.string().trim().min(1),
  evidence: z.string().trim().optional(),
});

// POST /api/complaints - khách gửi khiếu nại
export async function createComplaint(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const body = createSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Vui lòng nhập đầy đủ nội dung khiếu nại.' });
    const { orderId, type, content, evidence } = body.data;

    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' }); // 2E.1
    // 2E - đơn phải đang trong quá trình giao/đã giao mới đủ điều kiện khiếu nại
    if (!['CONFIRMED', 'PREPARING', 'SHIPPING', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
      return res.status(400).json({ message: 'Đơn hàng chưa đủ điều kiện khiếu nại.' });
    }
    // 7E - không tạo khiếu nại trùng cùng loại đang xử lý
    const dup = await prisma.complaint.findFirst({ where: { orderId, type, status: { notIn: ['RESOLVED', 'ADMIN_RESOLVED', 'REJECTED'] } } });
    if (dup) return res.status(409).json({ message: 'Đã có khiếu nại cùng vấn đề đang được xử lý.', code: 'DUPLICATE' });

    const c = await prisma.complaint.create({ data: { code: cmpCode(), orderId, userId, type, content, evidence: evidence ?? null, status: 'PENDING' } });
    res.status(201).json({ complaint: c });
  } catch (err) {
    next(err);
  }
}

// GET /api/complaints - khiếu nại của khách
export async function listComplaints(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.complaint.findMany({ where: { userId: req.user!.userId }, orderBy: { createdAt: 'desc' }, include: { order: { select: { code: true } } } });
    res.json({ complaints: rows });
  } catch (err) {
    next(err);
  }
}

const respondCustomerSchema = z.object({ accept: z.boolean() });

// PATCH /api/complaints/:id/respond - khách phản hồi phương án của người bán (11a / escalate)
export async function respondComplaint(req: Request, res: Response, next: NextFunction) {
  try {
    const body = respondCustomerSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const c = await prisma.complaint.findFirst({ where: { id: Number(req.params.id), userId: req.user!.userId } });
    if (!c) return res.status(404).json({ message: 'Không tìm thấy khiếu nại.' });
    if (c.status !== 'SELLER_RESPONDED') return res.status(400).json({ message: 'Chưa có phương án để phản hồi.' });

    if (body.data.accept) {
      await prisma.complaint.update({ where: { id: c.id }, data: { status: 'RESOLVED', resolvedAt: new Date() } }); // 11a
      return res.json({ ok: true, status: 'RESOLVED' });
    }
    // không đồng ý -> chuyển Quản trị viên phân xử
    await prisma.complaint.update({ where: { id: c.id }, data: { status: 'ESCALATED', escalatedAt: new Date() } });
    res.json({ ok: true, status: 'ESCALATED' });
  } catch (err) {
    next(err);
  }
}

// ---- Người bán ----
async function assertSellerComplaint(id: number, user: JwtPayload) {
  const c = await prisma.complaint.findUnique({ where: { id } });
  if (!c) return { ok: false as const, code: 404, message: 'Không tìm thấy khiếu nại.' };
  if (user.role !== 'ADMIN') {
    const owns = await prisma.orderItem.count({ where: { orderId: c.orderId, product: { sellerId: user.userId } } });
    if (!owns) return { ok: false as const, code: 403, message: 'Khiếu nại không thuộc gian hàng của bạn.' };
  }
  return { ok: true as const, c };
}

export async function listSellerComplaints(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const where: any = {};
    if (user.role !== 'ADMIN') where.order = { items: { some: { product: { sellerId: user.userId } } } };
    const rows = await prisma.complaint.findMany({ where, orderBy: { createdAt: 'desc' }, include: { order: { select: { code: true } }, user: { select: { fullName: true } } } });
    res.json({ complaints: rows });
  } catch (err) {
    next(err);
  }
}

const proposalSchema = z.object({ proposal: z.string().trim().min(1, 'Vui lòng nhập phương án.') });

// PATCH /api/seller/complaints/:id/respond - người bán đề xuất phương án
export async function sellerRespondComplaint(req: Request, res: Response, next: NextFunction) {
  try {
    const body = proposalSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Vui lòng nhập phương án giải quyết.' });
    const r = await assertSellerComplaint(Number(req.params.id), req.user!);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    if (!['PENDING', 'SELLER_RESPONDED'].includes(r.c.status)) return res.status(400).json({ message: 'Khiếu nại không ở trạng thái chờ phản hồi.' });
    await prisma.complaint.update({ where: { id: r.c.id }, data: { status: 'SELLER_RESPONDED', sellerProposal: body.data.proposal } });
    res.json({ ok: true, status: 'SELLER_RESPONDED' });
  } catch (err) {
    next(err);
  }
}

// ---- Quản trị viên (phân xử - UC11.2) ----
export async function listAdminComplaints(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const rows = await prisma.complaint.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { createdAt: 'desc' }, include: { order: { select: { code: true, total: true, paymentStatus: true } }, user: { select: { fullName: true } } },
    });
    res.json({ complaints: rows });
  } catch (err) {
    next(err);
  }
}

const adminResolveSchema = z.object({
  decision: z.string().trim().min(1, 'Vui lòng nhập quyết định.'),
  refundAmount: z.coerce.number().int().min(0).optional(), // 14a - nếu quyết định hoàn tiền
  reject: z.boolean().optional(), // 14c - khiếu nại không hợp lệ
});

// PATCH /api/admin/complaints/:id/resolve - quản trị viên ra quyết định
export async function adminResolveComplaint(req: Request, res: Response, next: NextFunction) {
  try {
    const body = adminResolveSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Vui lòng nhập quyết định xử lý.' });
    const c = await prisma.complaint.findUnique({ where: { id: Number(req.params.id) } });
    if (!c) return res.status(404).json({ message: 'Không tìm thấy khiếu nại.' });
    if (c.status === 'ADMIN_RESOLVED' || c.status === 'RESOLVED') return res.status(400).json({ message: 'Khiếu nại đã được xử lý.' });

    let refund = null;
    if (body.data.refundAmount && body.data.refundAmount > 0) {
      refund = await createRefund(c.orderId, body.data.refundAmount, `Khiếu nại ${c.code}`, 'ADMIN'); // 14a -> UC11.4
    }
    await prisma.complaint.update({
      where: { id: c.id },
      data: { status: body.data.reject ? 'REJECTED' : 'ADMIN_RESOLVED', adminDecision: body.data.decision, handledBy: req.user!.userId, resolvedAt: new Date() },
    });
    res.json({ ok: true, status: body.data.reject ? 'REJECTED' : 'ADMIN_RESOLVED', refund });
  } catch (err) {
    next(err);
  }
}
