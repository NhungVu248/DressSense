import { prisma } from '../lib/prisma';
import { getNumberSetting } from './settings.service';
import { buildPaymentUrl, type VerifyResult } from './vnpay.service';
import { notify } from './notification.service';

// ============================================================
//  Backlog B.27/C.45 - Đơn mua gói voucher của gian hàng.
//  Thanh toán phí gói tách khỏi luồng đơn hàng: txnRef = mã đơn (prefix "VCH").
// ============================================================

export const VCH_PREFIX = 'VCH';

// Phí gói theo loại (đọc cấu hình hệ thống).
export async function voucherPackageFee(packageType: string): Promise<number> {
  if (packageType === 'COMBO_MONTH') return getNumberSetting('voucherFeeComboMonth', 120000);
  return getNumberSetting('voucherFeeSingle', 50000); // SINGLE
}

// Tạo link thanh toán VNPAY cho một đơn mua voucher (txnRef = code).
export function voucherPayUrl(order: { code: string; fee: number; paymentMethod: string }, ipAddr: string): string {
  return buildPaymentUrl({
    txnRef: order.code,
    amount: order.fee,
    orderInfo: `Thanh toan phi mua voucher ${order.code}`,
    ipAddr,
    intcard: order.paymentMethod === 'VISA',
  });
}

// Ghi nhận đã thanh toán phí gói + chuyển sang chờ duyệt + thông báo Admin. Idempotent.
export async function markVoucherOrderPaid(code: string, paymentRef?: string | null): Promise<boolean> {
  const vo = await prisma.voucherOrder.findUnique({ where: { code } });
  if (!vo) return false;
  if (vo.paymentStatus === 'PAID') return true;
  await prisma.voucherOrder.update({
    where: { id: vo.id },
    data: { paymentStatus: 'PAID', paidAt: new Date(), paymentRef: paymentRef ?? null, status: 'PENDING_REVIEW' },
  });
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, 'SHOP', 'Đơn mua voucher chờ duyệt', `Đơn voucher ${vo.code} đã thanh toán, chờ duyệt.`, '/admin/voucher-orders')));
  return true;
}

// Xử lý callback VNPAY cho đơn mua voucher (phân nhánh từ vnpayReturn khi txnRef bắt đầu bằng VCH).
export async function finalizeVoucherPayment(v: VerifyResult): Promise<void> {
  const vo = await prisma.voucherOrder.findUnique({ where: { code: v.txnRef } });
  if (!vo || !v.valid) return;
  if (Math.round(v.amount) !== vo.fee) return;
  if (v.success) await markVoucherOrderPaid(vo.code, v.transactionNo ?? null);
}
