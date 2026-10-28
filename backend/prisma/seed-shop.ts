import { PrismaClient } from '@prisma/client';

// UC14.1 - Tạo hồ sơ gian hàng ACTIVE cho các Người bán hiện có (để không gián đoạn
// việc bán hàng đang diễn ra). Chỉ tạo khi Người bán chưa có gian hàng.
const prisma = new PrismaClient();

async function main() {
  const sellers = await prisma.user.findMany({
    where: { role: 'SELLER', shop: { is: null } },
    select: { id: true, fullName: true, shopName: true, email: true, phone: true },
  });

  let created = 0;
  for (const s of sellers) {
    await prisma.shop.create({
      data: {
        ownerId: s.id,
        name: s.shopName || s.fullName || `Gian hàng #${s.id}`,
        description: 'Gian hàng trên DressSense.',
        contactEmail: s.email,
        contactPhone: s.phone,
        status: 'ACTIVE', // Người bán hiện có -> đang hoạt động, không gián đoạn bán hàng
        submittedAt: new Date(),
        reviewedAt: new Date(),
      },
    });
    created++;
  }

  console.log(`[seed-shop] Đã tạo ${created} gian hàng ACTIVE cho Người bán hiện có.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
