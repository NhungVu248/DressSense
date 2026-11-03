import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { vnpayEnabled } from '../config/env';
import { voucherPackageFee, voucherPayUrl, markVoucherOrderPaid, VCH_PREFIX } from '../services/voucher-order.service';
import { notify } from '../services/notification.service';

// ============================================================
//  Backlog B.27/C.45 - Đơn mua gói voucher.
//  Người bán: tạo đơn + trả phí. Admin: duyệt -> sinh Voucher cho gian hàng.
// ============================================================

function randomCode(): string {
  return VCH_PREFIX + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

const createSchema = z.object({
  packageType: z.enum(['SINGLE', 'COMBO_MONTH']),
  desiredCode: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ gồm chữ, số, gạch.'),
  description: z.string().trim().max(200).nullable().optional(),
  discountType: z.enum(['PERCENT', 'FIXED']),
  value: z.coerce.number().int().positive(),
  minOrder: z.coerce.number().int().min(0).default(0),
  maxDiscount: z.coerce.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  perUserLimit: z.coerce.number().int().positive().nullable().optional(),
  paymentMethod: z.enum(['VNPAY', 'VISA']).default('VNPAY'),
});

// POST /api/seller/voucher-orders - tạo đơn mua voucher (chờ thanh toán)
export async function createVoucherOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' });
    const d = body.data;
    if (d.discountType === 'PERCENT' && d.value > 100) return res.status(400).json({ message: 'Giảm theo phần trăm phải trong khoảng 1–100.' });
    if (d.endsAt <= d.startsAt) return res.status(400).json({ message: 'Thời gian kết thúc phải sau thời gian bắt đầu.' });

    const code = randomCode();
    const fee = await voucherPackageFee(d.packageType);
    const vo = await prisma.voucherOrder.create({
      data: {
        code, sellerId: req.user!.userId, packageType: d.packageType, fee,
        desiredCode: d.desiredCode.toUpperCase(), description: d.description ?? null,
        discountType: d.discountType, value: d.value, minOrder: d.minOrder, maxDiscount: d.maxDiscount ?? null,
        startsAt: d.startsAt, endsAt: d.endsAt, usageLimit: d.usageLimit ?? null, perUserLimit: d.perUserLimit ?? null,
        paymentMethod: d.paymentMethod, paymentStatus: 'UNPAID', status: 'PENDING_PAYMENT',
      },
    });
    res.status(201).json({ order: vo });
  } catch (err) { next(err); }
}

// GET /api/seller/voucher-orders - đơn của gian hàng mình
export async function listMyVoucherOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await prisma.voucherOrder.findMany({ where: { sellerId: req.user!.userId }, orderBy: { createdAt: 'desc' } });
    res.json({ orders });
  } catch (err) { next(err); }
}

// POST /api/seller/voucher-orders/:id/pay - link thanh toán VNPAY
export async function payVoucherOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const vo = await prisma.voucherOrder.findFirst({ where: { id: Number(req.params.id), sellerId: req.user!.userId } });
    if (!vo) return res.status(404).json({ message: 'Không tìm thấy đơn mua voucher.' });
    if (vo.paymentStatus === 'PAID') return res.status(400).json({ message: 'Đơn đã được thanh toán.' });
    if (!vnpayEnabled()) return res.status(503).json({ message: 'Thanh toán online chưa được cấu hình. Dùng nút "Đánh dấu đã thanh toán (sandbox)".' });
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
    res.json({ payUrl: voucherPayUrl(vo, ip) });
  } catch (err) { next(err); }
}

// POST /api/seller/voucher-orders/:id/mark-paid - mô phỏng thanh toán (sandbox)
export async function markVoucherPaidSandbox(req: Request, res: Response, next: NextFunction) {
  try {
    const vo = await prisma.voucherOrder.findFirst({ where: { id: Number(req.params.id), sellerId: req.user!.userId } });
    if (!vo) return res.status(404).json({ message: 'Không tìm thấy đơn mua voucher.' });
    if (vo.paymentStatus === 'PAID') return res.status(400).json({ message: 'Đơn đã được thanh toán.' });
    await markVoucherOrderPaid(vo.code, 'SANDBOX');
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// DELETE /api/seller/voucher-orders/:id - hủy khi chưa thanh toán
export async function cancelVoucherOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const vo = await prisma.voucherOrder.findFirst({ where: { id: Number(req.params.id), sellerId: req.user!.userId } });
    if (!vo) return res.status(404).json({ message: 'Không tìm thấy đơn mua voucher.' });
    if (vo.paymentStatus === 'PAID') return res.status(400).json({ message: 'Đơn đã thanh toán, không thể hủy.' });
    await prisma.voucherOrder.delete({ where: { id: vo.id } });
    res.json({ deleted: true });
  } catch (err) { next(err); }
}

// ---------------- Admin (C.45) ----------------

const PACKAGE_LABEL: Record<string, string> = { SINGLE: 'Mua lẻ', COMBO_MONTH: 'Combo tháng' };

// GET /api/admin/voucher-orders?status=
export async function listAdminVoucherOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const orders = await prisma.voucherOrder.findMany({
      where: { ...(status ? { status } : { paymentStatus: 'PAID' }) },
      orderBy: { createdAt: 'desc' },
    });
    const ids = [...new Set(orders.map((o) => o.sellerId))];
    const shops = ids.length ? await prisma.shop.findMany({ where: { ownerId: { in: ids } }, select: { ownerId: true, name: true } }) : [];
    const nameMap = new Map(shops.map((s) => [s.ownerId, s.name] as const));
    res.json({ orders: orders.map((o) => ({ ...o, shopName: nameMap.get(o.sellerId) ?? `Gian hàng #${o.sellerId}`, packageLabel: PACKAGE_LABEL[o.packageType] ?? o.packageType })) });
  } catch (err) { next(err); }
}

// POST /api/admin/voucher-orders/:id/approve - duyệt + sinh Voucher cho gian hàng
export async function approveVoucherOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const vo = await prisma.voucherOrder.findUnique({ where: { id: Number(req.params.id) } });
    if (!vo) return res.status(404).json({ message: 'Không tìm thấy đơn mua voucher.' });
    if (vo.paymentStatus !== 'PAID') return res.status(400).json({ message: 'Đơn chưa thanh toán phí.' });
    if (vo.status === 'APPROVED') return res.status(400).json({ message: 'Đơn đã được duyệt.' });

    // Mã voucher phải còn trống (tránh trùng). Nếu trùng -> yêu cầu người bán đổi (từ chối mềm).
    const dup = await prisma.voucher.findUnique({ where: { code: vo.desiredCode } });
    if (dup) return res.status(409).json({ message: `Mã voucher "${vo.desiredCode}" đã tồn tại. Hãy từ chối để người bán đổi mã khác.` });

    const now = new Date();
    const vstatus = now > vo.endsAt ? 'ENDED' : now < vo.startsAt ? 'SCHEDULED' : 'RUNNING';
    const voucher = await prisma.voucher.create({
      data: {
        code: vo.desiredCode, description: vo.description, type: vo.discountType as any, value: vo.value,
        minOrder: vo.minOrder, maxDiscount: vo.maxDiscount, startsAt: vo.startsAt, endsAt: vo.endsAt,
        usageLimit: vo.usageLimit, perUserLimit: vo.perUserLimit, scope: 'ALL', scopeIds: [],
        sellerId: vo.sellerId, status: vstatus as any, active: true,
      },
    });
    const updated = await prisma.voucherOrder.update({
      where: { id: vo.id },
      data: { status: 'APPROVED', voucherId: voucher.id, reviewedById: req.user!.userId, reviewedAt: now, reviewReason: null },
    });
    await notify(vo.sellerId, 'SHOP', 'Đơn mua voucher được duyệt', `Voucher "${vo.desiredCode}" đã được duyệt và sẽ chạy theo lịch.`, '/seller/voucher-orders');
    res.json({ order: updated, voucher });
  } catch (err) { next(err); }
}

// POST /api/admin/voucher-orders/:id/reject
export async function rejectVoucherOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const reason = String(req.body?.reason ?? '').trim();
    if (!reason) return res.status(400).json({ message: 'Vui lòng nhập lý do từ chối.' });
    const vo = await prisma.voucherOrder.findUnique({ where: { id: Number(req.params.id) } });
    if (!vo) return res.status(404).json({ message: 'Không tìm thấy đơn mua voucher.' });
    if (vo.status === 'APPROVED') return res.status(400).json({ message: 'Đơn đã được duyệt, không thể từ chối.' });
    const updated = await prisma.voucherOrder.update({
      where: { id: vo.id },
      data: { status: 'REJECTED', reviewReason: reason, reviewedById: req.user!.userId, reviewedAt: new Date() },
    });
    await notify(vo.sellerId, 'SHOP', 'Đơn mua voucher bị từ chối', `Đơn voucher "${vo.desiredCode}" bị từ chối: ${reason}`, '/seller/voucher-orders');
    res.json({ order: updated });
  } catch (err) { next(err); }
}
