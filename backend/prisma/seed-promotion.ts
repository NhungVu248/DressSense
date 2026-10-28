import { PrismaClient } from '@prisma/client';

// UC13.1 - seed dữ liệu khuyến mãi mẫu: 1 voucher theo danh mục + 1 Flash Sale.
// Tự dò sản phẩm/danh mục/gian hàng có sẵn để không phụ thuộc id cứng.
const prisma = new PrismaClient();

async function main() {
  // Chọn một sản phẩm ACTIVE còn tồn kho để làm Flash Sale
  const product = await prisma.product.findFirst({
    where: { status: 'ACTIVE', deletedAt: null, variants: { some: { stock: { gt: 0 } } } },
    include: { variants: true },
  });
  if (!product) {
    console.log('Chưa có sản phẩm phù hợp để seed khuyến mãi. Bỏ qua.');
    return;
  }

  // ---- Voucher theo danh mục (của chính gian hàng sở hữu sản phẩm) ----
  const code = 'CAT15';
  await prisma.voucher.upsert({
    where: { code },
    update: {
      description: 'Giảm 15% cho danh mục chọn lọc, tối đa 120.000₫',
      type: 'PERCENT', value: 15, minOrder: 200000, maxDiscount: 120000,
      status: 'RUNNING', active: true, sellerId: product.sellerId,
      scope: 'CATEGORY', scopeIds: [product.categoryId], perUserLimit: 2,
    },
    create: {
      code, description: 'Giảm 15% cho danh mục chọn lọc, tối đa 120.000₫',
      type: 'PERCENT', value: 15, minOrder: 200000, maxDiscount: 120000,
      status: 'RUNNING', active: true, sellerId: product.sellerId,
      scope: 'CATEGORY', scopeIds: [product.categoryId], perUserLimit: 2,
    },
  });

  // ---- Flash Sale đang diễn ra (giảm ~25% so với giá gốc) ----
  const totalStock = product.variants.reduce((s, v) => s + Math.max(0, v.stock - v.reserved), 0);
  const quantity = Math.max(1, Math.min(10, totalStock));
  const salePrice = Math.max(1000, Math.floor((product.price * 0.75) / 1000) * 1000);
  const now = new Date();
  const endsAt = new Date(now.getTime() + 3 * 86400_000); // còn 3 ngày

  const existing = await prisma.flashSale.findFirst({ where: { productId: product.id } });
  if (existing) {
    await prisma.flashSale.update({
      where: { id: existing.id },
      data: { salePrice, quantity, startsAt: now, endsAt, status: 'RUNNING', perUserLimit: 2 },
    });
  } else {
    await prisma.flashSale.create({
      data: {
        sellerId: product.sellerId, productId: product.id, salePrice, quantity,
        perUserLimit: 2, startsAt: now, endsAt, status: 'RUNNING',
      },
    });
  }

  console.log(`Seeded khuyến mãi: voucher ${code} (danh mục ${product.categoryId}) + Flash Sale cho "${product.name}" giá ${salePrice.toLocaleString('vi-VN')}₫ x${quantity} suất.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
