import { getNumberSetting } from './settings.service';

// ============================================================
//  Mô hình phí sàn & doanh thu (Backlog B.25 / C.42).
//  - Phí sàn (hoa hồng) = platformFeeRate% × giá trị hàng CHƯA thuế, sau giảm giá.
//    Thuế VAT là khoản thu hộ nhà nước (không phải doanh thu người bán cũng không
//    phải của sàn). Phí sàn được trừ thẳng khỏi doanh thu thực nhận của người bán
//    và chuyển về cho sàn.
//  - Doanh thu thực nhận (người bán) = tổng − thuế − phí sàn − hoàn tiền.
// ============================================================

// Dữ liệu tối thiểu một đơn cần có để tính phí.
export interface FeeOrderLike {
  total: number;
  subtotal: number;
  discount: number;
  taxAmount: number;
}

export interface FeeBreakdown {
  gross: number; // tổng doanh thu (khách trả)
  tax: number; // thuế VAT (thu hộ)
  platformFee: number; // phí sàn (hoa hồng) trích từ người bán
}

// % hoa hồng sàn hiện hành (0 nếu chưa cấu hình).
export async function getPlatformFeeRate(): Promise<number> {
  const rate = await getNumberSetting('platformFeeRate', 0);
  return rate > 0 ? rate : 0;
}

// Phí sàn của MỘT đơn theo thuế suất hoa hồng đã biết.
export function platformFeeOfOrder(o: FeeOrderLike, rate: number): number {
  if (rate <= 0) return 0;
  const goodsPreVat = Math.max(0, o.subtotal - o.discount - o.taxAmount); // hàng chưa thuế, sau giảm
  return Math.round((goodsPreVat * rate) / 100);
}

// Tổng hợp phí cho một tập đơn.
export function feeBreakdown(orders: FeeOrderLike[], rate: number): FeeBreakdown {
  let gross = 0;
  let tax = 0;
  let platformFee = 0;
  for (const o of orders) {
    gross += o.total;
    tax += o.taxAmount;
    platformFee += platformFeeOfOrder(o, rate);
  }
  return { gross, tax, platformFee };
}
