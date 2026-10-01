import type { BodyShape } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getBehaviorAffinity, behaviorScoreForProduct } from './behavior.service';

// ============================================================
//  UC5 (GĐ5) - RECOMMENDATION ENGINE (Hybrid có trọng số) + GIẢI THÍCH
//  Score = 0.40 BodyShapeMatch + 0.25 StyleMatch + 0.15 ColorMatch
//        + 0.10 PreferenceMatch + 0.10 BehaviorScore
//  Thành phần thiếu dữ liệu -> bỏ khỏi tổng và CHUẨN HÓA LẠI trọng số (cold start:
//  người mới chưa có Body Profile/sở thích vẫn xếp hạng được, dựa phần có dữ liệu).
//  Mỗi gợi ý kèm câu giải thích "Vì sao hợp với bạn" từ thành phần đóng góp cao nhất.
// ============================================================

const WEIGHTS = { bodyShape: 0.4, style: 0.25, color: 0.15, preference: 0.1, behavior: 0.1 };

function asStringSet(json: unknown): Set<string> {
  const out = new Set<string>();
  if (Array.isArray(json)) {
    for (const it of json) {
      if (typeof it === 'string') out.add(it);
      else if (it && typeof it === 'object' && 'style' in it) out.add(String((it as any).style));
    }
  }
  return out;
}

interface Component { value: number; weight: number; hasData: boolean; }

export async function recommendForUser(
  userId: number,
  opts: { limit?: number; categoryId?: number } = {}
) {
  const limit = Math.min(50, opts.limit ?? 12);

  // Body Profile hiện hành -> dáng người
  const bodyProfile = await prisma.bodyProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { bodyShape: true },
  });
  const shape: BodyShape | null = bodyProfile?.bodyShape ?? null;

  // Hồ sơ cá nhân hóa (sở thích) + ngân sách
  const profile = await prisma.customerProfile.findUnique({
    where: { userId },
    include: { budgets: true, occasions: true },
  });
  const preferredStyles = asStringSet(profile?.preferredStyles);
  const preferredColors = asStringSet(profile?.preferredColors);
  const avoidColors = asStringSet(profile?.avoidColors);
  const preferredMaterials = asStringSet(profile?.preferredMaterials);
  const preferredBrands = asStringSet(profile?.preferredBrands);
  const occasionSet = new Set<string>();
  for (const o of profile?.occasions ?? []) occasionSet.add(o.customLabel || o.occasion);
  const budgetByCat = new Map<number, { min: number; max: number }>();
  for (const b of profile?.budgets ?? []) budgetByCat.set(b.categoryId, { min: b.minPrice, max: b.maxPrice });

  // GĐ6 - ái lực hành vi (danh mục/phong cách) suy từ lịch sử tương tác
  const affinity = await getBehaviorAffinity(userId);

  // Sản phẩm ứng viên (kèm điểm tương thích dáng - UC4)
  const products = await prisma.product.findMany({
    where: opts.categoryId ? { categoryId: opts.categoryId } : undefined,
    include: { images: true, category: true, bodyFits: true },
  });

  const scored = products.map((p) => {
    const reasons: string[] = [];
    const comps: Record<string, Component> = {};

    // (1) BodyShapeMatch - từ ProductBodyFit của dáng người dùng
    if (shape) {
      const fit = p.bodyFits.find((f) => f.bodyShape === shape);
      if (fit) {
        comps.bodyShape = { value: fit.score, weight: WEIGHTS.bodyShape, hasData: true };
        const plus = (fit.reasons as Array<{ type: string; reason: string }> | null)?.filter((r) => r.type === 'plus') ?? [];
        if (fit.score >= 0.6 && plus.length) reasons.push(`Hợp dáng ${shapeVi(shape)}: ${plus[0].reason.toLowerCase()}`);
      }
    }

    // (2) StyleMatch
    if (preferredStyles.size && p.style) {
      const v = preferredStyles.has(p.style) ? 1 : 0.4;
      comps.style = { value: v, weight: WEIGHTS.style, hasData: true };
      if (v === 1) reasons.push(`Đúng phong cách ${p.style} bạn thích`);
    }

    // (3) ColorMatch
    if ((preferredColors.size || avoidColors.size) && p.color) {
      let v = 0.5;
      if (avoidColors.has(p.color)) v = 0;
      else if (preferredColors.has(p.color)) { v = 1; reasons.push(`Màu ${p.color} bạn ưa thích`); }
      comps.color = { value: v, weight: WEIGHTS.color, hasData: true };
    }

    // (4) PreferenceMatch - chất liệu + ngân sách theo danh mục
    const sub: number[] = [];
    if (preferredMaterials.size && p.material) {
      const mv = preferredMaterials.has(p.material) ? 1 : 0.4;
      sub.push(mv);
      if (mv === 1) reasons.push(`Chất liệu ${p.material} phù hợp sở thích`);
    }
    const bud = budgetByCat.get(p.categoryId);
    if (bud) sub.push(p.price >= bud.min && p.price <= bud.max ? 1 : 0.3);
    if (preferredBrands.size && p.brand) {
      const bv = preferredBrands.has(p.brand) ? 1 : 0.4;
      sub.push(bv);
      if (bv === 1) reasons.push(`Thương hiệu ${p.brand} bạn thích`);
    }
    if (occasionSet.size && p.occasion) {
      const ov = occasionSet.has(p.occasion) ? 1 : 0.4;
      sub.push(ov);
      if (ov === 1) reasons.push('Phù hợp dịp bạn hay mặc');
    }
    if (sub.length) comps.preference = { value: sub.reduce((a, b) => a + b, 0) / sub.length, weight: WEIGHTS.preference, hasData: true };

    // (5) BehaviorScore - GĐ6: ái lực hành vi theo danh mục/phong cách
    if (affinity.hasData) {
      const bv = behaviorScoreForProduct(affinity, { categoryId: p.categoryId, style: p.style });
      comps.behavior = { value: bv, weight: WEIGHTS.behavior, hasData: true };
      if (bv >= 0.6) reasons.push(`Bạn hay quan tâm nhóm ${p.category.name}`);
    }

    // Chuẩn hóa lại trên các thành phần có dữ liệu
    const active = Object.values(comps).filter((c) => c.hasData);
    const wsum = active.reduce((a, c) => a + c.weight, 0);
    const score = wsum > 0 ? active.reduce((a, c) => a + c.weight * c.value, 0) / wsum : 0.5;

    const why = reasons.length
      ? reasons.slice(0, 2).join('; ') + '.'
      : shape ? 'Gợi ý theo dáng người của bạn.' : 'Gợi ý phổ biến cho bạn.';

    return {
      product: p,
      score: Math.round(score * 1000) / 1000,
      why,
      breakdown: Object.fromEntries(Object.entries(comps).map(([k, c]) => [k, Math.round(c.value * 1000) / 1000])),
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return {
    bodyShape: shape,
    hasBodyProfile: !!shape,
    hasPersonalization: !!profile?.styleDeclaredAt,
    items: scored.slice(0, limit),
  };
}

function shapeVi(s: BodyShape): string {
  return { HOURGLASS: 'đồng hồ cát', RECTANGLE: 'chữ nhật', PEAR: 'quả lê', APPLE: 'quả táo', INVERTED_TRIANGLE: 'tam giác ngược' }[s];
}
