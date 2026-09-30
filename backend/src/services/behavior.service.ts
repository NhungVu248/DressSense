import type { BehaviorAction } from '@prisma/client';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC5/GĐ6 - GHI NHẬN HÀNH VI & SUY LUẬN SỞ THÍCH NGẦM
//  Ghi sự kiện tương tác (VIEW/WISHLIST/ADD_TO_CART/PURCHASE) rồi tổng hợp thành
//  "Preference Profile" (ái lực theo danh mục & phong cách) -> BehaviorScore bổ trợ
//  cho công thức gợi ý (UC5, thành phần trọng số 0.10).
// ============================================================

// Trọng số theo mức độ cam kết của hành vi
const ACTION_WEIGHT: Record<BehaviorAction, number> = {
  VIEW: 1,
  WISHLIST: 2,
  ADD_TO_CART: 3,
  PURCHASE: 4,
};

export async function recordBehavior(userId: number, productId: number, action: BehaviorAction) {
  return prisma.userBehavior.create({ data: { userId, productId, action } });
}

export interface BehaviorAffinity {
  hasData: boolean;
  byCategory: Map<number, number>; // categoryId -> ái lực 0..1
  byStyle: Map<string, number>;    // style -> ái lực 0..1
}

function normalize(map: Map<string | number, number>): Map<any, number> {
  const max = Math.max(0, ...map.values());
  if (max <= 0) return map;
  const out = new Map<any, number>();
  for (const [k, v] of map) out.set(k, Math.round((v / max) * 1000) / 1000);
  return out;
}

// Tổng hợp lịch sử hành vi -> ái lực theo danh mục & phong cách (chuẩn hóa 0..1)
export async function getBehaviorAffinity(userId: number): Promise<BehaviorAffinity> {
  const events = await prisma.userBehavior.findMany({
    where: { userId },
    include: { product: { select: { categoryId: true, style: true } } },
  });
  const cat = new Map<number, number>();
  const style = new Map<string, number>();
  for (const e of events) {
    const w = ACTION_WEIGHT[e.action] ?? 1;
    cat.set(e.product.categoryId, (cat.get(e.product.categoryId) ?? 0) + w);
    if (e.product.style) style.set(e.product.style, (style.get(e.product.style) ?? 0) + w);
  }
  return {
    hasData: events.length > 0,
    byCategory: normalize(cat) as Map<number, number>,
    byStyle: normalize(style) as Map<string, number>,
  };
}

// Điểm hành vi cho 1 sản phẩm: trung bình ái lực danh mục + phong cách (phần có dữ liệu)
export function behaviorScoreForProduct(
  aff: BehaviorAffinity,
  product: { categoryId: number; style?: string | null }
): number {
  const parts: number[] = [];
  if (aff.byCategory.size) parts.push(aff.byCategory.get(product.categoryId) ?? 0);
  if (aff.byStyle.size && product.style) parts.push(aff.byStyle.get(product.style) ?? 0);
  if (!parts.length) return 0;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}
