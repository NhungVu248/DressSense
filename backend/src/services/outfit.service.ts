import type { BodyShape } from '@prisma/client';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC4 (bước B) - GHÉP BỘ ĐỒ từ KHO theo LUẬT PHỐI ĐỒ (UC4.2).
//  Mỗi bộ = (Đầm) HOẶC (Áo + Quần/Váy), tùy chọn + Áo khoác, + Giày, + Phụ kiện.
//  Điểm bộ = 0.40 hợp dáng + 0.25 hòa sắc + 0.20 đồng nhất phong cách + 0.15 hợp dịp.
//  Hòa sắc & tương thích phong cách lấy từ OutfitRule (DB) -> Admin điều chỉnh được.
// ============================================================

type Slot = 'DRESS' | 'TOP' | 'BOTTOM' | 'OUTER' | 'SHOES' | 'ACCESSORY';
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
  fit: number; // điểm hợp dáng (ProductBodyFit theo dáng khách), 0.5 nếu không có
  image: string | null;
}

export async function composeOutfits(userId: number, opts: { occasion?: string; limit?: number } = {}) {
  const limit = Math.min(20, opts.limit ?? 6);
  const bp = await prisma.bodyProfile.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' }, select: { bodyShape: true } });
  const shape: BodyShape | null = bp?.bodyShape ?? null;

  const [rules, products] = await Promise.all([
    prisma.outfitRule.findMany({ where: { active: true } }),
    prisma.product.findMany({ include: { analysis: true, bodyFits: true, category: true, images: true } }),
  ]);

  // Bản đồ luật hòa sắc / phong cách (2 chiều)
  const colorRule = new Map<string, { score: number; reason: string }>();
  const styleRule = new Map<string, { score: number; reason: string }>();
  for (const r of rules) {
    if (!r.subjectB) continue;
    const m = r.kind === 'COLOR' ? colorRule : r.kind === 'STYLE' ? styleRule : null;
    if (!m) continue;
    m.set(`${r.subjectA}|${r.subjectB}`, { score: r.score, reason: r.reason });
    m.set(`${r.subjectB}|${r.subjectA}`, { score: r.score, reason: r.reason });
  }

  // Xếp sản phẩm vào slot
  const buckets: Record<Slot, Item[]> = { DRESS: [], TOP: [], BOTTOM: [], OUTER: [], SHOES: [], ACCESSORY: [] };
  for (const p of products) {
    const a = (p.analysis?.attributes as Record<string, string> | null) ?? {};
    const slot = slotOf(a.garmentType ?? p.garmentType, p.category.name);
    if (!slot) continue;
    const fit = shape ? (p.bodyFits.find((f) => f.bodyShape === shape)?.score ?? 0.5) : 0.5;
    buckets[slot].push({
      id: p.id, name: p.name, price: p.price, slot,
      color: a.color ?? p.color, style: a.style ?? p.style, occasion: a.occasion ?? p.occasion,
      fit, image: p.images[0]?.url ?? null,
    });
  }
  // Giới hạn ứng viên theo độ hợp dáng để tránh bùng nổ tổ hợp
  const top = (arr: Item[], n: number) => [...arr].sort((x, y) => y.fit - x.fit).slice(0, n);
  const dresses = top(buckets.DRESS, 5), tops = top(buckets.TOP, 5), bottoms = top(buckets.BOTTOM, 5);
  const outers = top(buckets.OUTER, 3), shoesC = top(buckets.SHOES, 3), accC = top(buckets.ACCESSORY, 3);

  // Hòa sắc giữa 1 tập item (xét từng cặp màu)
  function colorScore(items: Item[]): { score: number; reason?: string } {
    const cols = items.map((i) => i.color).filter(Boolean) as string[];
    let s = 0.6; let best: { score: number; reason: string } | undefined;
    for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) {
      const r = colorRule.get(`${cols[i]}|${cols[j]}`);
      if (r) { s += r.score; if (!best || r.score > best.score) best = r; }
      else if (NEUTRALS.has(cols[i]) || NEUTRALS.has(cols[j])) s += 0.05; // trung tính dễ phối
    }
    return { score: Math.max(0, Math.min(1, s)), reason: best && best.score > 0 ? best.reason : undefined };
  }

  function styleScore(items: Item[]): { score: number; reason?: string } {
    const st = items.map((i) => i.style).filter(Boolean) as string[];
    if (st.length < 2) return { score: 0.8 };
    if (st.every((x) => x === st[0])) return { score: 1, reason: `Đồng nhất phong cách ${st[0]}` };
    for (let i = 0; i < st.length; i++) for (let j = i + 1; j < st.length; j++) {
      const r = styleRule.get(`${st[i]}|${st[j]}`);
      if (r) return { score: 0.75, reason: r.reason };
    }
    return { score: 0.5 };
  }

  function occasionScore(items: Item[]): number {
    const occ = items.map((i) => i.occasion).filter(Boolean) as string[];
    if (opts.occasion) return occ.length && occ.every((o) => o === opts.occasion) ? 1 : occ.includes(opts.occasion) ? 0.7 : 0.4;
    if (occ.length >= 2 && occ.every((o) => o === occ[0])) return 0.9;
    return 0.7;
  }

  // Chọn add-on (giày/phụ kiện/khoác) hòa sắc tốt nhất với phần lõi
  function pickBest(core: Item[], cands: Item[]): Item | null {
    if (!cands.length) return null;
    return [...cands].sort((a, b) => colorScore([...core, b]).score - colorScore([...core, a]).score)[0];
  }

  const bases: Item[][] = [];
  for (const d of dresses) bases.push([d]);
  for (const t of tops) for (const b of bottoms) bases.push([t, b]);

  const outfits = bases.map((core) => {
    const outer = outers.length ? pickBest(core, outers) : null;
    const withOuter = outer && colorScore([...core, outer]).score >= colorScore(core).score ? [...core, outer] : core;
    const shoes = pickBest(withOuter, shoesC);
    const acc = pickBest(withOuter, accC);
    const scored = withOuter; // phần tính điểm (giày/phụ kiện là gợi ý kèm)

    const cs = colorScore(scored), ss = styleScore(scored);
    const os = occasionScore(scored);
    const bodyFit = scored.reduce((a, i) => a + i.fit, 0) / scored.length;
    const score = W.body * bodyFit + W.color * cs.score + W.style * ss.score + W.occasion * os;

    const reasons: string[] = [];
    if (shape && bodyFit >= 0.6) reasons.push(`Hợp dáng ${shapeVi(shape)}`);
    if (cs.reason) reasons.push(cs.reason);
    if (ss.reason) reasons.push(ss.reason);
    const items = [...scored, shoes, acc].filter(Boolean) as Item[];

    return {
      items: items.map((i) => ({ id: i.id, name: i.name, slot: i.slot, color: i.color, style: i.style, price: i.price, image: i.image })),
      score: Math.round(score * 1000) / 1000,
      why: reasons.length ? reasons.slice(0, 2).join('; ') + '.' : 'Bộ phối cân đối từ kho.',
      breakdown: { bodyFit: Math.round(bodyFit * 1000) / 1000, color: Math.round(cs.score * 1000) / 1000, style: Math.round(ss.score * 1000) / 1000, occasion: os },
    };
  });

  // Khử trùng lặp theo tập id lõi, xếp hạng
  const seen = new Set<string>();
  const ranked = outfits.sort((a, b) => b.score - a.score).filter((o) => {
    const key = o.items.filter((i) => ['DRESS', 'TOP', 'BOTTOM', 'OUTER'].includes(i.slot)).map((i) => i.id).sort().join('-');
    if (seen.has(key)) return false; seen.add(key); return true;
  });

  return { bodyShape: shape, occasion: opts.occasion ?? null, total: ranked.length, items: ranked.slice(0, limit) };
}

function shapeVi(s: BodyShape): string {
  return { HOURGLASS: 'đồng hồ cát', RECTANGLE: 'chữ nhật', PEAR: 'quả lê', APPLE: 'quả táo', INVERTED_TRIANGLE: 'tam giác ngược' }[s];
}
