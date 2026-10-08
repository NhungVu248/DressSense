/**
 * UC4.2 - Seed TRI THỨC THỜI TRANG vào DB:
 *   (a) FashionAttribute: danh mục thuộc tính chuẩn (dùng chung UC2/UC3/UC7) + alias để
 *       chuẩn hóa giá trị tự do của sản phẩm (vd "Xanh navy" -> navy) - phục vụ UC4.1.
 *   (b) ShapeFitRule: luật hợp dáng, chuyển từ FASHION_KB hard-code vào DB.
 *
 * Idempotent: attribute dùng upsert (không ghi đè alias đã chỉnh tay nếu giữ nguyên code);
 * fit-rule chỉ seed khi bảng rỗng (tránh xóa luật Admin đã sửa). Chạy: npm run db:seed:knowledge
 */
import 'dotenv/config';
import { PrismaClient, type AttributeType } from '@prisma/client';
import {
  STYLE_OPTIONS, COLOR_OPTIONS, GARMENT_OPTIONS, MATERIAL_OPTIONS, OCCASION_OPTIONS,
} from '../src/constants/personalization';
import { FASHION_KB, BODY_SHAPES } from '../src/constants/fashion-kb';

const prisma = new PrismaClient();

// alias: mã chuẩn -> các biến thể tự do xuất hiện trong kho (để UC4.1 chuẩn hóa)
const COLOR_ALIAS: Record<string, string[]> = {
  red: ['Đỏ đô', 'Đỏ'], beige: ['Be', 'Trắng kem', 'Kem'], navy: ['Xanh navy', 'Xanh than'],
  black: ['Đen'], white: ['Trắng'], pink: ['Hồng pastel', 'Hồng'], green: ['Xanh rêu', 'Xanh lá'],
  brown: ['Nâu'], gray: ['Xám'], blue: ['Xanh denim', 'Xanh dương'],
};
const STYLE_ALIAS: Record<string, string[]> = {
  classic: ['Office', 'Công sở'], street: ['Streetwear', 'Đường phố'],
  elegant: ['Party', 'Dự tiệc'], minimalist: ['Casual', 'Thường ngày'], sporty: ['Thể thao'],
};
const MATERIAL_ALIAS: Record<string, string[]> = {
  knit: ['Thun', 'Dệt kim'], silk: ['Voan', 'Lụa'], wool: ['Tuytsi', 'Len'],
  cotton: ['Cotton', 'Kaki', 'Canvas'], leather: ['Da'], denim: ['Denim'], linen: ['Linen'],
};
const GARMENT_ALIAS: Record<string, string[]> = {
  dress: ['Đầm sát nách', 'Đầm ngắn', 'Đầm lửng', 'Đầm', 'Váy liền', 'Áo dài'],
  blouse: ['Áo phồng', 'Áo kiểu', 'Áo sát nách'], tshirt: ['Áo thun tay ngắn', 'Áo thun'],
  jacket: ['Áo khoác tay dài', 'Áo khoác'], trousers: ['Quần dài', 'Quần âu'],
  shorts: ['Quần short', 'Quần đùi'], skirt: ['Chân váy'],
};

// Giá trị chuẩn cho các trường dùng trong LUẬT HỢP DÁNG (khớp đúng value trên sản phẩm & KB)
const FIT = ['Slim', 'Regular', 'Straight', 'Flare'];
const NECKLINE = ['Tròn', 'Cổ V', 'Cổ thuyền', 'Cổ vest'];
const SLEEVE = ['Sát nách', 'Ngắn', 'Lửng', 'Dài', 'Phồng'];
const LENGTH = ['Croptop', 'Ngắn', 'Vừa', 'Midi', 'Maxi', 'Dài'];
const PATTERN = [
  { code: 'solid', label: 'Trơn' }, { code: 'striped', label: 'Kẻ sọc' },
  { code: 'floral', label: 'Hoa' }, { code: 'checked', label: 'Caro' },
  { code: 'printed', label: 'Họa tiết in' }, { code: 'dotted', label: 'Chấm bi' },
];
const SHAPE_LABEL: Record<string, string> = {
  HOURGLASS: 'Đồng hồ cát', RECTANGLE: 'Chữ nhật', PEAR: 'Quả lê',
  APPLE: 'Quả táo', INVERTED_TRIANGLE: 'Tam giác ngược',
};

async function up(type: AttributeType, code: string, label: string, aliases: string[], sortOrder: number) {
  await prisma.fashionAttribute.upsert({
    where: { type_code: { type, code } },
    update: { label, aliases: aliases.length ? aliases : undefined, sortOrder },
    create: { type, code, label, aliases: aliases.length ? aliases : undefined, sortOrder },
  });
}

async function seedAttributes() {
  let n = 0;
  const bag: Array<[AttributeType, ReadonlyArray<{ value: string; label: string }>, Record<string, string[]>]> = [
    ['STYLE', STYLE_OPTIONS, STYLE_ALIAS],
    ['COLOR', COLOR_OPTIONS, COLOR_ALIAS],
    ['GARMENT', GARMENT_OPTIONS, GARMENT_ALIAS],
    ['MATERIAL', MATERIAL_OPTIONS, MATERIAL_ALIAS],
    ['OCCASION', OCCASION_OPTIONS, {}],
  ];
  for (const [type, opts, alias] of bag) {
    for (let i = 0; i < opts.length; i++) { await up(type, opts[i].value, opts[i].label, alias[opts[i].value] ?? [], i); n++; }
  }
  // Thuộc tính dùng cho LUẬT HỢP DÁNG: code = value trên sản phẩm (không cần alias)
  const raw: Array<[AttributeType, string[]]> = [['FIT', FIT], ['NECKLINE', NECKLINE], ['SLEEVE', SLEEVE], ['LENGTH', LENGTH]];
  for (const [type, vals] of raw) for (let i = 0; i < vals.length; i++) { await up(type, vals[i], vals[i], [], i); n++; }
  for (let i = 0; i < PATTERN.length; i++) { await up('PATTERN', PATTERN[i].code, PATTERN[i].label, [], i); n++; }
  for (let i = 0; i < BODY_SHAPES.length; i++) { await up('BODY_SHAPE', BODY_SHAPES[i], SHAPE_LABEL[BODY_SHAPES[i]], [], i); n++; }
  return n;
}

async function seedFitRules() {
  const existing = await prisma.shapeFitRule.count();
  if (existing > 0) { console.log(`ShapeFitRule đã có ${existing} luật -> bỏ qua (tránh ghi đè sửa tay).`); return 0; }
  const rows: any[] = [];
  for (const shape of BODY_SHAPES) {
    const kb = FASHION_KB[shape];
    for (const r of kb.prefer) rows.push({ bodyShape: shape, attr: r.attr, value: r.value, kind: 'PREFER', weight: r.weight, reason: r.reason });
    for (const r of kb.avoid) rows.push({ bodyShape: shape, attr: r.attr, value: r.value, kind: 'AVOID', weight: r.weight, reason: r.reason });
  }
  await prisma.shapeFitRule.createMany({ data: rows });
  return rows.length;
}

// Luật PHỐI ĐỒ: hòa sắc (COLOR) + tương thích phong cách (STYLE). Seed khi bảng rỗng.
const OUTFIT: Array<['COLOR' | 'STYLE', string, string, number, string]> = [
  ['COLOR', 'navy', 'beige', 0.25, 'Navy + be trung tính, dễ phối'],
  ['COLOR', 'navy', 'white', 0.25, 'Navy + trắng thanh lịch'],
  ['COLOR', 'black', 'white', 0.2, 'Đen + trắng kinh điển'],
  ['COLOR', 'beige', 'brown', 0.2, 'Be + nâu tông đất hài hòa'],
  ['COLOR', 'gray', 'pink', 0.15, 'Xám + hồng nhẹ nhàng'],
  ['COLOR', 'white', 'red', 0.15, 'Trắng + đỏ nổi bật'],
  ['COLOR', 'black', 'red', 0.15, 'Đen + đỏ cá tính'],
  ['COLOR', 'navy', 'pink', 0.1, 'Navy + hồng dịu'],
  ['COLOR', 'green', 'beige', 0.15, 'Xanh lá + be tự nhiên'],
  ['COLOR', 'red', 'green', -0.3, 'Đỏ + xanh lá dễ chỏi'],
  ['COLOR', 'red', 'pink', -0.2, 'Đỏ + hồng cùng tông nóng dễ rối'],
  ['COLOR', 'orange', 'pink', -0.2, 'Cam + hồng chói'],
  ['COLOR', 'purple', 'green', -0.2, 'Tím + xanh lá kị'],
  ['STYLE', 'minimalist', 'classic', 0.1, 'Tối giản + công sở hợp'],
  ['STYLE', 'elegant', 'classic', 0.1, 'Thanh lịch + công sở hợp'],
  ['STYLE', 'street', 'sporty', 0.1, 'Đường phố + năng động hợp'],
];

async function seedOutfitRules() {
  const existing = await prisma.outfitRule.count();
  if (existing > 0) { console.log(`OutfitRule đã có ${existing} luật -> bỏ qua.`); return 0; }
  await prisma.outfitRule.createMany({
    data: OUTFIT.map(([kind, a, b, score, reason]) => ({ kind, subjectA: a, subjectB: b, score, reason })),
  });
  return OUTFIT.length;
}

async function main() {
  const a = await seedAttributes();
  const r = await seedFitRules();
  const o = await seedOutfitRules();
  const counts = {
    attributes: await prisma.fashionAttribute.count(),
    fitRules: await prisma.shapeFitRule.count(),
    outfitRules: await prisma.outfitRule.count(),
  };
  console.log(`Seed tri thức xong: upsert ${a} thuộc tính, ${r} luật hợp dáng, ${o} luật phối đồ.`);
  console.log('Tổng trong DB:', counts);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
