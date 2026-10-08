import type { BodyShape } from '@prisma/client';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC5.2 - GỢI Ý OUTFIT: ghép BỘ ĐỒ từ KHO theo LUẬT PHỐI ĐỒ (UC4.2).
//  Mỗi bộ = (Đầm) HOẶC (Áo + Quần/Váy), tùy chọn + Khoác/Giày/Phụ kiện.
//  Điểm bộ = 0.40 hợp dáng + 0.25 hòa sắc + 0.20 đồng nhất phong cách + 0.15 hợp dịp.
//  Phase B: phối quanh SP NEO (1a), lọc theo NGÂN SÁCH tổng (mềm), THAY 1 món (6a).
// ============================================================

type Slot = 'DRESS' | 'TOP' | 'BOTTOM' | 'OUTER' | 'SHOES' | 'ACCESSORY';
const SLOTS: Slot[] = ['DRESS', 'TOP', 'BOTTOM', 'OUTER', 'SHOES', 'ACCESSORY'];
const NEUTRALS = new Set(['black', 'white', 'beige', 'gray', 'navy', 'brown']);
const W = { body: 0.4, color: 0.25, style: 0.2, occasion: 0.15 };

function slotOf(garment: string | null, category: string): Slot | null {
  const g = (garment ?? '').toLowerCase();
  if (g === 'dress') return 'DRESS';
  if (['tshirt', 'blouse', 'shirt', 'sweater'].includes(g)) return 'TOP';
  if (g === 'jacket') return 'OUTER';
  if (['trousers', 'shorts', 'jeans', 'skirt'].includes(g)) return 'BOTTOM';
  const c = category.toLowerCase();
  if (c.includes('giày')) return 'SHOES';
  if (c.includes('phụ kiện')) return 'ACCESSORY';
  if (c.includes('đầm') || c.includes('váy')) return 'DRESS';
  if (c.includes('áo')) return 'TOP';
  if (c.includes('quần')) return 'BOTTOM';
  return null;
}

interface Item {
  id: number; name: string; price: number; slot: Slot;
  color: string | null; style: string | null; occasion: string | null;
  fit: number; image: string | null;
}

interface Ctx {
  shape: BodyShape | null;
  buckets: Record<Slot, Item[]>;
  byId: Map<number, Item>;
  colorScore: (items: Item[]) => { score: number; reason?: string };
  styleScore: (items: Item[]) => { score: number; reason?: string };
  occasionScore: (items: Item[], occasion?: string) => number;
}

// Dựng ngữ cảnh dùng chung (dáng khách + kho đã xếp slot + các hàm chấm điểm từ luật DB)
async function buildContext(userId: number): Promise<Ctx> {
  const bp = await prisma.bodyProfile.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { bodyShape: true } });
  const shape: BodyShape | null = bp?.bodyShape ?? null;
  const [rules, products] = await Promise.all([
    prisma.outfitRule.findMany({ where: { active: true } }),
    prisma.product.findMany({ include: { analysis: true, bodyFits: true, category: true, images: true } }),
  ]);

  const colorRule = new Map<string, { score: number; reason: string }>();
  const styleRule = new Map<string, { score: number; reason: string }>();
  for (const r of rules) {
    if (!r.subjectB) continue;
    const m = r.kind === 'COLOR' ? colorRule : r.kind === 'STYLE' ? styleRule : null;
    if (!m) continue;
    m.set(`${r.subjectA}|${r.subjectB}`, { score: r.score, reason: r.reason });
    m.set(`${r.subjectB}|${r.subjectA}`, { score: r.score, reason: r.reason });
  }

  const buckets: Record<Slot, Item[]> = { DRESS: [], TOP: [], BOTTOM: [], OUTER: [], SHOES: [], ACCESSORY: [] };
  const byId = new Map<number, Item>();
  for (const p of products) {
    if (!p.analysis) continue; // chỉ SP đã gán nhãn (UC4.1)
    const a = (p.analysis.attributes as Record<string, string> | null) ?? {};
    const slot = slotOf(a.garmentType ?? p.garmentType, p.category.name);
    if (!slot) continue;
    const fit = shape ? (p.bodyFits.find((f) => f.bodyShape === shape)?.score ?? 0.5) : 0.5;
    const item: Item = {
      id: p.id, name: p.name, price: p.price, slot,
      color: a.color ?? p.color, style: a.style ?? p.style, occasion: a.occasion ?? p.occasion,
      fit, image: p.images[0]?.url ?? null,
    };
    buckets[slot].push(item);
    byId.set(item.id, item);
  }

  const colorScore = (items: Item[]) => {
    const cols = items.map((i) => i.color).filter(Boolean) as string[];
    let s = 0.6; let best: { score: number; reason: string } | undefined;
    for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) {
      const r = colorRule.get(`${cols[i]}|${cols[j]}`);
      if (r) { s += r.score; if (!best || r.score > best.score) best = r; }
      else if (NEUTRALS.has(cols[i]) || NEUTRALS.has(cols[j])) s += 0.05;
    }
    return { score: Math.max(0, Math.min(1, s)), reason: best && best.score > 0 ? best.reason : undefined };
  };
  const styleScore = (items: Item[]) => {
    const st = items.map((i) => i.style).filter(Boolean) as string[];
    if (st.length < 2) return { score: 0.8 };
    if (st.every((x) => x === st[0])) return { score: 1, reason: `Đồng nhất phong cách ${st[0]}` };
    for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
      const r = styleRule.get(`${st[i]}|${st[j]}`);
      if (r) return { score: 0.75, reason: r.reason };
    }
    return { score: 0.5 };
  };
  const occasionScore = (items: Item[], occasion?: string) => {
    const occ = items.map((i) => i.occasion).filter(Boolean) as string[];
    if (occasion) return occ.length && occ.every((o) => o === occasion) ? 1 : occ.includes(occasion) ? 0.7 : 0.4;
    if (occ.length >= 2 && occ.every((o) => o === occ[0])) return 0.9;
    return 0.7;
  };

  return { shape, buckets, byId, colorScore, styleScore, occasionScore };
}

const top = (arr: Item[], n: number) => [...arr].sort((x, y) => y.fit - x.fit).slice(0, n);

export async function composeOutfits(
  userId: number,
  opts: { occasion?: string; limit?: number; anchorProductId?: number; budget?: number } = {},
) {
  const limit = Math.min(20, opts.limit ?? 6);
  const ctx = await buildContext(userId);
  const { colorScore, styleScore, occasionScore, shape } = ctx;

  // SP neo (1a): giữ cố định món này, phối phần còn lại quanh nó
  let anchor: Item | null = null;
  if (opts.anchorProductId != null) {
    anchor = ctx.byId.get(opts.anchorProductId) ?? null;
    if (!anchor) return { bodyShape: shape, anchorProductId: opts.anchorProductId, note: 'Sản phẩm neo không hợp lệ hoặc chưa gán nhãn.', total: 0, items: [] as any[] };
  }

  const forced: Partial<Record<Slot, Item>> = {};
  let dresses: Item[], tops: Item[], bottoms: Item[];
  if (anchor && anchor.slot === 'DRESS') { dresses = [anchor]; tops = []; bottoms = []; }
  else if (anchor && anchor.slot === 'TOP') { dresses = []; tops = [anchor]; bottoms = top(ctx.buckets.BOTTOM, 6); }
  else if (anchor && anchor.slot === 'BOTTOM') { dresses = []; tops = top(ctx.buckets.TOP, 6); bottoms = [anchor]; }
  else {
    dresses = top(ctx.buckets.DRESS, 5); tops = top(ctx.buckets.TOP, 5); bottoms = top(ctx.buckets.BOTTOM, 5);
    if (anchor) forced[anchor.slot] = anchor; // OUTER/SHOES/ACCESSORY -> gắn cố định add-on này
  }
  const outers = top(ctx.buckets.OUTER, 3), shoesC = top(ctx.buckets.SHOES, 3), accC = top(ctx.buckets.ACCESSORY, 3);

  const pickBest = (core: Item[], cands: Item[]): Item | null =>
    cands.length ? [...cands].sort((a, b) => colorScore([...core, b]).score - colorScore([...core, a]).score)[0] : null;

  const bases: Item[][] = [];
  for (const d of dresses) bases.push([d]);
  for (const t of tops) for (const b of bottoms) bases.push([t, b]);

  let outfits = bases.map((core) => {
    const outer = forced.OUTER ?? (outers.length ? pickBest(core, outers) : null);
    const withOuter = outer && (forced.OUTER || colorScore([...core, outer]).score >= colorScore(core).score) ? [...core, outer] : core;
    const shoes = forced.SHOES ?? pickBest(withOuter, shoesC);
    const acc = forced.ACCESSORY ?? pickBest(withOuter, accC);
    const scored = withOuter;

    const cs = colorScore(scored), ss = styleScore(scored), os = occasionScore(scored, opts.occasion);
    const bodyFit = scored.reduce((a, i) => a + i.fit, 0) / scored.length;
    const score = W.body * bodyFit + W.color * cs.score + W.style * ss.score + W.occasion * os;

    const reasons: string[] = [];
    if (shape && bodyFit >= 0.6) reasons.push(`Hợp dáng ${shapeVi(shape)}`);
    if (cs.reason) reasons.push(cs.reason);
    if (ss.reason) reasons.push(ss.reason);
    const items = [...scored, shoes, acc].filter(Boolean) as Item[];
    const totalPrice = items.reduce((a, i) => a + i.price, 0);

    return {
      items: items.map((i) => ({ id: i.id, name: i.name, slot: i.slot, color: i.color, style: i.style, price: i.price, image: i.image })),
      score: Math.round(score * 1000) / 1000,
      totalPrice,
      why: reasons.length ? reasons.slice(0, 2).join('; ') + '.' : 'Bộ phối cân đối từ kho.',
      breakdown: { bodyFit: Math.round(bodyFit * 1000) / 1000, color: Math.round(cs.score * 1000) / 1000, style: Math.round(ss.score * 1000) / 1000, occasion: os },
    };
  });

  // Khử trùng lặp theo tập id lõi, xếp hạng
  const seen = new Set<string>();
  let ranked = outfits.sort((a, b) => b.score - a.score).filter((o) => {
    const key = o.items.filter((i) => ['DRESS', 'TOP', 'BOTTOM', 'OUTER'].includes(i.slot)).map((i) => i.id).sort().join('-');
    if (seen.has(key)) return false; seen.add(key); return true;
  });

  // Ngân sách TỔNG (lọc mềm - không chặn quyền mua): ưu tiên bộ trong ngân sách; quá ít thì nới + ghi chú
  let note: string | null = null;
  if (opts.budget != null) {
    const within = ranked.filter((o) => o.totalPrice <= opts.budget!);
    if (within.length >= 2) ranked = within;
    else note = 'Không đủ bộ trong ngân sách — hiển thị các bộ gần nhất kèm tổng giá để bạn cân nhắc.';
  }

  return {
    bodyShape: shape,
    occasion: opts.occasion ?? null,
    anchorProductId: anchor?.id ?? null,
    budget: opts.budget ?? null,
    note,
    total: ranked.length,
    items: ranked.slice(0, limit),
  };
}

// UC5.2 (6a) - THAY 1 MÓN: gợi ý các món thay thế cho 1 slot, khớp với phần còn lại của bộ.
export async function outfitAlternatives(
  userId: number,
  opts: { slot: Slot; keepIds: number[]; occasion?: string; limit?: number },
) {
  const ctx = await buildContext(userId);
  const keep = opts.keepIds.map((id) => ctx.byId.get(id)).filter(Boolean) as Item[];
  const cands = (ctx.buckets[opts.slot] ?? []).filter((c) => !opts.keepIds.includes(c.id));

  const scored = cands.map((c) => {
    const set = [...keep, c];
    const cs = ctx.colorScore(set), ss = ctx.styleScore(set), os = ctx.occasionScore(set, opts.occasion);
    const score = W.body * c.fit + W.color * cs.score + W.style * ss.score + W.occasion * os;
    const reasons: string[] = [];
    if (ctx.shape && c.fit >= 0.6) reasons.push(`Hợp dáng ${shapeVi(ctx.shape)}`);
    if (cs.reason) reasons.push(cs.reason);
    if (ss.reason) reasons.push(ss.reason);
    return {
      product: { id: c.id, name: c.name, slot: c.slot, color: c.color, style: c.style, price: c.price, image: c.image },
      score: Math.round(score * 1000) / 1000,
      why: reasons.length ? reasons.slice(0, 2).join('; ') + '.' : 'Món thay thế phù hợp.',
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return { slot: opts.slot, keepIds: opts.keepIds, total: scored.length, items: scored.slice(0, Math.min(12, opts.limit ?? 6)) };
}

export const OUTFIT_SLOTS = SLOTS;

function shapeVi(s: BodyShape): string {
  return { HOURGLASS: 'đồng hồ cát', RECTANGLE: 'chữ nhật', PEAR: 'quả lê', APPLE: 'quả táo', INVERTED_TRIANGLE: 'tam giác ngược' }[s];
}
