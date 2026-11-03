import { prisma } from '../lib/prisma';
import { getNumberSetting } from './settings.service';
import { buildPaymentUrl, type VerifyResult } from './vnpay.service';
import { notify } from './notification.service';

// ============================================================
//  Backlog B.26/C.41 - Đơn đăng ký chạy banner quảng cáo của gian hàng.
//  Thanh toán phí QC tách khỏi luồng thanh toán đơn hàng: txnRef dùng mã đơn
//  (prefix "ADV") để vnpayReturn phân nhánh sang finalizeBannerPayment.
// ============================================================

export const ADV_PREFIX = 'ADV';

// Đơn giá/tuần theo vị trí banner (đọc từ cấu hình hệ thống).
export async function feePerWeek(position: string): Promise<number> {
  if (position === 'HOME_HERO') return getNumberSetting('adFeeHeroPerWeek', 500000);
  if (position === 'HOME_STRIP') return getNumberSetting('adFeeStripPerWeek', 250000);
  return getNumberSetting('adFeePromoPerWeek', 150000); // PROMO_PAGE
}

// Số tuần giữa 2 mốc (làm tròn lên, tối thiểu 1).
export function weeksBetween(startsAt: Date, endsAt: Date): number {
  const ms = endsAt.getTime() - startsAt.getTime();
  return Math.max(1, Math.ceil(ms / (7 * 24 * 60 * 60 * 1000)));
}

// Tạo link thanh toán VNPAY cho một đơn QC (txnRef = code của đơn).
export function bannerPayUrl(order: { code: string; amount: number; paymentMethod: string }, ipAddr: string): string {
  return buildPaymentUrl({
    txnRef: order.code,
    amount: order.amount,
    orderInfo: `Thanh toan phi quang cao ${order.code}`,
    ipAddr,
    intcard: order.paymentMethod === 'VISA',
  });
}

// Ghi nhận đã thanh toán phí + chuyển sang chờ duyệt + thông báo Admin.
// Idempotent: gọi lại khi đã PAID thì bỏ qua.
export async function markBannerOrderPaid(code: string, paymentRef?: string | null): Promise<boolean> {
  const bo = await prisma.bannerOrder.findUnique({ where: { code } });
  if (!bo) return false;
  if (bo.paymentStatus === 'PAID') return true;
  await prisma.bannerOrder.update({
    where: { id: bo.id },
    data: { paymentStatus: 'PAID', paidAt: new Date(), paymentRef: paymentRef ?? null, status: 'PENDING_REVIEW' },
  });
  // Thông báo Quản trị viên có đơn QC chờ duyệt (C.41)
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
  await Promise.all(admins.map((a) => notify(a.id, 'SHOP', 'Đơn quảng cáo chờ duyệt', `Đơn banner ${bo.code} đã thanh toán, chờ duyệt.`, '/admin/ad-orders')));
  return true;
}

// Xử lý callback VNPAY cho đơn QC (phân nhánh từ vnpayReturn khi txnRef bắt đầu bằng ADV).
export async function finalizeBannerPayment(v: VerifyResult): Promise<void> {
  const bo = await prisma.bannerOrder.findUnique({ where: { code: v.txnRef } });
  if (!bo || !v.valid) return;
  if (Math.round(v.amount) !== bo.amount) return; // số tiền phải khớp
  if (v.success) await markBannerOrderPaid(bo.code, v.transactionNo ?? null);
}
