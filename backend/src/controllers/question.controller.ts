import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { notify } from '../services/notification.service';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  UC12.3 - Hỏi đáp sản phẩm. Khách đặt câu hỏi, người bán trả lời.
// ============================================================

const createSchema = z.object({ productId: z.coerce.number().int(), question: z.string().trim().min(1) });

// POST /api/questions - khách đặt câu hỏi (không bắt buộc đã mua)
export async function createQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Vui lòng nhập câu hỏi.' }); // 4E
    const product = await prisma.product.findUnique({ where: { id: body.data.productId }, select: { id: true, status: true, deletedAt: true, sellerId: true, name: true } });
    // 5E - sản phẩm phải đang hiển thị
    if (!product || product.deletedAt || product.status !== 'ACTIVE') return res.status(404).json({ message: 'Sản phẩm không khả dụng.' });
    const q = await prisma.productQuestion.create({ data: { productId: product.id, userId: req.user!.userId, question: body.data.question } });
    notify(product.sellerId, 'QA', 'Câu hỏi mới', `Có câu hỏi về sản phẩm "${product.name}".`, `/manage/reviews`);
    res.status(201).json({ question: q });
  } catch (err) {
    next(err);
  }
}

// GET /api/questions/product/:id - hỏi đáp của sản phẩm (công khai)
export async function getProductQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.productQuestion.findMany({
      where: { productId: Number(req.params.id) }, orderBy: { createdAt: 'desc' },
      include: { user: { select: { fullName: true } } },
    });
    res.json({
      questions: rows.map((q) => ({
        id: q.id, question: q.question, answer: q.answer, askedBy: q.user.fullName.split(/\s+/)[0],
        answeredAt: q.answeredAt, createdAt: q.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ---- Người bán ----
async function assertSellerQuestion(id: number, user: JwtPayload) {
  const q = await prisma.productQuestion.findUnique({ where: { id }, include: { product: { select: { sellerId: true, name: true } } } });
  if (!q) return { ok: false as const, code: 404, message: 'Không tìm thấy câu hỏi.' };
  if (user.role !== 'ADMIN' && q.product.sellerId !== user.userId) return { ok: false as const, code: 403, message: 'Câu hỏi không thuộc gian hàng của bạn.' }; // 7E
  return { ok: true as const, q };
}

export async function listSellerQuestions(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user!;
    const where: any = {};
    if (user.role !== 'ADMIN') where.product = { sellerId: user.userId };
    const rows = await prisma.productQuestion.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { user: { select: { fullName: true } }, product: { select: { name: true } } },
    });
    res.json({ questions: rows });
  } catch (err) {
    next(err);
  }
}

const answerSchema = z.object({ answer: z.string().trim().min(1, 'Vui lòng nhập câu trả lời.') });

// PATCH /api/seller/questions/:id/answer - người bán trả lời
export async function answerQuestion(req: Request, res: Response, next: NextFunction) {
  try {
    const body = answerSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Vui lòng nhập câu trả lời.' });
    const r = await assertSellerQuestion(Number(req.params.id), req.user!);
    if (!r.ok) return res.status(r.code).json({ message: r.message });
    const updated = await prisma.productQuestion.update({ where: { id: r.q.id }, data: { answer: body.data.answer, answeredBy: req.user!.userId, answeredAt: new Date() } });
    notify(r.q.userId, 'QA', 'Câu hỏi của bạn đã được trả lời', `Người bán đã trả lời câu hỏi về "${r.q.product.name}".`, `/products/${r.q.productId}`);
    res.json({ question: updated });
  } catch (err) {
    next(err);
  }
}
