import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { scoreProductAllShapes } from '../src/constants/fashion-kb';

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
  const bottom = await prisma.category.upsert({
    where: { slug: 'bottom' },
    update: {},
    create: { name: 'Quần', slug: 'bottom' },
  });
  const shoes = await prisma.category.upsert({
    where: { slug: 'shoes' },
    update: {},
    create: { name: 'Giày', slug: 'shoes' },
  });
  const accessory = await prisma.category.upsert({
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

  // Sản phẩm mẫu (Tầng C - làm giàu thuộc tính phục vụ matching/gợi ý ở GĐ4-5)
  // Reset kho để re-seed sạch (dev; các bảng liên quan ảnh/biến thể/giỏ/hành vi tự cascade)
  await prisma.product.deleteMany({});

  const IMG = 'https://placehold.co/400x500?text=DressSense';
  const std = (s: string[]) => s.map((size, i) => ({ size, stock: 10 + i * 3 }));

  const products: Array<{
    categoryId: number;
    name: string;
    description: string;
    price: number;
    color: string;
    pattern?: string;
    material?: string;
    fit?: string;
    length?: string;
    neckline?: string;
    sleeve?: string;
    style?: string;
    season?: string;
    garmentType?: string;
    targetGender?: string;
    brand?: string;
    occasion?: string;
    tags?: string[];
    sizes: string[];
  }> = [
    // ----- Đầm / Váy -----
    { categoryId: dress.id, name: 'Đầm ôm tôn eo bodycon', description: 'Đầm ôm nhấn eo, tôn đường cong — hợp dáng Đồng hồ cát.', price: 520000, color: 'Đỏ đô', pattern: 'Trơn', material: 'Thun', fit: 'Slim', length: 'Midi', neckline: 'Tròn', sleeve: 'Sát nách', style: 'Party', season: 'Quanh năm', sizes: ['S', 'M', 'L'] },
    { categoryId: dress.id, name: 'Đầm suông linen mùa hè', description: 'Đầm suông chất linen thoáng mát — hợp dáng Chữ nhật & Quả lê.', price: 450000, color: 'Be', pattern: 'Trơn', material: 'Linen', fit: 'Regular', length: 'Maxi', neckline: 'Tròn', sleeve: 'Ngắn', style: 'Casual', season: 'Hè', sizes: ['S', 'M', 'L'] },
    { categoryId: dress.id, name: 'Đầm chữ A cổ V', description: 'Đầm chữ A cổ V kéo dài thân trên — hợp dáng Quả táo & Tam giác ngược.', price: 480000, color: 'Xanh navy', pattern: 'Trơn', material: 'Voan', fit: 'Regular', length: 'Midi', neckline: 'Cổ V', sleeve: 'Lửng', style: 'Office', season: 'Quanh năm', sizes: ['M', 'L', 'XL'] },
    { categoryId: dress.id, name: 'Đầm peplum có belt', description: 'Đầm peplum kèm belt tạo eo — hợp dáng Chữ nhật.', price: 500000, color: 'Đen', pattern: 'Trơn', material: 'Tuytsi', fit: 'Regular', length: 'Midi', neckline: 'Tròn', sleeve: 'Ngắn', style: 'Office', season: 'Thu Đông', sizes: ['S', 'M', 'L'] },

    // ----- Áo -----
    { categoryId: top.id, name: 'Áo sơ mi cổ V basic', description: 'Áo sơ mi cổ V tôn dáng — hợp dáng Quả táo & Tam giác ngược.', price: 320000, color: 'Trắng', pattern: 'Trơn', material: 'Cotton', fit: 'Slim', length: 'Vừa', neckline: 'Cổ V', sleeve: 'Dài', style: 'Office', season: 'Quanh năm', sizes: ['M', 'L'] },
    { categoryId: top.id, name: 'Áo vai bồng cổ thuyền', description: 'Áo vai bồng cổ thuyền cân đối phần trên — hợp dáng Quả lê.', price: 290000, color: 'Hồng pastel', pattern: 'Trơn', material: 'Cotton', fit: 'Regular', length: 'Vừa', neckline: 'Cổ thuyền', sleeve: 'Phồng', style: 'Casual', season: 'Hè', sizes: ['S', 'M', 'L'] },
    { categoryId: top.id, name: 'Áo croptop ôm', description: 'Áo croptop ôm khoe eo — hợp dáng Đồng hồ cát.', price: 190000, color: 'Trắng kem', pattern: 'Trơn', material: 'Thun', fit: 'Slim', length: 'Croptop', neckline: 'Tròn', sleeve: 'Sát nách', style: 'Streetwear', season: 'Hè', sizes: ['S', 'M'] },

    // ----- Quần -----
    { categoryId: bottom.id, name: 'Quần ống suông tối màu', description: 'Quần ống suông tối màu cân đối phần dưới — hợp dáng Quả lê.', price: 350000, color: 'Đen', pattern: 'Trơn', material: 'Kaki', fit: 'Straight', length: 'Dài', style: 'Office', season: 'Quanh năm', sizes: ['S', 'M', 'L'] },
    { categoryId: bottom.id, name: 'Chân váy xòe chữ A', description: 'Chân váy xòe cân bằng phần dưới — hợp dáng Tam giác ngược & Chữ nhật.', price: 280000, color: 'Xanh rêu', pattern: 'Trơn', material: 'Tuytsi', fit: 'Flare', length: 'Midi', style: 'Casual', season: 'Thu Đông', sizes: ['S', 'M', 'L'] },
    { categoryId: bottom.id, name: 'Quần cạp cao ống đứng', description: 'Quần cạp cao vừa vặn, không siết eo — hợp dáng Quả táo.', price: 360000, color: 'Nâu', pattern: 'Trơn', material: 'Kaki', fit: 'Straight', length: 'Dài', style: 'Office', season: 'Quanh năm', sizes: ['M', 'L', 'XL'] },

    // ----- Giày -----
    { categoryId: shoes.id, name: 'Giày cao gót mũi nhọn', description: 'Giày cao gót mũi nhọn kéo dài chân.', price: 620000, color: 'Đen', pattern: 'Trơn', material: 'Da', style: 'Party', season: 'Quanh năm', sizes: ['37', '38', '39'] },
    { categoryId: shoes.id, name: 'Sneaker trắng basic', description: 'Sneaker trắng năng động, dễ phối.', price: 540000, color: 'Trắng', pattern: 'Trơn', material: 'Canvas', style: 'Streetwear', season: 'Quanh năm', sizes: ['38', '39', '40'] },

    // ----- Phụ kiện -----
    { categoryId: accessory.id, name: 'Thắt lưng bản nhỏ', description: 'Thắt lưng bản nhỏ tạo điểm nhấn eo — hợp dáng Chữ nhật & Quả táo.', price: 150000, color: 'Nâu', pattern: 'Trơn', material: 'Da', style: 'Office', season: 'Quanh năm', sizes: ['Freesize'] },
    { categoryId: accessory.id, name: 'Túi tote canvas', description: 'Túi tote canvas rộng rãi, phong cách tối giản.', price: 210000, color: 'Be', pattern: 'Trơn', material: 'Canvas', style: 'Casual', season: 'Quanh năm', sizes: ['Freesize'] },

    // ----- Bổ sung (đa dạng giới tính / loại trang phục, tham khảo DeepFashion2) -----
    { categoryId: top.id, name: 'Áo thun nam cổ tròn', description: 'Áo thun nam cotton cổ tròn basic, dễ phối.', price: 220000, color: 'Xám', pattern: 'Trơn', material: 'Cotton', fit: 'Regular', length: 'Vừa', neckline: 'Tròn', sleeve: 'Ngắn', style: 'Streetwear', season: 'Hè', targetGender: 'Nam', garmentType: 'Áo thun tay ngắn', sizes: ['M', 'L', 'XL'] },
    { categoryId: top.id, name: 'Áo khoác blazer nam', description: 'Blazer nam dáng slim lịch sự cho công sở.', price: 850000, color: 'Xanh than', pattern: 'Trơn', material: 'Tuytsi', fit: 'Slim', length: 'Vừa', neckline: 'Cổ vest', sleeve: 'Dài', style: 'Office', season: 'Thu Đông', targetGender: 'Nam', garmentType: 'Áo khoác tay dài', sizes: ['M', 'L', 'XL'] },
    { categoryId: bottom.id, name: 'Quần jeans nam slim', description: 'Quần jeans nam ống slim co giãn nhẹ.', price: 420000, color: 'Xanh denim', pattern: 'Trơn', material: 'Denim', fit: 'Slim', length: 'Dài', style: 'Streetwear', season: 'Quanh năm', targetGender: 'Nam', garmentType: 'Quần dài', sizes: ['29', '30', '32'] },
    { categoryId: bottom.id, name: 'Quần short kaki', description: 'Quần short kaki unisex năng động mùa hè.', price: 250000, color: 'Be', pattern: 'Trơn', material: 'Kaki', fit: 'Regular', length: 'Ngắn', style: 'Casual', season: 'Hè', targetGender: 'Unisex', garmentType: 'Quần short', sizes: ['S', 'M', 'L'] },
  ];

  // Tự suy các trường bổ sung (DeepFashion2-style) khi sản phẩm chưa khai báo
  const OCCASION_BY_STYLE: Record<string, string> = {
    Party: 'PARTY', Office: 'WORK', Casual: 'STREET', Streetwear: 'STREET',
  };
  const BRANDS = ['Elora', 'NorthLine', 'Mộc', 'Urban21', 'LaVie'];
  function deriveGarmentType(p: (typeof products)[number], slug: string): string {
    if (p.garmentType) return p.garmentType;
    if (slug === 'dress') return p.sleeve ? `Đầm ${String(p.sleeve).toLowerCase()}` : 'Đầm';
    if (slug === 'top') return p.sleeve ? `Áo ${String(p.sleeve).toLowerCase()}` : 'Áo';
    if (slug === 'bottom') return p.name.includes('váy') ? 'Chân váy' : 'Quần dài';
    if (slug === 'shoes') return 'Giày';
    return 'Phụ kiện';
  }
  const slugById: Record<number, string> = {
    [dress.id]: 'dress', [top.id]: 'top', [bottom.id]: 'bottom', [shoes.id]: 'shoes', [accessory.id]: 'accessory',
  };

  let bi = 0;
  for (const p of products) {
    const { sizes, tags, ...data } = p;
    const slug = slugById[p.categoryId];
    await prisma.product.create({
      data: {
        sellerId: seller.id,
        ...data,
        garmentType: deriveGarmentType(p, slug),
        targetGender: p.targetGender ?? 'Nữ',
        brand: p.brand ?? BRANDS[bi++ % BRANDS.length],
        occasion: p.occasion ?? (p.style ? OCCASION_BY_STYLE[p.style] ?? 'STREET' : undefined),
        tags: tags ?? [p.material, p.pattern, p.fit, p.style].filter(Boolean),
        images: { create: [{ url: IMG, isPrimary: true }] },
        variants: { create: std(sizes) },
      },
    });
  }

  // UC4 (GĐ4) - tính điểm tương thích dáng người cho từng sản phẩm từ Fashion KB
  const allProducts = await prisma.product.findMany();
  for (const pr of allProducts) {
    for (const f of scoreProductAllShapes(pr)) {
      await prisma.productBodyFit.upsert({
        where: { productId_bodyShape: { productId: pr.id, bodyShape: f.bodyShape } },
        update: { score: f.score, reasons: f.reasons },
        create: { productId: pr.id, bodyShape: f.bodyShape, score: f.score, reasons: f.reasons },
      });
    }
  }

  console.log(`✅ Seed dữ liệu mẫu thành công! (${products.length} sản phẩm, ${allProducts.length * 5} điểm tương thích)`);
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
