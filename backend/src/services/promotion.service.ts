import { prisma } from '../lib/prisma';

// ============================================================
//  UC13.1 - Dịch vụ khuyến mãi: giá Flash Sale hiệu lực + trừ suất khi đặt hàng.
//  Quy tắc: SP hết suất Flash tự trở về giá bán thường (getRunningFlashSales
//  lọc theo thời gian/trạng thái/suất còn lại nên không trả về khi đã hết).
// ============================================================

export type FlashSaleLite = {
  id: number;
  productId: number;
  variantId: number | null;
  salePrice: number;
  quantity: number;
  soldCount: number;
  perUserLimit: number | null;
};

// Các Flash Sale ĐANG diễn ra, còn suất, cho một tập sản phẩm.
export async function getRunningFlashSales(productIds: number[], now = new Date()): Promise<FlashSaleLite[]> {
  const ids = [...new Set(productIds)];
  if (ids.length === 0) return [];
  const sales = await prisma.flashSale.findMany({
    where: { productId: { in: ids }, status: 'RUNNING', startsAt: { lte: now }, endsAt: { gte: now } },
    select: { id: true, productId: true, variantId: true, salePrice: true, quantity: true, soldCount: true, perUserLimit: true },
  });
  return sales.filter((s) => s.soldCount < s.quantity); // còn suất mới áp dụng
}

// Chọn Flash Sale tốt nhất (giá thấp nhất) khớp sản phẩm + biến thể (variantId null = áp mọi size).
export function pickFlashSale(sales: FlashSaleLite[], productId: number, variantId: number | null): FlashSaleLite | null {
  const matches = sales.filter((s) => s.productId === productId && (s.variantId == null || s.variantId === variantId));
  if (matches.length === 0) return null;
  return matches.reduce((best, s) => (s.salePrice < best.salePrice ? s : best));
}

// Giá hiệu lực (không bao giờ cao hơn giá gốc).
export function effectivePrice(basePrice: number, fs: FlashSaleLite | null): number {
  return fs ? Math.min(basePrice, fs.salePrice) : basePrice;
}

// Giá Flash hiển thị rẻ nhất cho mỗi sản phẩm (ưu tiên suất áp cho mọi biến thể) - dùng cho list/detail.
export async function flashPriceMapByProduct(productIds: number[], now = new Date()): Promise<Map<number, number>> {
  const sales = await getRunningFlashSales(productIds, now);
  const map = new Map<number, number>();
  for (const s of sales) {
    const cur = map.get(s.productId);
    if (cur == null || s.salePrice < cur) map.set(s.productId, s.salePrice);
  }
  return map;
}

export type PriceRow = { productId: number; variantId: number | null; quantity: number; basePrice: number };
export type PricedRow = PriceRow & { price: number; flashSaleId: number | null };

// Tính giá hiệu lực cho các dòng hàng khi ĐẶT HÀNG + số suất Flash cần trừ.
// Áp giá Flash cho CẢ dòng nếu còn đủ suất (toàn hệ thống + theo khách); nếu không -> giá thường.
export async function priceOrderRows(rows: PriceRow[], userId: number, now = new Date()): Promise<{ priced: PricedRow[]; consume: Map<number, number> }> {
  const sales = await getRunningFlashSales(rows.map((r) => r.productId), now);
  const usages = sales.length
    ? await prisma.flashSaleUsage.findMany({ where: { userId, flashSaleId: { in: sales.map((s) => s.id) } } })
    : [];
  const usedByFs = new Map(usages.map((u) => [u.flashSaleId, u.quantity] as const));
  const remainingGlobal = new Map(sales.map((s) => [s.id, s.quantity - s.soldCount] as const));

  const priced: PricedRow[] = rows.map((r) => {
    const fs = pickFlashSale(sales, r.productId, r.variantId);
    if (!fs) return { ...r, price: r.basePrice, flashSaleId: null };
    const remUser = fs.perUserLimit == null ? Infinity : fs.perUserLimit - (usedByFs.get(fs.id) ?? 0);
    const remGlobal = remainingGlobal.get(fs.id) ?? 0;
    if (r.quantity <= Math.min(remUser, remGlobal)) {
      remainingGlobal.set(fs.id, remGlobal - r.quantity);
      usedByFs.set(fs.id, (usedByFs.get(fs.id) ?? 0) + r.quantity);
      return { ...r, price: Math.min(r.basePrice, fs.salePrice), flashSaleId: fs.id };
    }
    return { ...r, price: r.basePrice, flashSaleId: null }; // không đủ suất -> giá thường
  });

  const consume = new Map<number, number>();
  for (const p of priced) if (p.flashSaleId) consume.set(p.flashSaleId, (consume.get(p.flashSaleId) ?? 0) + p.quantity);
  return { priced, consume };
}
