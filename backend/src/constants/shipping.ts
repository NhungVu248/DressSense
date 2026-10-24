// UC9.1 - phương thức vận chuyển (bản gọn; dịch vụ ship thật sẽ thay ở sau)
export interface ShippingMethod { code: string; label: string; fee: number; eta: string }

export const SHIPPING_METHODS: ShippingMethod[] = [
  { code: 'STANDARD', label: 'Giao tiêu chuẩn', fee: 30000, eta: '3–5 ngày' },
  { code: 'EXPRESS', label: 'Giao nhanh', fee: 50000, eta: '1–2 ngày' },
];

// Miễn phí vận chuyển cho đơn từ ngưỡng này (nhất quán với trang chi tiết SP)
export const FREE_SHIP_THRESHOLD = 699000;

export function shippingFeeFor(methodCode: string, subtotal: number): number {
  const m = SHIPPING_METHODS.find((x) => x.code === methodCode) ?? SHIPPING_METHODS[0];
  if (subtotal >= FREE_SHIP_THRESHOLD) return 0;
  return m.fee;
}
