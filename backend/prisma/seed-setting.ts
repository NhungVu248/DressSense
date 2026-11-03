import { PrismaClient } from '@prisma/client';

// UC16.5 - Giá trị cấu hình hệ thống mặc định.
const prisma = new PrismaClient();

const DEFAULTS = [
  { key: 'returnWindowDays', value: '7', type: 'number', label: 'Thời hạn đổi/trả (ngày)', group: 'Chính sách', description: 'Số ngày Khách hàng được yêu cầu đổi/trả sau khi nhận hàng.' },
  { key: 'complaintGraceDays', value: '3', type: 'number', label: 'Thời gian kích hoạt khiếu nại (ngày)', group: 'Chính sách', description: 'Quá thời gian giao dự kiến + N ngày mới cho phép khiếu nại.' },
  { key: 'lowStockThreshold', value: '5', type: 'number', label: 'Ngưỡng cảnh báo tồn kho thấp (mặc định)', group: 'Kho vận', description: 'Dùng khi biến thể chưa đặt ngưỡng riêng.' },
  { key: 'freeShipThreshold', value: '500000', type: 'number', label: 'Ngưỡng miễn phí vận chuyển (đ)', group: 'Kho vận', description: 'Đơn đạt ngưỡng này được xét miễn phí vận chuyển.' },
  { key: 'siteName', value: 'DressSense', type: 'string', label: 'Tên hệ thống', group: 'Chung', description: 'Tên hiển thị của nền tảng.' },
  { key: 'supportEmail', value: 'support@dresssense.vn', type: 'string', label: 'Email hỗ trợ', group: 'Chung', description: 'Email CSKH hiển thị cho người dùng.' },
  { key: 'maintenanceMode', value: 'false', type: 'boolean', label: 'Chế độ bảo trì', group: 'Chung', description: 'Bật để tạm dừng một số chức năng khi bảo trì.' },
  // Backlog - Thuế & Hóa đơn VAT
  { key: 'vatEnabled', value: 'true', type: 'boolean', label: 'Áp dụng thuế VAT', group: 'Thuế & Hóa đơn', description: 'Bật để tính thuế VAT vào giá cuối. Người bán nhập giá chưa thuế, hệ thống cộng thuế.' },
  { key: 'vatRate', value: '8', type: 'number', label: 'Thuế suất VAT (%)', group: 'Thuế & Hóa đơn', description: 'Thuế suất áp dụng khi tính giá cuối và xuất hóa đơn (vd 8 hoặc 10).' },
  { key: 'invoiceCompanyName', value: 'Công ty TNHH DressSense', type: 'string', label: 'Tên đơn vị xuất hóa đơn', group: 'Thuế & Hóa đơn', description: 'Hiển thị trên đầu hóa đơn VAT.' },
  { key: 'invoiceTaxCode', value: '0312345678', type: 'string', label: 'Mã số thuế đơn vị', group: 'Thuế & Hóa đơn', description: 'Mã số thuế của sàn/đơn vị phát hành hóa đơn.' },
  { key: 'invoiceAddress', value: '123 Nguyễn Huệ, Quận 1, TP.HCM', type: 'string', label: 'Địa chỉ xuất hóa đơn', group: 'Thuế & Hóa đơn', description: 'Địa chỉ đơn vị phát hành hóa đơn.' },
  // Backlog (C.46) - Cấu hình phí vận chuyển
  { key: 'shipStandardFee', value: '30000', type: 'number', label: 'Phí giao tiêu chuẩn (đ)', group: 'Vận chuyển', description: 'Phí giao hàng tiêu chuẩn trong nước (mỗi gian hàng).' },
  { key: 'shipExpressFee', value: '50000', type: 'number', label: 'Phí giao nhanh (đ)', group: 'Vận chuyển', description: 'Phí giao nhanh 1–2 ngày.' },
  { key: 'shipSameCityFee', value: '20000', type: 'number', label: 'Phí hỏa tốc nội thành (đ)', group: 'Vận chuyển', description: 'Giao hỏa tốc trong ngày (nội thành).' },
  { key: 'shipIntlFee', value: '200000', type: 'number', label: 'Phí giao quốc tế (đ)', group: 'Vận chuyển', description: 'Phí cố định cho đơn giao quốc tế (không áp dụng miễn phí/phụ phí nội địa).' },
  { key: 'shipRemoteSurcharge', value: '20000', type: 'number', label: 'Phụ phí khu vực xa (đ)', group: 'Vận chuyển', description: 'Cộng thêm khi giao tới tỉnh/khu vực xa (vùng sâu, hải đảo).' },
  { key: 'shipRemoteProvinces', value: 'Hà Giang,Cao Bằng,Lai Châu,Điện Biên,Sơn La,Kon Tum,Lào Cai,Bắc Kạn', type: 'string', label: 'Tỉnh/khu vực xa', group: 'Vận chuyển', description: 'Danh sách tỉnh áp phụ phí khu vực xa, phân tách bằng dấu phẩy.' },
];

async function main() {
  let n = 0;
  for (const s of DEFAULTS) {
    await prisma.systemSetting.upsert({ where: { key: s.key }, update: {}, create: s });
    n++;
  }
  console.log(`[seed-setting] Đã đảm bảo ${n} tham số cấu hình hệ thống.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
