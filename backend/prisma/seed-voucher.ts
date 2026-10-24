import { PrismaClient } from '@prisma/client';

// UC8.3 - seed vài mã giảm giá mẫu (bản gọn; UC13 sẽ quản lý đầy đủ)
const prisma = new PrismaClient();

const VOUCHERS = [
  { code: 'WELCOME50', description: 'Giảm 50.000₫ cho đơn từ 300.000₫', type: 'FIXED' as const, value: 50000, minOrder: 300000, maxDiscount: null },
  { code: 'SALE10', description: 'Giảm 10%, tối đa 100.000₫', type: 'PERCENT' as const, value: 10, minOrder: 0, maxDiscount: 100000 },
  { code: 'VIP20', description: 'Giảm 20% cho đơn từ 500.000₫, tối đa 200.000₫', type: 'PERCENT' as const, value: 20, minOrder: 500000, maxDiscount: 200000 },
  { code: 'FLASH100', description: 'Giảm 100.000₫ cho đơn từ 800.000₫', type: 'FIXED' as const, value: 100000, minOrder: 800000, maxDiscount: null },
];

async function main() {
  for (const v of VOUCHERS) {
    await prisma.voucher.upsert({
      where: { code: v.code },
      update: { description: v.description, type: v.type, value: v.value, minOrder: v.minOrder, maxDiscount: v.maxDiscount, active: true },
      create: { ...v, active: true },
    });
  }
  const count = await prisma.voucher.count();
  console.log(`Seeded vouchers. Tổng số voucher: ${count}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
