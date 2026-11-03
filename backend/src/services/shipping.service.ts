import { getNumberSetting, getStringSetting } from './settings.service';

// ============================================================
//  Backlog (C.46 + B.30) - Phí vận chuyển cấu hình được + người bán tự giao.
//  Phí tính RIÊNG cho từng gian hàng (nhất quán tách đơn multi-shop).
// ============================================================

export interface ShippingMethod { code: string; label: string; fee: number; eta: string; intl?: boolean }
export interface ShippingConfig { threshold: number; surcharge: number; remoteProvinces: string[] }
export interface ShopDelivery { selfDelivery?: boolean; selfDeliveryFee?: number | null }

export async function getShippingMethods(): Promise<ShippingMethod[]> {
  const [std, exp, same, intl] = await Promise.all([
    getNumberSetting('shipStandardFee', 30000),
    getNumberSetting('shipExpressFee', 50000),
    getNumberSetting('shipSameCityFee', 20000),
    getNumberSetting('shipIntlFee', 200000),
  ]);
  return [
    { code: 'STANDARD', label: 'Giao tiêu chuẩn', fee: std, eta: '3–5 ngày' },
    { code: 'EXPRESS', label: 'Giao nhanh', fee: exp, eta: '1–2 ngày' },
    { code: 'SAME_CITY', label: 'Hỏa tốc nội thành', fee: same, eta: 'Trong ngày' },
    { code: 'INTERNATIONAL', label: 'Giao quốc tế', fee: intl, eta: '7–15 ngày', intl: true },
  ];
}

export async function getShippingConfig(): Promise<ShippingConfig> {
  const [threshold, surcharge, remoteCsv] = await Promise.all([
    getNumberSetting('freeShipThreshold', 699000),
    getNumberSetting('shipRemoteSurcharge', 20000),
    getStringSetting('shipRemoteProvinces', ''),
  ]);
  return { threshold, surcharge, remoteProvinces: remoteCsv.split(',').map((s) => s.trim()).filter(Boolean) };
}

function isRemote(province: string | null | undefined, remote: string[]): boolean {
  if (!province) return false;
  const p = province.toLowerCase();
  return remote.some((r) => p.includes(r.toLowerCase()));
}

// Tính phí ship cho MỘT gian hàng từ cấu hình đã nạp sẵn (dùng trong vòng lặp đồng bộ).
export function shippingFeeSync(
  opts: { methodCode: string; subtotal: number; province?: string | null; shop?: ShopDelivery | null },
  methods: ShippingMethod[],
  cfg: ShippingConfig,
): number {
  // B.30 - người bán tự giao: dùng phí riêng của gian hàng
  if (opts.shop?.selfDelivery) return Math.max(0, opts.shop.selfDeliveryFee ?? 0);
  const m = methods.find((x) => x.code === opts.methodCode) ?? methods[0];
  if (m.intl) return m.fee; // quốc tế: phí cố định
  const base = opts.subtotal >= cfg.threshold ? 0 : m.fee; // miễn phí base khi đạt ngưỡng
  const extra = isRemote(opts.province, cfg.remoteProvinces) ? cfg.surcharge : 0; // phụ phí khu vực xa
  return base + extra;
}

// Phiên bản async tiện dùng khi chỉ tính 1 gian hàng.
export async function computeShippingFee(opts: { methodCode: string; subtotal: number; province?: string | null; shop?: ShopDelivery | null }): Promise<number> {
  const [methods, cfg] = await Promise.all([getShippingMethods(), getShippingConfig()]);
  return shippingFeeSync(opts, methods, cfg);
}
