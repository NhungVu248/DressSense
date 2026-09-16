import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Danh mục mẫu
  const dress = await prisma.category.upsert({
    where: { slug: 'dress' },
    update: {},
    create: { name: 'Đầm / Váy', slug: 'dress' },
  });
  const top = await prisma.category.upsert({
    where: { slug: 'top' },
    update: {},
    create: { name: 'Áo', slug: 'top' },
  });
  await prisma.category.upsert({
    where: { slug: 'bottom' },
    update: {},
    create: { name: 'Quần', slug: 'bottom' },
  });
  await prisma.category.upsert({
    where: { slug: 'shoes' },
    update: {},
    create: { name: 'Giày', slug: 'shoes' },
  });
  await prisma.category.upsert({
    where: { slug: 'accessory' },
    update: {},
    create: { name: 'Phụ kiện', slug: 'accessory' },
  });

  // Tài khoản người bán mẫu
  const sellerPass = await bcrypt.hash('123456', 10);
  const seller = await prisma.user.upsert({
    where: { email: 'seller@dresssense.vn' },
    update: {},
    create: {
      email: 'seller@dresssense.vn',
      password: sellerPass,
      fullName: 'Shop DressSense',
      role: 'SELLER',
    },
  });

  // Tài khoản quản trị viên mẫu (UC1.7)
  const adminPass = await bcrypt.hash('Admin@123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@dresssense.vn' },
    update: {},
    create: {
      email: 'admin@dresssense.vn',
      password: adminPass,
      fullName: 'Quản Trị Viên Hệ Thống',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  // Tài khoản khách hàng mẫu
  const customerPass = await bcrypt.hash('123456', 10);
  await prisma.user.upsert({
    where: { email: 'customer@dresssense.vn' },
    update: {},
    create: {
      email: 'customer@dresssense.vn',
      password: customerPass,
      fullName: 'Khách Hàng Mẫu',
      role: 'CUSTOMER',
    },
  });

  // Sản phẩm mẫu
  await prisma.product.create({
    data: {
      sellerId: seller.id,
      categoryId: dress.id,
      name: 'Đầm suông linen mùa hè',
      description: 'Đầm suông chất linen thoáng mát, phù hợp dáng Rectangle & Pear.',
      price: 450000,
      color: 'Be',
      material: 'Linen',
      fit: 'Regular',
      style: 'Casual',
      season: 'Hè',
      images: { create: [{ url: 'https://via.placeholder.com/400x500', isPrimary: true }] },
      variants: { create: [{ size: 'S', stock: 10 }, { size: 'M', stock: 15 }, { size: 'L', stock: 8 }] },
    },
  });

  await prisma.product.create({
    data: {
      sellerId: seller.id,
      categoryId: top.id,
      name: 'Áo sơ mi cổ V basic',
      description: 'Áo sơ mi cổ V tôn dáng, phù hợp dáng Apple & Inverted Triangle.',
      price: 320000,
      color: 'Trắng',
      material: 'Cotton',
      fit: 'Slim',
      style: 'Office',
      season: 'Quanh năm',
      images: { create: [{ url: 'https://via.placeholder.com/400x500', isPrimary: true }] },
      variants: { create: [{ size: 'M', stock: 20 }, { size: 'L', stock: 12 }] },
    },
  });

  console.log('✅ Seed dữ liệu mẫu thành công!');
  console.log('   Admin: admin@dresssense.vn / Admin@123');
  console.log('   Seller: seller@dresssense.vn / 123456');
  console.log('   Customer: customer@dresssense.vn / 123456');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
