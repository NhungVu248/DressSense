import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { vnpayEnabled } from '../config/env';
import { feePerWeek, weeksBetween, bannerPayUrl, markBannerOrderPaid, ADV_PREFIX } from '../services/banner-order.service';
import { notify } from '../services/notification.service';
import { getVatConfig, taxPortionOfInclusive, getStringSetting } from '../services/settings.service';
import { renderInvoiceHtml } from '../services/invoice-html';

// ============================================================
//  Backlog B.26/C.41 - Đơn đăng ký chạy banner quảng cáo.
//  Người bán: tạo đơn + trả phí (VNPAY/sandbox). Admin: duyệt + xem timeline.
// ============================================================

function randomCode(): string {
  return ADV_PREFIX + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

const createSchema = z.object({
  name: z.string().trim().min(1, 'Vui lòng nhập tên chiến dịch.').max(120),
  imageUrl: z.string().trim().min(1, 'Vui lòng cung cấp ảnh banner.'),
  title: z.string().trim().max(120).nullable().optional(),
  subtitle: z.string().trim().max(200).nullable().optional(),
  position: z.enum(['HOME_HERO', 'HOME_STRIP', 'PROMO_PAGE']).default('HOME_HERO'),
  linkType: z.enum(['NONE', 'PRODUCT', 'CATEGORY', 'PROMO', 'URL']).default('NONE'),
  linkValue: z.string().trim().max(300).nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  paymentMethod: z.enum(['VNPAY', 'VISA']).default('VNPAY'),
  // Thông tin xuất hóa đơn VAT (tuỳ chọn)
  buyerName: z.string().trim().max(200).nullable().optional(),
  buyerTaxCode: z.string().trim().max(50).nullable().optional(),
  buyerAddress: z.string().trim().max(300).nullable().optional(),
  buyerEmail: z.string().trim().email('Email hóa đơn không hợp lệ.').max(200).nullable().optional().or(z.literal('')),
});

// POST /api/seller/ad-orders - tạo đơn đăng ký (chờ thanh toán)
export async function createBannerOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' });
    const d = body.data;
    if (d.endsAt <= d.startsAt) return res.status(400).json({ message: 'Thời gian chạy không hợp lệ (kết thúc phải sau bắt đầu).' });
    if (d.linkType !== 'NONE' && !d.linkValue) return res.status(400).json({ message: 'Vui lòng nhập liên kết đích cho banner.' });

    const weeks = weeksBetween(d.startsAt, d.endsAt);
    const amount = (await feePerWeek(d.position)) * weeks;
    // Snapshot thuế VAT (phí QC đã gồm thuế) để xuất hóa đơn VAT
    const vat = await getVatConfig();

    let code = randomCode();
    while (await prisma.bannerOrder.findUnique({ where: { code } })) code = randomCode();

    const bo = await prisma.bannerOrder.create({
      data: {
        code, sellerId: req.user!.userId,
        name: d.name, imageUrl: d.imageUrl, title: d.title ?? null, subtitle: d.subtitle ?? null,
        position: d.position, linkType: d.linkType, linkValue: d.linkValue ?? null,
        startsAt: d.startsAt, endsAt: d.endsAt, weeks, amount,
        paymentMethod: d.paymentMethod, paymentStatus: 'UNPAID', status: 'PENDING_PAYMENT',
        buyerName: d.buyerName || null, buyerTaxCode: d.buyerTaxCode || null,
        buyerAddress: d.buyerAddress || null, buyerEmail: d.buyerEmail || null,
        taxRate: vat.rate, taxAmount: taxPortionOfInclusive(amount, vat.rate),
      },
    });
    res.status(201).json({ order: bo });
  } catch (err) { next(err); }
}

// GET /api/seller/ad-orders - đơn QC của gian hàng mình
export async function listMyBannerOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const orders = await prisma.bannerOrder.findMany({ where: { sellerId: req.user!.userId }, orderBy: { createdAt: 'desc' } });
    res.json({ orders });
  } catch (err) { next(err); }
}

// POST /api/seller/ad-orders/:id/pay - lấy link thanh toán VNPAY (nếu cấu hình)
export async function payBannerOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const bo = await prisma.bannerOrder.findFirst({ where: { id: Number(req.params.id), sellerId: req.user!.userId } });
    if (!bo) return res.status(404).json({ message: 'Không tìm thấy đơn quảng cáo.' });
    if (bo.paymentStatus === 'PAID') return res.status(400).json({ message: 'Đơn đã được thanh toán.' });
    if (!vnpayEnabled()) return res.status(503).json({ message: 'Thanh toán online chưa được cấu hình. Dùng nút "Đánh dấu đã thanh toán (sandbox)".' });
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
    res.json({ payUrl: bannerPayUrl(bo, ip) });
  } catch (err) { next(err); }
}

// POST /api/seller/ad-orders/:id/mark-paid - mô phỏng thanh toán (sandbox/demo)
export async function markPaidSandbox(req: Request, res: Response, next: NextFunction) {
  try {
    const bo = await prisma.bannerOrder.findFirst({ where: { id: Number(req.params.id), sellerId: req.user!.userId } });
    if (!bo) return res.status(404).json({ message: 'Không tìm thấy đơn quảng cáo.' });
    if (bo.paymentStatus === 'PAID') return res.status(400).json({ message: 'Đơn đã được thanh toán.' });
    await markBannerOrderPaid(bo.code, 'SANDBOX');
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// GET /api/seller/ad-orders/:id/invoice - xuất hóa đơn VAT cho phí quảng cáo (HTML, in/lưu PDF)
export async function issueBannerInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const bo = await prisma.bannerOrder.findFirst({ where: { id: Number(req.params.id), sellerId: req.user!.userId } });
    if (!bo) return res.status(404).json({ message: 'Không tìm thấy đơn quảng cáo.' });
    if (bo.paymentStatus !== 'PAID') return res.status(400).json({ message: 'Chỉ xuất hóa đơn cho đơn đã thanh toán phí.' });

    const company = {
      name: await getStringSetting('invoiceCompanyName', 'DressSense'),
      taxCode: await getStringSetting('invoiceTaxCode', ''),
      address: await getStringSetting('invoiceAddress', ''),
    };
    const invoice = {
      buyerName: bo.buyerName || '(Chưa cung cấp)', buyerTaxCode: bo.buyerTaxCode,
      buyerAddress: bo.buyerAddress || '', buyerEmail: bo.buyerEmail,
      note: `Phí dịch vụ quảng cáo banner`, issueCount: 1, issuedAt: new Date(),
    };
    const breakdown = {
      goodsBeforeTax: bo.amount - bo.taxAmount, taxRate: bo.taxRate, taxAmount: bo.taxAmount,
      subtotal: bo.amount, discount: 0, shippingFee: 0, total: bo.amount,
    };
    const order = {
      code: bo.code, createdAt: bo.paidAt ?? bo.createdAt, recipientName: bo.buyerName || '', phone: '',
      items: [{ name: `Phí quảng cáo banner "${bo.name}"`, size: `${bo.weeks} tuần`, quantity: 1, price: bo.amount }],
    };
    await prisma.bannerOrder.update({ where: { id: bo.id }, data: { invoiceIssuedAt: new Date() } });
    res.type('html').send(renderInvoiceHtml(company, invoice, breakdown, order));
  } catch (err) { next(err); }
}

// DELETE /api/seller/ad-orders/:id - hủy đơn khi CHƯA thanh toán
export async function cancelBannerOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const bo = await prisma.bannerOrder.findFirst({ where: { id: Number(req.params.id), sellerId: req.user!.userId } });
    if (!bo) return res.status(404).json({ message: 'Không tìm thấy đơn quảng cáo.' });
    if (bo.paymentStatus === 'PAID') return res.status(400).json({ message: 'Đơn đã thanh toán, không thể hủy.' });
    await prisma.bannerOrder.delete({ where: { id: bo.id } });
    res.json({ deleted: true });
  } catch (err) { next(err); }
}

// ---------------- Admin (C.41) ----------------

// GET /api/admin/ad-orders?status= - danh sách đơn QC (kèm tên gian hàng)
export async function listAdminBannerOrders(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const orders = await prisma.bannerOrder.findMany({
      where: { ...(status ? { status } : {}), ...(status ? {} : { paymentStatus: 'PAID' }) },
      orderBy: [{ createdAt: 'desc' }],
    });
    // tên gian hàng
    const ids = [...new Set(orders.map((o) => o.sellerId))];
    const shops = ids.length ? await prisma.shop.findMany({ where: { ownerId: { in: ids } }, select: { ownerId: true, name: true } }) : [];
    const nameMap = new Map(shops.map((s) => [s.ownerId, s.name] as const));
    res.json({ orders: orders.map((o) => ({ ...o, shopName: nameMap.get(o.sellerId) ?? `Gian hàng #${o.sellerId}` })) });
  } catch (err) { next(err); }
}

// GET /api/admin/ad-orders/timeline?position=&from=&to= - bảng lịch chạy (tuần/tháng)
export async function bannerTimeline(req: Request, res: Response, next: NextFunction) {
  try {
    const position = typeof req.query.position === 'string' ? req.query.position : undefined;
    const orders = await prisma.bannerOrder.findMany({
      where: { status: { in: ['APPROVED', 'RUNNING', 'ENDED'] }, ...(position ? { position: position as any } : {}) },
      orderBy: { startsAt: 'asc' },
      select: { id: true, code: true, name: true, position: true, startsAt: true, endsAt: true, sellerId: true, status: true },
    });
    const ids = [...new Set(orders.map((o) => o.sellerId))];
    const shops = ids.length ? await prisma.shop.findMany({ where: { ownerId: { in: ids } }, select: { ownerId: true, name: true } }) : [];
    const nameMap = new Map(shops.map((s) => [s.ownerId, s.name] as const));
    res.json({ items: orders.map((o) => ({ ...o, shopName: nameMap.get(o.sellerId) ?? `Gian hàng #${o.sellerId}` })) });
  } catch (err) { next(err); }
}

// POST /api/admin/ad-orders/:id/approve - duyệt + tạo Banner chạy theo lịch
export async function approveBannerOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const bo = await prisma.bannerOrder.findUnique({ where: { id: Number(req.params.id) } });
    if (!bo) return res.status(404).json({ message: 'Không tìm thấy đơn quảng cáo.' });
    if (bo.paymentStatus !== 'PAID') return res.status(400).json({ message: 'Đơn chưa thanh toán phí.' });
    if (bo.status === 'APPROVED' || bo.status === 'RUNNING') return res.status(400).json({ message: 'Đơn đã được duyệt.' });

    const now = new Date();
    const bannerStatus = now > bo.endsAt ? 'ENDED' : now < bo.startsAt ? 'SCHEDULED' : 'RUNNING';
    const banner = await prisma.banner.create({
      data: {
        name: bo.name, imageUrl: bo.imageUrl, title: bo.title, subtitle: bo.subtitle,
        position: bo.position as any, linkType: bo.linkType as any, linkValue: bo.linkValue,
        priority: 0, startsAt: bo.startsAt, endsAt: bo.endsAt, status: bannerStatus as any, createdBy: req.user!.userId,
      },
    });
    const updated = await prisma.bannerOrder.update({
      where: { id: bo.id },
      data: { status: bannerStatus === 'ENDED' ? 'ENDED' : 'APPROVED', bannerId: banner.id, reviewedById: req.user!.userId, reviewedAt: now, reviewReason: null },
    });
    await notify(bo.sellerId, 'SHOP', 'Đơn quảng cáo được duyệt', `Banner "${bo.name}" đã được duyệt và sẽ chạy theo lịch.`, '/seller/ad-orders');
    res.json({ order: updated, banner });
  } catch (err) { next(err); }
}

// POST /api/admin/ad-orders/:id/reject - từ chối kèm lý do
export async function rejectBannerOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const reason = String(req.body?.reason ?? '').trim();
    if (!reason) return res.status(400).json({ message: 'Vui lòng nhập lý do từ chối.' });
    const bo = await prisma.bannerOrder.findUnique({ where: { id: Number(req.params.id) } });
    if (!bo) return res.status(404).json({ message: 'Không tìm thấy đơn quảng cáo.' });
    if (bo.status === 'APPROVED' || bo.status === 'RUNNING') return res.status(400).json({ message: 'Đơn đã được duyệt, không thể từ chối.' });
    const updated = await prisma.bannerOrder.update({
      where: { id: bo.id },
      data: { status: 'REJECTED', reviewReason: reason, reviewedById: req.user!.userId, reviewedAt: new Date() },
    });
    await notify(bo.sellerId, 'SHOP', 'Đơn quảng cáo bị từ chối', `Banner "${bo.name}" bị từ chối: ${reason}`, '/seller/ad-orders');
    res.json({ order: updated });
  } catch (err) { next(err); }
}
