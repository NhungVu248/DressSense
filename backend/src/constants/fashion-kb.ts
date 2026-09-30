import type { BodyShape } from '@prisma/client';

// ============================================================
//  UC4 (GĐ4) - FASHION KNOWLEDGE BASE
//  Mở rộng STYLE_RECOMMENDATIONS (body-analysis.ts) thành tập luật có cấu trúc:
//  mỗi dáng người gắn với ưu tiên/tránh về phom (fit), cổ áo (neckline), độ dài
//  (length), tay áo (sleeve). Áp luật lên thuộc tính sản phẩm -> điểm tương thích
//  bodyShapeScore (0..1) + lý do (phục vụ giải thích "Vì sao hợp với bạn" ở UC5).
//
//  Bộ giá trị thuộc tính đồng bộ với seed sản phẩm (fit: Slim/Regular/Straight/Flare;
//  neckline: Tròn/Cổ V/Cổ thuyền; sleeve: Phồng/Sát nách/...; length: Midi/Maxi/Croptop...).
// ============================================================

export const BODY_SHAPES: BodyShape[] = ['HOURGLASS', 'RECTANGLE', 'PEAR', 'APPLE', 'INVERTED_TRIANGLE'];

type AttrKey = 'fit' | 'neckline' | 'length' | 'sleeve';

interface Rule {
  attr: AttrKey;
  value: string;
  weight: number; // đóng góp (+prefer / dùng trong avoid là mức trừ)
  reason: string;
}

interface ShapeKB {
  description: string;
  prefer: Rule[];
  avoid: Rule[];
}

export const FASHION_KB: Record<BodyShape, ShapeKB> = {
  HOURGLASS: {
    description: 'Vai và hông cân đối, eo thu nhỏ — tôn đường cong, nhấn eo.',
    prefer: [
      { attr: 'fit', value: 'Slim', weight: 0.28, reason: 'Phom ôm tôn eo và đường cong' },
      { attr: 'neckline', value: 'Cổ V', weight: 0.1, reason: 'Cổ V cân đối phần trên' },
      { attr: 'length', value: 'Croptop', weight: 0.08, reason: 'Croptop khoe eo' },
    ],
    avoid: [
      { attr: 'fit', value: 'Flare', weight: 0.12, reason: 'Phom xòe che mất đường eo' },
    ],
  },
  RECTANGLE: {
    description: 'Vai–eo–hông gần thẳng — tạo hiệu ứng đường cong, nhấn eo.',
    prefer: [
      { attr: 'fit', value: 'Flare', weight: 0.26, reason: 'Phom xòe tạo đường cong' },
      { attr: 'neckline', value: 'Cổ thuyền', weight: 0.14, reason: 'Cổ thuyền mở rộng phần vai' },
      { attr: 'sleeve', value: 'Phồng', weight: 0.12, reason: 'Tay phồng tạo khối phần trên' },
    ],
    avoid: [
      { attr: 'fit', value: 'Straight', weight: 0.12, reason: 'Phom thẳng làm thân hình phẳng thêm' },
    ],
  },
  PEAR: {
    description: 'Hông rộng hơn vai/ngực — cân đối phần trên, làm gọn phần dưới.',
    prefer: [
      { attr: 'sleeve', value: 'Phồng', weight: 0.24, reason: 'Tay/vai bồng cân đối với hông' },
      { attr: 'neckline', value: 'Cổ thuyền', weight: 0.2, reason: 'Cổ thuyền mở vai, cân đối hông' },
      { attr: 'fit', value: 'Straight', weight: 0.14, reason: 'Phom suông làm gọn phần dưới' },
    ],
    avoid: [
      { attr: 'fit', value: 'Slim', weight: 0.18, reason: 'Phom bó làm lộ phần hông' },
    ],
  },
  APPLE: {
    description: 'Eo là phần rộng nhất — kéo dài thân trên, không siết eo.',
    prefer: [
      { attr: 'neckline', value: 'Cổ V', weight: 0.26, reason: 'Cổ V kéo dài thân trên' },
      { attr: 'fit', value: 'Regular', weight: 0.16, reason: 'Phom vừa, không siết eo/bụng' },
      { attr: 'length', value: 'Midi', weight: 0.08, reason: 'Độ dài midi cân đối' },
    ],
    avoid: [
      { attr: 'fit', value: 'Slim', weight: 0.2, reason: 'Phom bó siết vùng eo/bụng' },
      { attr: 'length', value: 'Croptop', weight: 0.16, reason: 'Croptop lộ vùng eo/bụng' },
    ],
  },
  INVERTED_TRIANGLE: {
    description: 'Vai/ngực rộng hơn hông — cân bằng, tạo khối phần dưới.',
    prefer: [
      { attr: 'fit', value: 'Flare', weight: 0.26, reason: 'Phom xòe tạo khối phần dưới' },
      { attr: 'fit', value: 'Straight', weight: 0.14, reason: 'Ống suông cân bằng phần dưới' },
      { attr: 'neckline', value: 'Cổ V', weight: 0.1, reason: 'Cổ V thu gọn phần trên' },
    ],
    avoid: [
      { attr: 'sleeve', value: 'Phồng', weight: 0.2, reason: 'Tay phồng làm vai thêm rộng' },
      { attr: 'neckline', value: 'Cổ thuyền', weight: 0.16, reason: 'Cổ thuyền mở vai càng rộng' },
    ],
  },
};

export interface ProductAttrs {
  fit?: string | null;
  neckline?: string | null;
  length?: string | null;
  sleeve?: string | null;
}

export interface FitReason {
  type: 'plus' | 'minus';
  reason: string;
  [key: string]: string; // để tương thích kiểu JSON đầu vào của Prisma
}

export interface FitResult {
  score: number; // 0..1, làm tròn 3 chữ số
  reasons: FitReason[];
}

const clamp = (v: number, lo = 0.05, hi = 0.98) => Math.max(lo, Math.min(hi, v));

// Chấm điểm 1 sản phẩm với 1 dáng người
export function scoreProductForShape(p: ProductAttrs, shape: BodyShape): FitResult {
  const kb = FASHION_KB[shape];
  let score = 0.5; // trung tính khi không có thuộc tính khớp (vd giày/phụ kiện)
  const reasons: FitReason[] = [];

  for (const r of kb.prefer) {
    if (p[r.attr] && p[r.attr] === r.value) {
      score += r.weight;
      reasons.push({ type: 'plus', reason: r.reason });
    }
  }
  for (const r of kb.avoid) {
    if (p[r.attr] && p[r.attr] === r.value) {
      score -= r.weight;
      reasons.push({ type: 'minus', reason: r.reason });
    }
  }
  return { score: Math.round(clamp(score) * 1000) / 1000, reasons };
}

// Chấm điểm 1 sản phẩm cho cả 5 dáng
export function scoreProductAllShapes(p: ProductAttrs) {
  return BODY_SHAPES.map((shape) => ({ bodyShape: shape, ...scoreProductForShape(p, shape) }));
}
