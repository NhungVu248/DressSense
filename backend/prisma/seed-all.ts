// Seed TOÀN HỆ THỐNG theo đúng thứ tự phụ thuộc. Chạy: npm run db:seed:all
// Lưu ý: seed.ts reset kho sản phẩm (deleteMany) rồi tạo lại - chỉ dùng cho môi trường dev/demo.
import { spawnSync } from 'node:child_process';

const STEPS: [string, string][] = [
  ['prisma/seed.ts', 'Danh mục, tài khoản (admin/seller/customer), sản phẩm, tri thức & phân tích'],
  ['prisma/seed-setting.ts', 'Cấu hình hệ thống (VAT, ship, đổi trả, thanh toán...)'],
  ['prisma/seed-shop.ts', 'Hồ sơ gian hàng cho người bán'],
  ['prisma/seed-seller2.ts', 'Người bán thứ 2 + sản phẩm (đa gian hàng)'],
  ['prisma/seed-shop.ts', 'Hồ sơ gian hàng cho người bán 2'],
  ['prisma/seed-sellers.ts', 'Đa dạng người bán/gian hàng (đủ trạng thái) + sản phẩm + khách'],
  ['prisma/seed-voucher.ts', 'Voucher mẫu'],
  ['prisma/seed-promotion.ts', 'Khuyến mãi: voucher danh mục + Flash Sale'],
  ['prisma/seed-banner.ts', 'Banner trang chủ'],
  ['prisma/seed-commission.ts', 'Chính sách hoa hồng + backfill'],
  ['prisma/seed-demo-media.ts', 'Ảnh demo thật + Flash Sale đang chạy'],
  ['prisma/seed-activity.ts', 'Phân tích nhãn dáng + đơn hàng, đánh giá, hỏi đáp, chat, thông báo mẫu'],
];

let failed = 0;
for (const [file, desc] of STEPS) {
  console.log(`\n▶ ${file} — ${desc}`);
  const r = spawnSync('npx', ['tsx', file], { stdio: 'inherit', shell: true });
  if (r.status !== 0) { failed++; console.error(`✖ ${file} lỗi (exit ${r.status}) - dừng.`); break; }
}
console.log(failed ? '\nSeed THẤT BẠI.' : '\n✔ Seed toàn hệ thống hoàn tất.');
process.exit(failed ? 1 : 0);
