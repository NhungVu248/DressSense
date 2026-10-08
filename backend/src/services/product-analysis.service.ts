import { prisma } from '../lib/prisma';
import { scoreProductAllShapesDb } from './fashion-kb.service';

// ============================================================
//  UC4.1 - PHÂN TÍCH SẢN PHẨM: chuẩn hóa thuộc tính đa chiều từ tên/mô tả/danh mục
//  (+ màu từ ảnh ở bước sau), gắn ĐỘ TIN CẬY, suy dịp + điểm hợp dáng (ProductBodyFit).
//  Nhãn do AI đề xuất -> trạng thái UNCONFIRMED, chờ Người bán/Admin xác nhận.
// ============================================================

const LOW_CONF = 0.7; // dưới ngưỡng -> ưu tiên người xem lại (quy tắc nghiệp vụ UC4.1)

// Loại thuộc tính (FashionAttribute.type) -> cột tương ứng trên Product
const DIM: Array<{ type: string; field: string; textInfer: boolean }> = [
  { type: 'GARMENT', field: 'garmentType', textInfer: true },
  { type: 'COLOR', field: 'color', textInfer: true },
  { type: 'MATERIAL', field: 'material', textInfer: true },
  { type: 'FIT', field: 'fit', textInfer: false },
  { type: 'NECKLINE', field: 'neckline', textInfer: false },
  { type: 'SLEEVE', field: 'sleeve', textInfer: false },
  { type: 'LENGTH', field: 'length', textInfer: false },
  { type: 'STYLE', field: 'style', textInfer: true },
  { type: 'OCCASION', field: 'occasion', textInfer: false },
  { type: 'PATTERN', field: 'pattern', textInfer: true },
];

type LookupEntry = { code: string; conf: number; text: string };

// Bảng tra chuẩn hóa theo type: text(thường hóa) -> {code, độ tin cậy}
async function buildLookups() {
  const attrs = await prisma.fashionAttribute.findMany({ where: { active: true } });
  const byType = new Map<string, LookupEntry[]>();
  for (const a of attrs) {
    const list = byType.get(a.type) ?? [];
    list.push({ code: a.code, conf: 0.95, text: a.code.toLowerCase() }); // khớp mã chuẩn
    list.push({ code: a.code, conf: 0.85, text: a.label.toLowerCase() }); // khớp nhãn
    for (const al of ((a.aliases as string[] | null) ?? [])) list.push({ code: a.code, conf: 0.9, text: String(al).toLowerCase() }); // khớp alias
    byType.set(a.type, list);
  }
  return byType;
}

function normalizeField(entries: LookupEntry[] | undefined, raw?: string | null): { code: string; conf: number } | null {
  if (!entries || !raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  // ưu tiên khớp chính xác (conf cao nhất)
  const exact = entries.filter((e) => e.text === v).sort((a, b) => b.conf - a.conf)[0];
  if (exact) return { code: exact.code, conf: exact.conf };
  return null;
}

// Suy nhãn từ VĂN BẢN (tên + mô tả) khi trường cấu trúc trống - luồng 3a (không ảnh)
function inferFromText(entries: LookupEntry[] | undefined, text: string): { code: string; conf: number } | null {
  if (!entries || !text) return null;
  const t = text.toLowerCase();
  const hit = entries
    .filter((e) => e.text.length >= 3 && t.includes(e.text))
    .sort((a, b) => b.text.length - a.text.length)[0];
  return hit ? { code: hit.code, conf: 0.6 } : null;
}

export async function analyzeProduct(productId: number, opts: { engine?: string; extraColor?: { code: string; conf: number } | null } = {}) {
  const product = await prisma.product.findUnique({ where: { id: productId }, include: { category: true } });
  if (!product) throw new Error('PRODUCT_NOT_FOUND');

  const lookups = await buildLookups();
  const text = `${product.name} ${product.description ?? ''} ${product.category?.name ?? ''}`;

  const attributes: Record<string, string> = {};
  const confidence: Record<string, number> = {};
  const lowConfidence: string[] = [];

  for (const d of DIM) {
    const entries = lookups.get(d.type);
    const raw = (product as Record<string, any>)[d.field] as string | null | undefined;
    let res = normalizeField(entries, raw);
    if (!res && d.textInfer) res = inferFromText(entries, text); // 3a - suy từ văn bản
    // màu từ ảnh (bước sau) bổ sung tín hiệu nếu trường color chưa chắc
    if (d.type === 'COLOR' && opts.extraColor && (!res || res.conf < opts.extraColor.conf)) res = opts.extraColor;
    if (res) {
      const key = d.field;
      attributes[key] = res.code;
      confidence[key] = res.conf;
      if (res.conf < LOW_CONF) lowConfidence.push(key);
    }
  }

  // Điểm hợp dáng: dùng giá trị trên sản phẩm (khớp value của luật) + luật từ DB
  const fits = await scoreProductAllShapesDb({ fit: product.fit, neckline: product.neckline, length: product.length, sleeve: product.sleeve });
  await prisma.$transaction(
    fits.map((f) => prisma.productBodyFit.upsert({
      where: { productId_bodyShape: { productId, bodyShape: f.bodyShape } },
      update: { score: f.score, reasons: f.reasons as any },
      create: { productId, bodyShape: f.bodyShape, score: f.score, reasons: f.reasons as any },
    })),
  );
  const bodyShapes = [...fits].sort((a, b) => b.score - a.score).slice(0, 3).map((f) => ({ bodyShape: f.bodyShape, score: f.score }));

  // 2E - thiếu dữ liệu đầu vào tối thiểu (không có nhãn nào + không mô tả)
  const hasInput = Object.keys(attributes).length > 0 || !!product.description;
  const status = hasInput ? 'UNCONFIRMED' : 'PENDING';
  const note = lowConfidence.length ? `${lowConfidence.length} nhãn độ tin cậy thấp cần xem lại.` : null;

  const analysis = await prisma.productAnalysis.upsert({
    where: { productId },
    update: {
      status: status as any, engine: opts.engine ?? 'rule',
      attributes, confidence, occasion: attributes.occasion ?? null,
      bodyShapes: bodyShapes as any, lowConfidence: lowConfidence as any, note,
      analyzedAt: new Date(), confirmedAt: null, confirmedBy: null,
    },
    create: {
      productId, status: status as any, engine: opts.engine ?? 'rule',
      attributes, confidence, occasion: attributes.occasion ?? null,
      bodyShapes: bodyShapes as any, lowConfidence: lowConfidence as any, note,
    },
  });
  return analysis;
}

// Luồng 1a - phân tích hàng loạt (xếp hàng tuần tự). sellerId -> chỉ SP của người bán đó.
export async function analyzeMany(sellerId?: number) {
  const products = await prisma.product.findMany({ where: sellerId ? { sellerId } : {}, select: { id: true } });
  let ok = 0;
  for (const p of products) { try { await analyzeProduct(p.id); ok++; } catch { /* bỏ qua SP lỗi, tiếp tục */ } }
  return { total: products.length, analyzed: ok };
}
