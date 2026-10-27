import { prisma } from '../lib/prisma';
import { notify } from './notification.service';

// ============================================================
//  UC11.4 - Hoàn tiền (mô phỏng - không gọi cổng thật).
//  Tạo giao dịch hoàn (kind=REFUND) liên kết giao dịch gốc, cập nhật trạng thái.
//  Người bán/Quản trị viên KHÔNG trực tiếp chuyển tiền - hệ thống/cổng xử lý.
// ============================================================

function refundCode(): string {
  return 'DSRF' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export interface RefundResult {
  ok: boolean;
  skipped?: boolean;
  message: string;
  transactionId?: number;
}

// Tạo giao dịch hoàn tiền cho đơn (sau khi yêu cầu đã được phê duyệt).
export async function createRefund(orderId: number, amount: number, reason: string, actor: 'SELLER' | 'ADMIN' | 'SYSTEM'): Promise<RefundResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
  if (!order) return { ok: false, message: 'Không tìm thấy đơn hàng.' };

  // 9a - COD chưa thanh toán thì không phát sinh hoàn tiền
  if (order.paymentStatus !== 'PAID') return { ok: true, skipped: true, message: 'Đơn chưa thanh toán nên không phát sinh hoàn tiền.' };

  // 4E - đã có giao dịch hoàn thành công: không tạo trùng
  if (order.payments.some((p) => p.kind === 'REFUND' && p.status === 'PAID')) {
    return { ok: true, skipped: true, message: 'Đơn đã được hoàn tiền trước đó.' };
  }
  const original = order.payments.find((p) => p.kind === 'PAYMENT' && p.status === 'PAID');
  // 3E - số tiền hoàn không vượt số thực tế đã thanh toán
  const paid = original?.amount ?? order.total;
  if (amount > paid) return { ok: false, message: 'Số tiền hoàn vượt quá số tiền đã thanh toán.' };

  let code = refundCode();
  while (await prisma.paymentTransaction.findUnique({ where: { code } })) code = refundCode();

  // Mô phỏng cổng xử lý thành công ngay
  const tx = await prisma.$transaction(async (db) => {
    const r = await db.paymentTransaction.create({
      data: {
        code, orderId, kind: 'REFUND', method: order.paymentMethod, amount, status: 'PAID',
        refundOfId: original?.id ?? null, message: `Hoàn tiền (${actor}): ${reason}`, paidAt: new Date(),
      },
    });
    await db.order.update({ where: { id: orderId }, data: { refundStatus: 'DONE', paymentStatus: 'REFUNDED' } });
    return r;
  });
  // UC12.4 - thông báo hoàn tiền cho khách
  notify(order.userId, 'PAYMENT', 'Hoàn tiền thành công', `Đơn ${order.code} đã được hoàn ${amount.toLocaleString('vi-VN')}₫.`, `/orders/${order.id}`);
  return { ok: true, message: `Đã hoàn ${amount.toLocaleString('vi-VN')}₫.`, transactionId: tx.id };
}
