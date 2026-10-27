import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Người bán thứ 2 + sản phẩm - để kiểm thử đơn đa gian hàng (multi-shop)
const prisma = new PrismaClient();

async function main() {
  const pass = await bcrypt.hash('123456', 10);
  const seller2 = await prisma.user.upsert({
    where: { email: 'seller2@dresssense.vn' },
    update: {},
    create: { email: 'seller2@dresssense.vn', password: pass, fullName: 'Shop Local Style', role: 'SELLER', shopName: 'Local Style' },
  });

  // Lấy danh mục theo tên (an toàn hơn id cố định)
  const cat = async (name: string) => (await prisma.category.findFirst({ where: { name } }))?.id;
  const ao = await cat('Áo');
  const quan = await cat('Quần');
  const pk = await cat('Phụ kiện');

  const products = [
    { categoryId: ao!, name: 'Áo len cổ lọ (Local Style)', price: 390000, color: 'Xám', style: 'Casual', sizes: ['M', 'L', 'XL'] },
    { categoryId: quan!, name: 'Quần jogger nỉ (Local Style)', price: 340000, color: 'Đen', style: 'Streetwear', sizes: ['M', 'L', 'XL'] },
    { categoryId: pk!, name: 'Mũ len beanie (Local Style)', price: 120000, color: 'Be', style: 'Casual', sizes: ['Freesize'] },
  ];
  let created = 0;
  for (const p of products) {
    if (!p.categoryId) continue;
    if (await prisma.product.findFirst({ where: { name: p.name } })) continue;
    await prisma.product.create({
      data: {
        sellerId: seller2.id, categoryId: p.categoryId, name: p.name, price: p.price, color: p.color, style: p.style, status: 'ACTIVE',
        variants: { create: p.sizes.map((s) => ({ size: s, stock: 50 })) },
      },
    });
    created++;
  }
  console.log(`seller2 id=${seller2.id}, sản phẩm mới tạo=${created}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
