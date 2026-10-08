/**
 * UC4.2 - Seed TRI THỨC THỜI TRANG vào DB:
 *   (a) FashionAttribute: danh mục thuộc tính chuẩn (dùng chung UC2/UC3/UC7) + alias để
 *       chuẩn hóa giá trị tự do của sản phẩm (vd "Xanh navy" -> navy) - phục vụ UC4.1.
 *   (b) ShapeFitRule: luật hợp dáng; (c) OutfitRule: luật phối đồ.
 *
 * Idempotent: attribute dùng upsert; fit/outfit-rule chỉ seed khi bảng rỗng (tránh ghi đè
 * sửa tay của Admin). Dùng được 2 cách: chạy trực tiếp (npm run db:seed:knowledge) hoặc
 * import seedKnowledge(db) để seed.ts gọi (chung 1 client, không mở thêm kết nối).
 */
import { PrismaClient, type AttributeType } from '@prisma/client';
import {
  STYLE_OPTIONS, COLOR_OPTIONS, GARMENT_OPTIONS, MATERIAL_OPTIONS, OCCASION_OPTIONS,
} from '../src/constants/personalization';
import { FASHION_KB, BODY_SHAPES } from '../src/constants/fashion-kb';

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

async function up(db: PrismaClient, type: AttributeType, code: string, label: string, aliases: string[], sortOrder: number) {
  await db.fashionAttribute.upsert({
    where: { type_code: { type, code } },
    update: { label, aliases: aliases.length ? aliases : undefined, sortOrder },
    create: { type, code, label, aliases: aliases.length ? aliases : undefined, sortOrder },
  });
}

async function seedAttributes(db: PrismaClient) {
  let n = 0;
  const bag: Array<[AttributeType, ReadonlyArray<{ value: string; label: string }>, Record<string, string[]>]> = [
    ['STYLE', STYLE_OPTIONS, STYLE_ALIAS],
    ['COLOR', COLOR_OPTIONS, COLOR_ALIAS],
    ['GARMENT', GARMENT_OPTIONS, GARMENT_ALIAS],
    ['MATERIAL', MATERIAL_OPTIONS, MATERIAL_ALIAS],
    ['OCCASION', OCCASION_OPTIONS, {}],
  ];
  for (const [type, opts, alias] of bag) {
    for (let i = 0; i < opts.length; i++) { await up(db, type, opts[i].value, opts[i].label, alias[opts[i].value] ?? [], i); n++; }
  }
  const raw: Array<[AttributeType, string[]]> = [['FIT', FIT], ['NECKLINE', NECKLINE], ['SLEEVE', SLEEVE], ['LENGTH', LENGTH]];
  for (const [type, vals] of raw) for (let i = 0; i < vals.length; i++) { await up(db, type, vals[i], vals[i], [], i); n++; }
  for (let i = 0; i < PATTERN.length; i++) { await up(db, 'PATTERN', PATTERN[i].code, PATTERN[i].label, [], i); n++; }
  for (let i = 0; i < BODY_SHAPES.length; i++) { await up(db, 'BODY_SHAPE', BODY_SHAPES[i], SHAPE_LABEL[BODY_SHAPES[i]], [], i); n++; }
  return n;
}

async function seedFitRules(db: PrismaClient) {
  if ((await db.shapeFitRule.count()) > 0) return 0; // đã có -> không ghi đè sửa tay
  const rows: any[] = [];
  for (const shape of BODY_SHAPES) {
    const kb = FASHION_KB[shape];
    for (const r of kb.prefer) rows.push({ bodyShape: shape, attr: r.attr, value: r.value, kind: 'PREFER', weight: r.weight, reason: r.reason });
    for (const r of kb.avoid) rows.push({ bodyShape: shape, attr: r.attr, value: r.value, kind: 'AVOID', weight: r.weight, reason: r.reason });
  }
  await db.shapeFitRule.createMany({ data: rows });
  return rows.length;
}

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

async function seedOutfitRules(db: PrismaClient) {
  if ((await db.outfitRule.count()) > 0) return 0;
  await db.outfitRule.createMany({
    data: OUTFIT.map(([kind, a, b, score, reason]) => ({ kind, subjectA: a, subjectB: b, score, reason })),
  });
  return OUTFIT.length;
}

// Seed toàn bộ tri thức dùng CHUNG 1 client (seed.ts truyền client của nó vào).
export async function seedKnowledge(db: PrismaClient) {
  const a = await seedAttributes(db);
  const r = await seedFitRules(db);
  const o = await seedOutfitRules(db);
  return {
    attributes: await db.fashionAttribute.count(),
    fitRules: await db.shapeFitRule.count(),
    outfitRules: await db.outfitRule.count(),
    seeded: { attributes: a, fitRules: r, outfitRules: o },
  };
}

// Chạy trực tiếp: npm run db:seed:knowledge (không chạy khi bị import bởi seed.ts)
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').includes('seed-knowledge')) {
  const prisma = new PrismaClient();
  seedKnowledge(prisma)
    .then((c) => { console.log('Seed tri thức xong:', c); return prisma.$disconnect(); })
    .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
}
