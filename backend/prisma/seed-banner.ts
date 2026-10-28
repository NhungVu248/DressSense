import { PrismaClient } from '@prisma/client';

// UC13.2 - seed banner HOME_HERO mẫu đang hiển thị, trỏ tới trang chương trình khuyến mãi.
const prisma = new PrismaClient();

async function main() {
  const name = 'Flash Sale mùa mới';
  const existing = await prisma.banner.findFirst({ where: { name } });
  const data = {
    name,
    imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1600&q=70',
    title: 'Ưu đãi cuối tuần',
    subtitle: 'Flash Sale & voucher chọn lọc - số lượng có hạn',
    position: 'HOME_HERO' as const,
    linkType: 'PROMO' as const,
    linkValue: '/?promo=flash',
    priority: 10,
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 14 * 86400_000),
    status: 'RUNNING' as const,
  };
  if (existing) await prisma.banner.update({ where: { id: existing.id }, data });
  else await prisma.banner.create({ data });

  console.log(`Seeded banner HOME_HERO: "${name}".`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
