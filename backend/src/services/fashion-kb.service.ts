import { prisma } from '../lib/prisma';
import { flattenKB, scoreAllWithRules, type RuleLite, type ProductAttrs } from '../constants/fashion-kb';

// ============================================================
//  UC4.2 - Nạp LUẬT HỢP DÁNG từ DB cho việc chấm điểm (UC4.1/UC5).
//  DB rỗng -> fallback về FASHION_KB hard-code (constants). Nhờ vậy khi Admin
//  sửa luật (UC4.2), điểm tương thích sản phẩm tự thay đổi theo.
// ============================================================

export async function loadFitRules(): Promise<RuleLite[]> {
  const rows = await prisma.shapeFitRule.findMany({ where: { active: true } });
  if (!rows.length) return flattenKB();
  return rows.map((r) => ({
    bodyShape: r.bodyShape, attr: r.attr, value: r.value,
    kind: r.kind as 'PREFER' | 'AVOID', weight: r.weight, reason: r.reason,
  }));
}

// Chấm điểm 1 sản phẩm cho cả 5 dáng, dùng luật DB (fallback hằng số).
export async function scoreProductAllShapesDb(p: ProductAttrs) {
  const rules = await loadFitRules();
  return scoreAllWithRules(p, rules);
}
