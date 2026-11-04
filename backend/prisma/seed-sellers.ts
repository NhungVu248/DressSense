// Seed ĐA DẠNG người bán + gian hàng (đủ trạng thái, ngành hàng, vùng miền) + sản phẩm + vài khách hàng.
// Idempotent: user upsert theo email, shop theo ownerId, sản phẩm bỏ qua nếu trùng tên. Mật khẩu: 123456.
// Chạy: npm run db:seed:sellers (nên chạy sau seed.ts & seed-setting.ts)
import { PrismaClient, ShopStatus, AccountStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

type P = { cat: string; name: string; price: number; color: string; style: string; gender?: string; material?: string; fit?: string; occasion?: string; sizes: string[]; stock?: number; status?: 'ACTIVE' | 'HIDDEN' | 'PENDING' | 'DRAFT'; featured?: boolean };
type S = {
  email: string; fullName: string; phone: string; shopName: string; desc: string; status: ShopStatus;
  province: string; district: string; ward: string; detail: string;
  selfDelivery?: boolean; selfFee?: number | null; bank: [string, string, string];
  rejectReason?: string; products: P[];
};

const std = ['S', 'M', 'L', 'XL'];
const SELLERS: S[] = [
  { email: 'seller.minimal@dresssense.vn', fullName: 'Trần Minh Anh', phone: '0901000001', shopName: 'Minimal Studio', status: 'ACTIVE',
    desc: 'Thời trang tối giản, tông trung tính, chất liệu linen & cotton cao cấp cho nàng công sở.',
    province: 'TP. Hồ Chí Minh', district: 'Quận 3', ward: 'Phường Võ Thị Sáu', detail: '45 Nguyễn Đình Chiểu', bank: ['Vietcombank', '0071001234567', 'TRAN MINH ANH'],
    products: [
      { cat: 'Áo', name: 'Áo sơ mi linen trắng (Minimal Studio)', price: 450000, color: 'Trắng', style: 'Minimalist', material: 'Linen', fit: 'Regular', occasion: 'WORK', sizes: std, featured: true },
      { cat: 'Quần', name: 'Quần ống suông be (Minimal Studio)', price: 520000, color: 'Be', style: 'Minimalist', material: 'Cotton', fit: 'Relaxed', occasion: 'WORK', sizes: std },
      { cat: 'Đầm / Váy', name: 'Đầm midi cổ vuông (Minimal Studio)', price: 690000, color: 'Đen', style: 'Minimalist', material: 'Cotton', fit: 'Regular', occasion: 'WORK', sizes: std, featured: true },
      { cat: 'Áo', name: 'Áo blazer oversize xám (Minimal Studio)', price: 890000, color: 'Xám', style: 'Minimalist', material: 'Tweed', fit: 'Oversized', occasion: 'WORK', sizes: std },
    ] },
  { email: 'seller.street@dresssense.vn', fullName: 'Lê Quốc Huy', phone: '0901000002', shopName: 'Urban Street Hà Nội', status: 'ACTIVE',
    desc: 'Streetwear local brand: hoodie, jogger, sneaker dành cho giới trẻ năng động.',
    province: 'Hà Nội', district: 'Quận Đống Đa', ward: 'Phường Láng Hạ', detail: '12 Thái Hà', selfDelivery: true, selfFee: 15000, bank: ['Techcombank', '19031234567890', 'LE QUOC HUY'],
    products: [
      { cat: 'Áo', name: 'Hoodie oversize in logo (Urban Street)', price: 480000, color: 'Đen', style: 'Streetwear', gender: 'Unisex', material: 'Nỉ', fit: 'Oversized', occasion: 'STREET', sizes: ['M', 'L', 'XL'], featured: true },
      { cat: 'Quần', name: 'Quần cargo túi hộp (Urban Street)', price: 420000, color: 'Xanh rêu', style: 'Streetwear', gender: 'Unisex', material: 'Kaki', fit: 'Loose', occasion: 'STREET', sizes: ['M', 'L', 'XL'] },
      { cat: 'Giày', name: 'Giày sneaker trắng đế dày (Urban Street)', price: 790000, color: 'Trắng', style: 'Streetwear', gender: 'Unisex', occasion: 'STREET', sizes: ['38', '39', '40', '41', '42'], stock: 20 },
      { cat: 'Áo', name: 'Áo thun graphic boxy (Urban Street)', price: 260000, color: 'Kem', style: 'Streetwear', gender: 'Nam', material: 'Cotton', fit: 'Boxy', occasion: 'STREET', sizes: std },
      { cat: 'Phụ kiện', name: 'Túi tote canvas (Urban Street)', price: 180000, color: 'Be', style: 'Streetwear', gender: 'Unisex', occasion: 'STREET', sizes: ['Freesize'] },
    ] },
  { email: 'seller.vintage@dresssense.vn', fullName: 'Phạm Thu Hà', phone: '0901000003', shopName: 'Hạ Vintage Đà Nẵng', status: 'ACTIVE',
    desc: 'Váy & đầm phong cách vintage – retro, họa tiết hoa nhí, thiết kế độc bản.',
    province: 'Đà Nẵng', district: 'Quận Hải Châu', ward: 'Phường Thạch Thang', detail: '88 Bạch Đằng', bank: ['BIDV', '31410001234567', 'PHAM THU HA'],
    products: [
      { cat: 'Đầm / Váy', name: 'Đầm hoa nhí cổ tròn (Hạ Vintage)', price: 560000, color: 'Hồng', style: 'Vintage', material: 'Voan', fit: 'A-line', occasion: 'PARTY', sizes: std, featured: true },
      { cat: 'Đầm / Váy', name: 'Chân váy xếp ly retro (Hạ Vintage)', price: 340000, color: 'Nâu', style: 'Vintage', material: 'Polyester', fit: 'A-line', occasion: 'STREET', sizes: std },
      { cat: 'Áo', name: 'Áo blouse cổ nơ (Hạ Vintage)', price: 380000, color: 'Kem', style: 'Vintage', material: 'Lụa', fit: 'Regular', occasion: 'WORK', sizes: std },
      { cat: 'Phụ kiện', name: 'Khăn lụa họa tiết (Hạ Vintage)', price: 150000, color: 'Đỏ', style: 'Vintage', sizes: ['Freesize'] },
    ] },
  { email: 'seller.sport@dresssense.vn', fullName: 'Nguyễn Đức Thắng', phone: '0901000004', shopName: 'ActiveFit Gear', status: 'ACTIVE',
    desc: 'Đồ thể thao, gym, yoga co giãn 4 chiều – thoáng khí, nhanh khô.',
    province: 'Cần Thơ', district: 'Quận Ninh Kiều', ward: 'Phường Xuân Khánh', detail: '25 Đường 3/2', selfDelivery: true, selfFee: null, bank: ['Agribank', '6300205123456', 'NGUYEN DUC THANG'],
    products: [
      { cat: 'Áo', name: 'Áo bra thể thao (ActiveFit)', price: 220000, color: 'Đen', style: 'Sporty', gender: 'Nữ', material: 'Spandex', fit: 'Ôm', occasion: 'SPORT', sizes: ['S', 'M', 'L'], featured: true },
      { cat: 'Quần', name: 'Quần legging cạp cao (ActiveFit)', price: 280000, color: 'Xanh navy', style: 'Sporty', gender: 'Nữ', material: 'Spandex', fit: 'Ôm', occasion: 'SPORT', sizes: ['S', 'M', 'L'] },
      { cat: 'Quần', name: 'Quần short chạy bộ (ActiveFit)', price: 190000, color: 'Xám', style: 'Sporty', gender: 'Nam', material: 'Polyester', fit: 'Regular', occasion: 'SPORT', sizes: std },
      { cat: 'Giày', name: 'Giày chạy bộ nhẹ (ActiveFit)', price: 950000, color: 'Cam', style: 'Sporty', gender: 'Unisex', occasion: 'SPORT', sizes: ['39', '40', '41', '42', '43'], stock: 15 },
    ] },
  { email: 'seller.luxe@dresssense.vn', fullName: 'Võ Ngọc Lan', phone: '0901000005', shopName: 'Lan Luxe Boutique', status: 'ACTIVE',
    desc: 'Đầm dạ hội, đầm phù dâu & phụ kiện cao cấp – may đo theo số đo.',
    province: 'TP. Hồ Chí Minh', district: 'Quận 1', ward: 'Phường Bến Nghé', detail: '102 Đồng Khởi', bank: ['ACB', '2012345678', 'VO NGOC LAN'],
    products: [
      { cat: 'Đầm / Váy', name: 'Đầm dạ hội đuôi cá đỏ (Lan Luxe)', price: 1890000, color: 'Đỏ', style: 'Elegant', material: 'Satin', fit: 'Ôm', occasion: 'PARTY', sizes: ['S', 'M', 'L'], stock: 6, featured: true },
      { cat: 'Đầm / Váy', name: 'Đầm phù dâu ren pastel (Lan Luxe)', price: 1250000, color: 'Hồng', style: 'Elegant', material: 'Ren', fit: 'A-line', occasion: 'PARTY', sizes: ['S', 'M', 'L'], stock: 8 },
      { cat: 'Giày', name: 'Giày cao gót quai mảnh (Lan Luxe)', price: 880000, color: 'Vàng đồng', style: 'Elegant', occasion: 'PARTY', sizes: ['35', '36', '37', '38', '39'], stock: 10 },
      { cat: 'Phụ kiện', name: 'Túi clutch đính đá (Lan Luxe)', price: 650000, color: 'Bạc', style: 'Elegant', occasion: 'PARTY', sizes: ['Freesize'], stock: 12 },
    ] },
  { email: 'seller.kids.pending@dresssense.vn', fullName: 'Đỗ Mai Phương', phone: '0901000006', shopName: 'Mây Teen Shop', status: 'PENDING',
    desc: 'Thời trang học sinh – sinh viên, đồng phục phối đồ trẻ trung.',
    province: 'Hải Phòng', district: 'Quận Ngô Quyền', ward: 'Phường Máy Chai', detail: '7 Lạch Tray', bank: ['MB Bank', '0123456789012', 'DO MAI PHUONG'],
    products: [{ cat: 'Áo', name: 'Áo polo học đường (Mây Teen)', price: 210000, color: 'Trắng', style: 'Casual', occasion: 'SCHOOL', sizes: std, status: 'PENDING' }] },
  { email: 'seller.needinfo@dresssense.vn', fullName: 'Hoàng Gia Bảo', phone: '0901000007', shopName: 'Bảo Menswear', status: 'NEEDS_INFO',
    desc: 'Sơ mi, quần tây và vest nam công sở.',
    province: 'Hà Nội', district: 'Quận Cầu Giấy', ward: 'Phường Dịch Vọng', detail: '19 Trần Thái Tông', bank: ['VPBank', '1234509876', 'HOANG GIA BAO'],
    rejectReason: 'Vui lòng bổ sung ảnh CCCD hai mặt và giấy phép kinh doanh (nếu có).', products: [] },
  { email: 'seller.rejected@dresssense.vn', fullName: 'Bùi Thanh Tùng', phone: '0901000008', shopName: 'Fake Brand Outlet', status: 'REJECTED',
    desc: 'Hàng hiệu giá rẻ.', province: 'Bình Dương', district: 'Thủ Dầu Một', ward: 'Phường Phú Cường', detail: '3 Yersin', bank: ['Sacombank', '060123456789', 'BUI THANH TUNG'],
    rejectReason: 'Gian hàng có dấu hiệu bán hàng nhái thương hiệu. Vui lòng cung cấp chứng từ nguồn gốc hàng hóa.', products: [] },
  { email: 'seller.suspended@dresssense.vn', fullName: 'Ngô Khánh Linh', phone: '0901000009', shopName: 'Linh Fashion Outlet', status: 'SUSPENDED',
    desc: 'Thời trang giá sốc mỗi ngày.', province: 'Đồng Nai', district: 'TP. Biên Hòa', ward: 'Phường Trảng Dài', detail: '56 Phạm Văn Thuận', bank: ['TPBank', '02012345678', 'NGO KHANH LINH'],
    rejectReason: 'Tạm ngưng do nhiều khiếu nại chưa xử lý về giao hàng chậm & sai mô tả.',
    products: [{ cat: 'Áo', name: 'Áo thun trơn đồng giá (Linh Outlet)', price: 99000, color: 'Trắng', style: 'Casual', sizes: std, status: 'HIDDEN' }] },
  { email: 'seller.draft@dresssense.vn', fullName: 'Lý Thảo Vy', phone: '0901000010', shopName: 'Vy Handmade', status: 'DRAFT',
    desc: '', province: 'Huế', district: 'TP. Huế', ward: 'Phường Vĩnh Ninh', detail: '', bank: ['', '', ''], products: [] },
];

const CUSTOMERS = [
  { email: 'khach.an@dresssense.vn', fullName: 'Nguyễn Hoài An', phone: '0912000001' },
  { email: 'khach.binh@dresssense.vn', fullName: 'Trần Quốc Bình', phone: '0912000002' },
  { email: 'khach.chi@dresssense.vn', fullName: 'Lê Diệu Chi', phone: '0912000003' },
  { email: 'khach.dung@dresssense.vn', fullName: 'Phạm Tiến Dũng', phone: '0912000004' },
  { email: 'khach.em@dresssense.vn', fullName: 'Vũ Thị Em', phone: '0912000005' },
];

async function main() {
  const pass = await bcrypt.hash('123456', 10);
  const cats = await prisma.category.findMany();
  const catId = (n: string) => cats.find((c) => c.name === n)?.id;
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
  let newProducts = 0;

  for (const s of SELLERS) {
    const acc: AccountStatus = s.status === 'PENDING' || s.status === 'NEEDS_INFO' ? 'PENDING_APPROVAL' : s.status === 'SUSPENDED' ? 'LOCKED' : 'ACTIVE';
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: {},
      create: { email: s.email, phone: s.phone, password: pass, fullName: s.fullName, role: 'SELLER', shopName: s.shopName, status: acc, firstLoginAt: new Date(), address: `${s.detail}, ${s.ward}, ${s.district}, ${s.province}` },
    });
    const done = s.status === 'ACTIVE' || s.status === 'SUSPENDED' || s.status === 'REJECTED';
    const data = {
      name: s.shopName, description: s.desc || null, contactEmail: s.email, contactPhone: s.phone,
      pickupName: s.fullName, pickupPhone: s.phone, pickupProvince: s.province, pickupDistrict: s.district, pickupWard: s.ward, pickupDetail: s.detail || null,
      selfDelivery: !!s.selfDelivery, selfDeliveryFee: s.selfDelivery ? s.selfFee ?? null : null,
      bankName: s.bank[0] || null, bankAccountNo: s.bank[1] || null, bankAccountName: s.bank[2] || null,
      status: s.status, rejectReason: s.rejectReason ?? null,
      submittedAt: s.status === 'DRAFT' ? null : new Date(), reviewedAt: done ? new Date() : null, reviewedById: done ? admin?.id ?? null : null,
    };
    await prisma.shop.upsert({ where: { ownerId: user.id }, update: {}, create: { ownerId: user.id, ...data } });

    for (const p of s.products) {
      const categoryId = catId(p.cat);
      if (!categoryId || (await prisma.product.findFirst({ where: { name: p.name } }))) continue;
      await prisma.product.create({
        data: {
          sellerId: user.id, categoryId, name: p.name, price: p.price, color: p.color, style: p.style, material: p.material, fit: p.fit,
          targetGender: p.gender ?? 'Nữ', occasion: p.occasion, status: p.status ?? 'ACTIVE', featured: !!p.featured, brand: s.shopName,
          description: `${p.name} – ${s.shopName}. Chất liệu ${p.material ?? 'cao cấp'}, phong cách ${p.style}.`,
          tags: [p.material, p.fit, p.style].filter(Boolean),
          variants: { create: p.sizes.map((size, i) => ({ size, stock: (p.stock ?? 40) + i * 2 })) },
        },
      });
      newProducts++;
    }
  }

  for (const c of CUSTOMERS) {
    await prisma.user.upsert({ where: { email: c.email }, update: {}, create: { ...c, password: pass, role: 'CUSTOMER', status: 'ACTIVE', firstLoginAt: new Date() } });
  }
  console.log(`[seed-sellers] ${SELLERS.length} người bán/gian hàng (ACTIVE, PENDING, NEEDS_INFO, REJECTED, SUSPENDED, DRAFT), ${newProducts} sản phẩm mới, ${CUSTOMERS.length} khách. Mật khẩu: 123456`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
