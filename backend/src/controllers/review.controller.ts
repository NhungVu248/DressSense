import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { notify } from '../services/notification.service';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  UC12.1 - Đánh giá sản phẩm (khách đã mua & nhận).
//  UC12.2 - Người bán phản hồi đánh giá.
// ============================================================

const createSchema = z.object({
  orderId: z.coerce.number().int(),
  productId: z.coerce.number().int(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().optional(),
  images: z.array(z.string().trim()).optional(), // URL ảnh (chưa làm upload file)
});

// POST /api/reviews - khách tạo đánh giá
export async function createReview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const body = createSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu đánh giá không hợp lệ.' });
    const { orderId, productId, rating, comment, images } = body.data;

    const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: { items: true } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' }); // 3E.1
    // 3E - chỉ đánh giá khi đã giao/nhận
    if (order.status !== 'DELIVERED' && order.status !== 'COMPLETED') {
      return res.status(400).json({ message: 'Chỉ có thể đánh giá sản phẩm của đơn đã giao/đã nhận.' });
    }
    // 3E.1 - sản phẩm phải thuộc đơn
    if (!order.items.some((i) => i.productId === productId)) {
      return res.status(400).json({ message: 'Sản phẩm không thuộc đơn hàng này.' });
    }
    // 3E.2 - không đánh giá trùng trong cùng đơn
    const dup = await prisma.review.findFirst({ where: { orderId, productId } });
    if (dup) return res.status(409).json({ message: 'Bạn đã đánh giá sản phẩm này trong đơn hàng.', code: 'ALREADY_REVIEWED' });

    const review = await prisma.review.create({
      data: { productId, userId, orderId, rating, comment: comment ?? null, images: images && images.length ? images : undefined },
    });
    // thông báo cho người bán có đánh giá mới
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { sellerId: true, name: true } });
    if (product) notify(product.sellerId, 'REVIEW', 'Đánh giá mới', `Sản phẩm "${product.name}" nhận đánh giá ${rating}★.`, `/manage/reviews`);
    res.status(201).json({ review });
  } catch (err) {
    next(err);
  }
}

// POST /api/reviews/upload - tải ảnh đánh giá, trả về URL (UC12.1)
export async function uploadReviewImagesHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    res.json({ urls: files.map((f) => `/uploads/reviews/${f.filename}`) });
  } catch (err) {
    next(err);
  }
}

// GET /api/reviews/product/:id - danh sách đánh giá của sản phẩm (công khai, chỉ hiện đánh giá chưa bị ẩn)
export async function getProductReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.review.findMany({
      where: { productId: Number(req.params.id), status: 'VISIBLE' }, orderBy: { createdAt: 'desc' },
      include: { user: { select: { fullName: true } } },
    });
    const count = rows.length;
    const avg = count ? rows.reduce((a, r) => a + r.rating, 0) / count : 0;
    res.json({
      count, average: Math.round(avg * 10) / 10,
      reviews: rows.map((r) => ({
        id: r.id, rating: r.rating, comment: r.comment, images: r.images ?? [],
        userName: maskName(r.user.fullName), sellerReply: r.sellerReply, sellerReplyAt: r.sellerReplyAt, createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// Ẩn bớt tên để bảo vệ riêng tư (vd "Nguyễn Văn A" -> "Nguyễn V. A")
function maskName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return parts.map((p, i) => (i === 0 || i === parts.length - 1 ? p : p[0] + '.')).join(' ');
}

// ---- Người bán (UC12.2) ----
async function assertSellerReview(id: number, user: JwtPayload) {
  const review = await prisma.review.findUnique({ where: { id }, include: { product: { select: { sellerId: true, name: true } } } });
  if (!review) return { ok: false as const, code: 404, message: 'Không tìm thấy đánh giá.' };
  if (user.role !== 'ADMIN' && review.product.sellerId !== user.userId) return { ok: false as const, code: 403, message: 'Đánh giá không thuộc gian hàng của bạn.' }; // 2E
  return { ok: true as const, review };
}

// GET /api/seller/reviews - đánh giá sản phẩm của gian hàng
export async function listSellerReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const where: any = {};
    if (user.role !== 'ADMIN') where.product = { sellerId: user.userId };
    const rows = await prisma.review.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { user: { select: { fullName: true } }, product: { select: { name: true } } },
    });
    res.json({ reviews: rows });
  } catch (err) {
    next(err);
  }
}

const replySchema = z.object({ reply: z.string().trim().min(1, 'Vui lòng nhập nội dung phản hồi.') });

// PATCH /api/seller/reviews/:id/reply - người bán phản hồi (không sửa nội dung đánh giá)
export async function replyReview(req: Request, res: Response, next: NextFunction) {
  try {
    const body = replySchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Vui lòng nhập nội dung phản hồi.' });
    const r = await assertSellerReview(Number(req.params.id), req.user!);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    const updated = await prisma.review.update({ where: { id: r.review.id }, data: { sellerReply: body.data.reply, sellerReplyAt: new Date() } });
    // UC12.2 - thông báo cho khách
    notify(r.review.userId, 'REVIEW', 'Người bán đã phản hồi đánh giá', `Phản hồi cho đánh giá sản phẩm "${r.review.product.name}".`, `/products/${r.review.productId}`);
    res.json({ review: updated });
  } catch (err) {
    next(err);
  }
}

// ============================================================
//  UC12.1 - Kiểm duyệt đánh giá (Quản trị viên). Người bán KHÔNG được ẩn/xóa.
// ============================================================

// GET /api/admin/reviews?status= - danh sách đánh giá để kiểm duyệt
export async function listAdminReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const status = typeof req.query.status === 'string' && ['VISIBLE', 'HIDDEN'].includes(req.query.status) ? req.query.status : undefined;
    const rows = await prisma.review.findMany({
      where: status ? { status: status as any } : {},
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { fullName: true } }, product: { select: { name: true } } },
    });
    res.json({ reviews: rows });
  } catch (err) {
    next(err);
  }
}

const moderateSchema = z.object({ hide: z.boolean(), note: z.string().trim().optional() });

// PATCH /api/admin/reviews/:id/moderate - ẩn/hiện đánh giá vi phạm
export async function moderateReview(req: Request, res: Response, next: NextFunction) {
  try {
    const body = moderateSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const review = await prisma.review.findUnique({ where: { id: Number(req.params.id) } });
    if (!review) return res.status(404).json({ message: 'Không tìm thấy đánh giá.' });
    const updated = await prisma.review.update({ where: { id: review.id }, data: { status: body.data.hide ? 'HIDDEN' : 'VISIBLE' } });
    // thông báo cho khách khi đánh giá bị ẩn do vi phạm
    if (body.data.hide) notify(review.userId, 'REVIEW', 'Đánh giá đã bị ẩn', body.data.note || 'Đánh giá của bạn đã bị ẩn do vi phạm quy định nội dung.');
    res.json({ ok: true, status: updated.status });
  } catch (err) {
    next(err);
  }
}
