import { prisma } from '../lib/prisma';

// ============================================================
//  Đọc giá trị cấu hình hệ thống (UC16.5) ở phía backend.
//  Cache ngắn (30s) để tránh truy vấn lặp trong một request chuỗi.
// ============================================================

type Cache = { at: number; map: Map<string, string> };
let cache: Cache | null = null;
const TTL = 30_000;

async function loadAll(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < TTL) return cache.map;
  const rows = await prisma.systemSetting.findMany({ select: { key: true, value: true } });
  const map = new Map(rows.map((r) => [r.key, r.value] as const));
  cache = { at: Date.now(), map };
  return map;
}

// Xóa cache khi cấu hình vừa được cập nhật (gọi trong updateSettings).
export function invalidateSettingsCache() { cache = null; }

export async function getStringSetting(key: string, fallback = ''): Promise<string> {
  const v = (await loadAll()).get(key);
  return v ?? fallback;
}
export async function getNumberSetting(key: string, fallback = 0): Promise<number> {
  const v = (await loadAll()).get(key);
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
export async function getBoolSetting(key: string, fallback = false): Promise<boolean> {
  const v = (await loadAll()).get(key);
  return v == null ? fallback : v === 'true';
}

// Cấu hình thuế VAT hiện hành.
export async function getVatConfig(): Promise<{ enabled: boolean; rate: number }> {
  const enabled = await getBoolSetting('vatEnabled', false);
  const rate = await getNumberSetting('vatRate', 0);
  return { enabled, rate: enabled && rate > 0 ? rate : 0 };
}

// Giá cuối (hiển thị cho khách) = giá chưa thuế + thuế, làm tròn đồng.
export function finalPriceFromBeforeTax(beforeTax: number, rate: number): number {
  return Math.round(beforeTax * (100 + rate) / 100);
}

// Phần thuế VAT nằm TRONG một số tiền đã gồm thuế (giá cuối).
export function taxPortionOfInclusive(inclusive: number, rate: number): number {
  if (rate <= 0) return 0;
  return Math.round((inclusive * rate) / (100 + rate));
}
