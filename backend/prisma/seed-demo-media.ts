import { PrismaClient } from '@prisma/client';

// ============================================================
//  Seed ẢNH DEMO + FLASH SALE cho sản phẩm (để chụp giao diện trang khách).
//  - Thay ảnh placehold.co bằng ảnh thời trang thật (Unsplash CDN) theo danh mục.
//  - Tạo vài Flash Sale đang chạy để trang khách hiện giá gốc + giá giảm + đếm ngược.
//  Chạy: npm run db:seed:demo-media
// ============================================================

const prisma = new PrismaClient();

const U = (id: string, w = 800) => `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

// Bể ảnh theo nhóm (các id Unsplash đã kiểm tra trả 200)
const POOLS: Record<string, string[]> = {
  dress: ['photo-1595777457583-95e059d581b8', 'photo-1572804013309-59a88b7e92f1', 'photo-1612336307429-8a898d10e223', 'photo-1583846783214-7229a91b20ed'],
  topWomen: ['photo-1434389677669-e08b4cac3105', 'photo-1583743814966-8936f5b7be1a', 'photo-1521572163474-6864f9cf17ab'],
  topMen: ['photo-1594938298603-c8148c4dae35', 'photo-1521572163474-6864f9cf17ab', 'photo-1583743814966-8936f5b7be1a'],
  pants: ['photo-1542272604-787c3835535d', 'photo-1624378439575-d8705ad7ae80', 'photo-1591195853828-11db59a44f6b'],
  skirt: ['photo-1583496661160-fb5886a0aaaa', 'photo-1595777457583-95e059d581b8', 'photo-1572804013309-59a88b7e92f1'],
  shoesHeel: ['photo-1543163521-1bf539c55dd2', 'photo-1549298916-b41d501d3772'],
  sneaker: ['photo-1549298916-b41d501d3772', 'photo-1543163521-1bf539c55dd2'],
  bag: ['photo-1584917865442-de89df76afd3', 'photo-1591195853828-11db59a44f6b'],
  belt: ['photo-1624222247344-550fb60583dc', 'photo-1584917865442-de89df76afd3'],
  beanie: ['photo-1576871337622-98d48d1cf531', 'photo-1594938298603-c8148c4dae35'],
};

// Chọn bể ảnh phù hợp cho một sản phẩm theo danh mục/tên/giới tính.
function poolFor(p: { name: string; category: string; targetGender: string | null }): string[] {
  const name = p.name.toLowerCase();
  if (p.category.includes('Đầm') || p.category.includes('Váy')) return POOLS.dress;
  if (p.category === 'Giày') return name.includes('cao gót') || name.includes('gót') ? POOLS.shoesHeel : POOLS.sneaker;
  if (p.category === 'Phụ kiện') {
    if (name.includes('túi')) return POOLS.bag;
    if (name.includes('mũ') || name.includes('beanie')) return POOLS.beanie;
    return POOLS.belt;
  }
  if (p.category === 'Quần') {
    if (name.includes('chân váy')) return POOLS.skirt;
    return POOLS.pants;
  }
  if (p.category === 'Áo') return p.targetGender === 'Nam' ? POOLS.topMen : POOLS.topWomen;
  return POOLS.topWomen;
}

async function main() {
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE', deletedAt: null },
    select: { id: true, name: true, price: true, sellerId: true, targetGender: true, category: { select: { name: true } } },
    orderBy: { id: 'asc' },
  });

  // 1) Gán 3 ảnh thật cho từng sản phẩm (xoay bể ảnh theo id để lead-image đa dạng)
  let imgCount = 0;
  for (const p of products) {
    const pool = poolFor({ name: p.name, category: p.category.name, targetGender: p.targetGender });
    const rotated = pool.map((_, i) => pool[(i + p.id) % pool.length]);
    const pick = rotated.slice(0, 3);
    await prisma.$transaction([
      prisma.productImage.deleteMany({ where: { productId: p.id } }),
      prisma.productImage.createMany({
        data: pick.map((id, i) => ({ productId: p.id, url: U(id), isPrimary: i === 0, sortOrder: i })),
      }),
    ]);
    imgCount += pick.length;
  }
  console.log(`Đã gán ảnh demo cho ${products.length} sản phẩm (${imgCount} ảnh).`);

  // 2) Flash Sale đang chạy cho một số sản phẩm -> trang khách hiện giá gốc + giảm + đếm ngược
  const now = Date.now();
  const H = 3600 * 1000, D = 24 * H;
  // [productId, % giảm, kết thúc sau (ms)]
  const deals: [number, number, number][] = [
    [73, 30, 2 * H],   // Đầm bodycon - sắp hết giờ
    [77, 25, 8 * H],   // Áo sơ mi nữ
    [84, 20, 2 * D],   // Sneaker trắng
    [88, 35, 3 * D],   // Blazer nam
    [90, 15, 6 * H],   // Quần short
    [95, 40, 2 * D],   // Áo len (gian hàng Local Style)
  ];

  await prisma.flashSale.deleteMany({ where: { productId: { in: deals.map((d) => d[0]) } } });
  let fsCount = 0;
  for (const [productId, pct, endMs] of deals) {
    const prod = products.find((p) => p.id === productId);
    if (!prod) continue;
    const salePrice = Math.max(1000, Math.round((prod.price * (100 - pct)) / 100 / 1000) * 1000);
    await prisma.flashSale.create({
      data: {
        sellerId: prod.sellerId, productId, variantId: null, salePrice,
        quantity: 50, soldCount: Math.floor(Math.random() * 10),
        perUserLimit: 2, startsAt: new Date(now - H), endsAt: new Date(now + endMs), status: 'RUNNING',
      },
    });
    fsCount++;
  }
  console.log(`Đã tạo ${fsCount} Flash Sale đang chạy (giá giảm + đếm ngược).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
