import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env, vnpayEnabled } from '../config/env';
import { verifyReturn } from '../services/vnpay.service';
import { finalizePayment, startOnlinePayment } from '../services/payment.service';

// ============================================================
//  UC9.2 - Xử lý callback VNPAY + thanh toán lại.
//  UC9.3 - Lịch sử giao dịch.
// ============================================================

// GET /api/payments/vnpay/return - VNPAY chuyển hướng trình duyệt khách về đây sau thanh toán.
// Xác minh rồi điều hướng về trang kết quả của frontend.
export async function vnpayReturn(req: Request, res: Response) {
  const q = req.query as Record<string, string>;
  const v = verifyReturn(q);
  let orderId = '';
  try {
    const tx = await prisma.paymentTransaction.findUnique({ where: { code: v.txnRef }, select: { orderId: true } });
    orderId = tx ? String(tx.orderId) : '';
    await finalizePayment(v); // idempotent
  } catch { /* vẫn điều hướng về trang kết quả */ }
  const status = v.success ? 'success' : 'fail';
  return res.redirect(`${env.clientOrigin}/checkout/result?orderId=${orderId}&status=${status}&code=${encodeURIComponent(v.responseCode)}`);
}

// GET /api/payments/vnpay/ipn - VNPAY gọi server-to-server (xác nhận thật). Trả JSON theo chuẩn VNPAY.
export async function vnpayIpn(req: Request, res: Response) {
  const v = verifyReturn(req.query as Record<string, string>);
  if (!v.valid) return res.json({ RspCode: '97', Message: 'Invalid signature' });
  const r = await finalizePayment(v);
  return res.json({ RspCode: r.code === '00' || r.code === '02' ? '00' : r.code, Message: r.message });
}

// POST /api/payments/orders/:orderId/retry - thanh toán lại đơn online còn hiệu lực (4c/4d)
export async function retryPayment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!vnpayEnabled()) return res.status(503).json({ message: 'Thanh toán online chưa được cấu hình.' });
    const userId = req.user!.userId;
    const orderId = Number(req.params.orderId);
    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) return res.status(404).json({ message: 'Không tìm thấy đơn hàng.' });
    if (order.paymentMethod === 'COD') return res.status(400).json({ message: 'Đơn COD không cần thanh toán online.' });
    if (order.paymentStatus === 'PAID') return res.status(400).json({ message: 'Đơn hàng đã được thanh toán.' });
    if (order.status === 'CANCELLED') return res.status(400).json({ message: 'Đơn hàng đã bị hủy.' });

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
    const { payUrl } = await startOnlinePayment(order, ip); // tạo giao dịch MỚI, KHÔNG tạo đơn mới (4d)
    res.json({ payUrl });
  } catch (err) {
    next(err);
  }
}

const historyQuery = z.object({
  status: z.enum(['PENDING', 'PAID', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED']).optional(),
  method: z.enum(['COD', 'VNPAY', 'VISA']).optional(),
});

// GET /api/payments - lịch sử giao dịch của khách (UC9.3) - chỉ của chính mình
export async function listTransactions(req: Request, res: Response, next: NextFunction) {
  try {
    const q = historyQuery.safeParse(req.query);
    const where: any = { order: { userId: req.user!.userId } };
    if (q.success) {
      if (q.data.status) where.status = q.data.status;
      if (q.data.method) where.method = q.data.method;
    }
    const rows = await prisma.paymentTransaction.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { order: { select: { code: true } } },
    });
    const items = rows.map((t) => ({
      id: t.id, code: t.code, orderCode: t.order.code, method: t.method, amount: t.amount,
      status: t.status, bankCode: t.bankCode, cardLast4: t.cardLast4, responseCode: t.responseCode,
      createdAt: t.createdAt, paidAt: t.paidAt,
    }));
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// GET /api/payments/:id - chi tiết giao dịch (5E - chỉ giao dịch thuộc tài khoản)
export async function getTransaction(req: Request, res: Response, next: NextFunction) {
  try {
    const t = await prisma.paymentTransaction.findFirst({
      where: { id: Number(req.params.id), order: { userId: req.user!.userId } },
      include: { order: { select: { id: true, code: true, total: true } } },
    });
    if (!t) return res.status(404).json({ message: 'Không tìm thấy giao dịch.' });
    res.json({ transaction: t });
  } catch (err) {
    next(err);
  }
}
