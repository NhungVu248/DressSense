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

// GET /api/reviews/product/:id - danh sách đánh giá của sản phẩm (công khai)
export async function getProductReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.review.findMany({
      where: { productId: Number(req.params.id) }, orderBy: { createdAt: 'desc' },
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
