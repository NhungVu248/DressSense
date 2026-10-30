import { prisma } from '../lib/prisma';
import { buildPaymentUrl, type VerifyResult } from './vnpay.service';
import { notify } from './notification.service';

// ============================================================
//  UC9.2 - Dịch vụ thanh toán dùng chung cho tạo đơn (UC9.1) và xử lý callback.
// ============================================================

function randomCode(prefix: string): string {
  return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
}

// Tạo giao dịch thanh toán (PENDING) cho đơn online + trả URL thanh toán VNPAY.
// amount: cho phép ghi đè bằng TỔNG của cả nhóm checkout (thanh toán gộp nhiều gian hàng).
export async function startOnlinePayment(order: { id: number; code: string; total: number; paymentMethod: string }, ipAddr: string, amount?: number) {
  const amt = amount ?? order.total;
  let code = randomCode('DSTX');
  // đảm bảo mã giao dịch duy nhất
  while (await prisma.paymentTransaction.findUnique({ where: { code } })) code = randomCode('DSTX');

  const tx = await prisma.paymentTransaction.create({
    data: { code, orderId: order.id, method: order.paymentMethod as any, amount: amt, status: 'PENDING' },
  });
  const payUrl = buildPaymentUrl({
    txnRef: code,
    amount: amt,
    orderInfo: `Thanh toan don hang ${order.code}`,
    ipAddr,
    intcard: order.paymentMethod === 'VISA', // Visa -> thẻ quốc tế
  });
  return { transaction: tx, payUrl };
}

// Xử lý kết quả từ VNPAY (return/IPN). Idempotent: callback lặp chỉ cập nhật thành công MỘT lần (5E.3).
export async function finalizePayment(v: VerifyResult): Promise<{ handled: boolean; code: string; message: string }> {
  const tx = await prisma.paymentTransaction.findUnique({ where: { code: v.txnRef }, include: { order: { include: { items: true } } } });
  if (!tx) return { handled: false, code: '01', message: 'Không tìm thấy giao dịch' };
  if (!v.valid) return { handled: false, code: '97', message: 'Chữ ký không hợp lệ' }; // 5E
  // 5E.1 - số tiền trả về phải khớp với giao dịch đã tạo (không tin tiền từ cổng/tham số)
  if (Math.round(v.amount) !== tx.amount) return { handled: false, code: '04', message: 'Số tiền không khớp' };

  // Idempotent: đã PAID rồi thì thôi (5E.3)
  if (tx.status === 'PAID') return { handled: true, code: '02', message: 'Giao dịch đã được xác nhận' };

  if (v.success) {
    await prisma.$transaction(async (db) => {
      await db.paymentTransaction.update({
        where: { id: tx.id },
        data: { status: 'PAID', providerRef: v.transactionNo ?? null, bankCode: v.bankCode ?? null, responseCode: v.responseCode, message: 'Thanh toán thành công', paidAt: new Date() },
      });
      // Đơn: Đã thanh toán + chuyển Chờ xác nhận. Tồn kho vẫn ở dạng "giữ chỗ" (reserved),
      // chỉ trừ stock thật khi đơn Hoàn tất (UC10.3) và nhả reserved khi Hủy (UC10.5).
      // Multi-shop: thanh toán gộp -> cập nhật TẤT CẢ đơn cùng nhóm checkout.
      if (tx.order.checkoutCode) {
        await db.order.updateMany({ where: { checkoutCode: tx.order.checkoutCode, paymentStatus: { not: 'PAID' } }, data: { paymentStatus: 'PAID', status: 'PENDING', paidAt: new Date() } });
      } else {
        await db.order.update({ where: { id: tx.orderId }, data: { paymentStatus: 'PAID', status: 'PENDING', paidAt: new Date() } });
      }
    });
    // Thông báo đơn mới (đã thanh toán online) cho Người bán + Quản trị viên
    const paidOrders = tx.order.checkoutCode
      ? await prisma.order.findMany({ where: { checkoutCode: tx.order.checkoutCode }, select: { code: true, sellerId: true } })
      : await prisma.order.findMany({ where: { id: tx.orderId }, select: { code: true, sellerId: true } });
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    for (const o of paidOrders) {
      if (o.sellerId) await notify(o.sellerId, 'ORDER', 'Đơn hàng mới (đã thanh toán)', `Đơn ${o.code} đã thanh toán, chờ xác nhận.`, '/seller/orders');
      await Promise.all(admins.map((a) => notify(a.id, 'ORDER', 'Đơn hàng mới', `Đơn ${o.code} đã thanh toán.`, '/admin')));
    }
    return { handled: true, code: '00', message: 'Xác nhận thanh toán thành công' };
  }

  // Thất bại / bị từ chối (4b): ghi nhận, giữ đơn AWAITING_PAYMENT để có thể thanh toán lại (4c)
  await prisma.paymentTransaction.update({
    where: { id: tx.id },
    data: { status: 'FAILED', responseCode: v.responseCode, bankCode: v.bankCode ?? null, message: `Thanh toán thất bại (mã ${v.responseCode})` },
  });
  return { handled: true, code: v.responseCode || '99', message: 'Giao dịch thất bại' };
}

export { randomCode };
