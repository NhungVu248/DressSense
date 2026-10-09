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
  opts: { limit?: number; categoryId?: number; occasion?: string; minPrice?: number; maxPrice?: number; excludeProductIds?: number[] } = {}
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
  // 3a - tiêu chí tạm: nếu truyền dịp cụ thể thì ưu tiên dịp đó (không đổi hồ sơ đã lưu)
  if (opts.occasion) occasionSet.add(opts.occasion);
  else for (const o of profile?.occasions ?? []) occasionSet.add(o.customLabel || o.occasion);

  // 6a - SP khách đã "không quan tâm"/ẩn + loại trừ theo ngữ cảnh (1a)
  const hiddenRows = await prisma.userBehavior.findMany({ where: { userId, action: 'HIDE' }, select: { productId: true } });
  const excludeIds = new Set<number>([...hiddenRows.map((h) => h.productId), ...(opts.excludeProductIds ?? [])]);
  const budgetByCat = new Map<number, { min: number; max: number }>();
  for (const b of profile?.budgets ?? []) budgetByCat.set(b.categoryId, { min: b.minPrice, max: b.maxPrice });

  // GĐ6 - ái lực hành vi (danh mục/phong cách) suy từ lịch sử tương tác
  const affinity = await getBehaviorAffinity(userId);

  // Sản phẩm ứng viên: CHỈ SP đã gán nhãn (UC4.1) + loại SP đã ẩn; kèm điểm hợp dáng + nhãn chuẩn hóa
  const products = (await prisma.product.findMany({
    where: {
      status: 'ACTIVE', deletedAt: null, // UC6 - chỉ gợi ý SP đang bán
      ...(opts.categoryId ? { categoryId: opts.categoryId } : {}),
      ...(excludeIds.size ? { id: { notIn: [...excludeIds] } } : {}),
    },
    include: { images: true, category: true, bodyFits: true, analysis: true },
  })).filter((p) => p.analysis != null); // quy tắc nghiệp vụ: chỉ SP đã gán nhãn mới được gợi ý

  const scored = products.map((p) => {
    const reasons: string[] = [];
    const comps: Record<string, Component> = {};

    // UC4.1 - ưu tiên NHÃN CHUẨN HÓA (mã chuẩn khớp với sở thích khách); fallback giá trị tự do
    const attrs = (p.analysis?.attributes as Record<string, string> | null) ?? null;
    const norm = (dim: string, raw: string | null) => (attrs && attrs[dim]) || raw || null;
    const styleN = norm('style', p.style);
    const colorN = norm('color', p.color);
    const materialN = norm('material', p.material);
    const occasionN = norm('occasion', p.occasion);

    // (1) BodyShapeMatch - từ ProductBodyFit của dáng người dùng
    if (shape) {
      const fit = p.bodyFits.find((f) => f.bodyShape === shape);
      if (fit) {
        comps.bodyShape = { value: fit.score, weight: WEIGHTS.bodyShape, hasData: true };
        const plus = (fit.reasons as Array<{ type: string; reason: string }> | null)?.filter((r) => r.type === 'plus') ?? [];
        if (fit.score >= 0.6 && plus.length) reasons.push(`Hợp dáng ${shapeVi(shape)}: ${plus[0].reason.toLowerCase()}`);
      }
    }

    // (2) StyleMatch - so nhãn chuẩn hóa với phong cách khách thích
    if (preferredStyles.size && styleN) {
      const v = preferredStyles.has(styleN) ? 1 : 0.4;
      comps.style = { value: v, weight: WEIGHTS.style, hasData: true };
      if (v === 1) reasons.push(`Đúng phong cách ${styleN} bạn thích`);
    }

    // (3) ColorMatch
    if ((preferredColors.size || avoidColors.size) && colorN) {
      let v = 0.5;
      if (avoidColors.has(colorN)) v = 0;
      else if (preferredColors.has(colorN)) { v = 1; reasons.push(`Màu ${colorN} bạn ưa thích`); }
      comps.color = { value: v, weight: WEIGHTS.color, hasData: true };
    }

    // (4) PreferenceMatch - chất liệu + ngân sách theo danh mục
    const sub: number[] = [];
    if (preferredMaterials.size && materialN) {
      const mv = preferredMaterials.has(materialN) ? 1 : 0.4;
      sub.push(mv);
      if (mv === 1) reasons.push(`Chất liệu ${materialN} phù hợp sở thích`);
    }
    const bud = budgetByCat.get(p.categoryId);
    if (bud) sub.push(p.price >= bud.min && p.price <= bud.max ? 1 : 0.3);
    if (preferredBrands.size && p.brand) {
      const bv = preferredBrands.has(p.brand) ? 1 : 0.4;
      sub.push(bv);
      if (bv === 1) reasons.push(`Thương hiệu ${p.brand} bạn thích`);
    }
    if (occasionSet.size && occasionN) {
      const ov = occasionSet.has(occasionN) ? 1 : 0.4;
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

  // 3a/3E - lọc theo khoảng giá tạm; nếu quá ít kết quả thì NỚI MỀM (không trả rỗng) + ghi chú
  let pool = scored;
  let note: string | null = null;
  if (opts.minPrice != null || opts.maxPrice != null) {
    const lo = opts.minPrice ?? 0, hi = opts.maxPrice ?? Number.MAX_SAFE_INTEGER;
    const inRange = scored.filter((s) => s.product.price >= lo && s.product.price <= hi);
    if (inRange.length >= 3) pool = inRange;
    else note = 'Không đủ sản phẩm trong khoảng giá — đã mở rộng để hiển thị lựa chọn gần nhất.';
  }

  return {
    bodyShape: shape,
    hasBodyProfile: !!shape,
    hasPersonalization: !!profile?.styleDeclaredAt,
    note,
    items: pool.slice(0, limit),
  };
}

function shapeVi(s: BodyShape): string {
  return { HOURGLASS: 'đồng hồ cát', RECTANGLE: 'chữ nhật', PEAR: 'quả lê', APPLE: 'quả táo', INVERTED_TRIANGLE: 'tam giác ngược' }[s];
}

// UC5.3 - TÌM BẰNG ẢNH: đối sánh theo MÀU (trích từ ảnh, dùng chung UC4.1) + gợi ý LOẠI,
// lớp cá nhân hóa (dáng/phong cách) là TÙY CHỌN khi khách đã có hồ sơ. Xếp theo độ tương đồng.
const COLOR_NAME: Record<string, string> = {
  black: 'đen', white: 'trắng', beige: 'be', gray: 'xám', navy: 'navy', blue: 'xanh dương',
  green: 'xanh lá', brown: 'nâu', red: 'đỏ', pink: 'hồng', yellow: 'vàng', purple: 'tím', orange: 'cam',
};

export async function searchByImageMatch(userId: number, opts: { color: string; garment?: string; limit?: number }) {
  const limit = Math.min(30, opts.limit ?? 12);
  const want = opts.color;
  const [bp, colorRules, hidden, products] = await Promise.all([
    prisma.bodyProfile.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { bodyShape: true } }),
    prisma.outfitRule.findMany({ where: { active: true, kind: 'COLOR' } }),
    prisma.userBehavior.findMany({ where: { userId, action: 'HIDE' }, select: { productId: true } }),
    prisma.product.findMany({ where: { status: 'ACTIVE', deletedAt: null }, include: { analysis: true, bodyFits: true, category: true, images: true } }),
  ]);
  const shape = bp?.bodyShape ?? null;
  const exclude = new Set(hidden.map((h) => h.productId));
  const harmony = new Set<string>();
  for (const r of colorRules) if (r.subjectB && r.score > 0) { harmony.add(`${r.subjectA}|${r.subjectB}`); harmony.add(`${r.subjectB}|${r.subjectA}`); }
  const g = (opts.garment ?? '').trim().toLowerCase();

  const scored = products
    .filter((p) => p.analysis != null && !exclude.has(p.id))
    .map((p) => {
      const at = (p.analysis!.attributes as Record<string, string> | null) ?? {};
      const col = at.color ?? null;
      let colorSim = 0.15; let colorWhy = '';
      if (col === want) { colorSim = 1.0; colorWhy = `Cùng tông màu ${COLOR_NAME[want] ?? want}`; }
      else if (col && harmony.has(`${col}|${want}`)) { colorSim = 0.65; colorWhy = 'Màu hài hòa với ảnh'; }
      else if (col && (NEUTRAL_COLORS.has(col) || NEUTRAL_COLORS.has(want))) colorSim = 0.45;

      let sim = colorSim; const reasons: string[] = [];
      if (colorWhy) reasons.push(colorWhy);
      if (g) {
        const pg = (at.garmentType ?? p.garmentType ?? '').toLowerCase();
        const match = pg === g || p.category.name.toLowerCase().includes(g);
        sim = 0.7 * colorSim + 0.3 * (match ? 1 : 0.3);
        if (match) reasons.push('Cùng loại trang phục');
      }
      // Lớp cá nhân hóa tùy chọn (chỉ khi có Body Profile) - tiêu chí phụ
      if (shape) {
        const fit = p.bodyFits.find((f) => f.bodyShape === shape)?.score ?? 0.5;
        sim += 0.1 * (fit - 0.5) * 2;
        if (fit >= 0.65) reasons.push(`Hợp dáng ${shapeVi(shape)}`);
      }
      return {
        product: { id: p.id, name: p.name, price: p.price, category: { name: p.category.name }, images: p.images.map((i) => ({ url: i.url, isPrimary: i.isPrimary })) },
        similarity: Math.round(Math.max(0, Math.min(1, sim)) * 1000) / 1000,
        why: reasons.length ? reasons.slice(0, 2).join('; ') + '.' : 'Tương đồng thị giác theo màu.',
      };
    });
  scored.sort((a, b) => b.similarity - a.similarity);
  return { color: want, personalized: !!shape, total: scored.length, items: scored.slice(0, limit) };
}

// UC5.1 (1a) - SP LIÊN QUAN theo sản phẩm đang xem: tương tự về loại/màu/phong cách,
// vẫn ưu tiên hợp dáng người dùng. Loại SP đã ẩn và chính SP neo.
const NEUTRAL_COLORS = new Set(['black', 'white', 'beige', 'gray', 'navy', 'brown']);

export async function relatedProducts(userId: number, productId: number, limit = 8) {
  const anchor = await prisma.product.findUnique({ where: { id: productId }, include: { analysis: true, category: true } });
  if (!anchor) return { anchorId: productId, items: [] as any[] };

  const bp = await prisma.bodyProfile.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { bodyShape: true } });
  const shape = bp?.bodyShape ?? null;
  const hidden = await prisma.userBehavior.findMany({ where: { userId, action: 'HIDE' }, select: { productId: true } });
  const exclude = new Set<number>([productId, ...hidden.map((h) => h.productId)]);

  const aAttr = (anchor.analysis?.attributes as Record<string, string> | null) ?? {};
  const aColor = aAttr.color ?? anchor.color, aStyle = aAttr.style ?? anchor.style, aGarment = aAttr.garmentType ?? anchor.garmentType;

  const cands = (await prisma.product.findMany({
    where: { id: { notIn: [...exclude] }, status: 'ACTIVE', deletedAt: null },
    include: { images: true, category: true, bodyFits: true, analysis: true },
  })).filter((p) => p.analysis != null);

  const scored = cands.map((p) => {
    const at = (p.analysis?.attributes as Record<string, string> | null) ?? {};
    const color = at.color ?? p.color, style = at.style ?? p.style, garment = at.garmentType ?? p.garmentType;
    let sim = 0; const reasons: string[] = [];
    if (p.categoryId === anchor.categoryId) { sim += 0.35; reasons.push(`Cùng loại ${anchor.category.name}`); }
    else if (garment && garment === aGarment) { sim += 0.25; reasons.push('Cùng kiểu trang phục'); }
    if (color && aColor && color === aColor) { sim += 0.25; reasons.push('Cùng tông màu'); }
    else if (color && aColor && (NEUTRAL_COLORS.has(color) || NEUTRAL_COLORS.has(aColor))) sim += 0.08;
    if (style && aStyle && style === aStyle) { sim += 0.25; reasons.push(`Cùng phong cách ${style}`); }
    if (shape) { const f = p.bodyFits.find((b) => b.bodyShape === shape)?.score ?? 0.5; sim += 0.15 * (f - 0.5) * 2; if (f >= 0.65) reasons.push(`Hợp dáng ${shapeVi(shape)}`); }
    return { product: p, score: Math.round(Math.max(0, Math.min(1, sim)) * 1000) / 1000, why: reasons.slice(0, 2).join('; ') + (reasons.length ? '.' : 'Sản phẩm liên quan.') };
  });

  scored.sort((a, b) => b.score - a.score);
  return { anchorId: productId, bodyShape: shape, items: scored.slice(0, limit) };
}
