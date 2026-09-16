// ============================================================
//  UC2 - Danh mục chuẩn hóa cho hồ sơ cá nhân hóa & thông tin size
//  Do hệ thống cung cấp sẵn, bảo đảm dữ liệu đồng nhất phục vụ
//  thuật toán gợi ý (UC5) - theo quy tắc nghiệp vụ UC2.1/UC2.2
// ============================================================

// (a) Phong cách thời trang chuẩn
export const STYLE_OPTIONS = [
  { value: 'minimalist', label: 'Tối giản' },
  { value: 'elegant', label: 'Thanh lịch' },
  { value: 'sporty', label: 'Năng động' },
  { value: 'street', label: 'Đường phố' },
  { value: 'vintage', label: 'Cổ điển' },
  { value: 'romantic', label: 'Nữ tính' },
  { value: 'classic', label: 'Công sở' },
  { value: 'bohemian', label: 'Phóng khoáng' },
] as const;

// Bảng màu chuẩn (dùng chung cho "ưa thích" và "muốn tránh")
export const COLOR_OPTIONS = [
  { value: 'black', label: 'Đen' },
  { value: 'white', label: 'Trắng' },
  { value: 'beige', label: 'Be' },
  { value: 'gray', label: 'Xám' },
  { value: 'navy', label: 'Xanh navy' },
  { value: 'blue', label: 'Xanh dương' },
  { value: 'green', label: 'Xanh lá' },
  { value: 'brown', label: 'Nâu' },
  { value: 'red', label: 'Đỏ' },
  { value: 'pink', label: 'Hồng' },
  { value: 'yellow', label: 'Vàng' },
  { value: 'purple', label: 'Tím' },
  { value: 'orange', label: 'Cam' },
  { value: 'multicolor', label: 'Họa tiết nhiều màu' },
] as const;

// Kiểu trang phục chuẩn (dùng chung cho "thường mặc" và "không mặc")
export const GARMENT_OPTIONS = [
  { value: 'shirt', label: 'Áo sơ mi' },
  { value: 'tshirt', label: 'Áo thun' },
  { value: 'blouse', label: 'Áo kiểu' },
  { value: 'sweater', label: 'Áo len' },
  { value: 'jacket', label: 'Áo khoác' },
  { value: 'jeans', label: 'Quần jean' },
  { value: 'trousers', label: 'Quần âu' },
  { value: 'shorts', label: 'Quần short' },
  { value: 'skirt', label: 'Chân váy' },
  { value: 'dress', label: 'Đầm/Váy liền' },
  { value: 'suit', label: 'Vest/Bộ vest' },
  { value: 'activewear', label: 'Đồ thể thao' },
] as const;

// Chất liệu ưu tiên
export const MATERIAL_OPTIONS = [
  { value: 'cotton', label: 'Cotton' },
  { value: 'linen', label: 'Linen' },
  { value: 'denim', label: 'Denim' },
  { value: 'silk', label: 'Lụa' },
  { value: 'wool', label: 'Len' },
  { value: 'polyester', label: 'Polyester' },
  { value: 'leather', label: 'Da' },
  { value: 'knit', label: 'Dệt kim' },
] as const;

// (c) Dịp sử dụng chuẩn - khớp enum OccasionType trong schema
export const OCCASION_OPTIONS = [
  { value: 'WORK', label: 'Đi làm' },
  { value: 'SCHOOL', label: 'Đi học' },
  { value: 'STREET', label: 'Dạo phố' },
  { value: 'PARTY', label: 'Tiệc & sự kiện' },
  { value: 'SPORT', label: 'Thể thao' },
  { value: 'TRAVEL', label: 'Du lịch' },
] as const;

export const FREQUENCY_OPTIONS = [
  { value: 'RARELY', label: 'Hiếm khi' },
  { value: 'SOMETIMES', label: 'Thỉnh thoảng' },
  { value: 'OFTEN', label: 'Thường xuyên' },
] as const;

// UC2.2 - Hệ size chuẩn
export const STANDARD_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;

// Miền hợp lệ chung cho size theo số (quần, giày...) - đơn giản hóa cho phạm vi đồ án
export const NUMERIC_SIZE_RANGE = { min: 20, max: 50 };

// Miền hợp lệ số đo cơ thể (cm) - đơn giản hóa cho phạm vi đồ án
export const MEASUREMENT_RANGE = { min: 20, max: 200 };

// Bảng quy đổi số đo -> size chuẩn (đơn giản hóa, ưu tiên vòng ngực > eo > hông)
// Mốc trên tính theo cm, dùng để minh họa quy đổi cho mục đích đồ án.
const CONVERSION_BRACKETS: Array<{ max: number; size: (typeof STANDARD_SIZES)[number] }> = [
  { max: 82, size: 'XS' },
  { max: 88, size: 'S' },
  { max: 94, size: 'M' },
  { max: 102, size: 'L' },
  { max: 110, size: 'XL' },
  { max: Infinity, size: 'XXL' },
];

export interface BodyMeasurements {
  chest?: number;
  waist?: number;
  hip?: number;
  length?: number;
}

// Quy đổi số đo cơ thể -> size chuẩn (luồng thay thế 4c của UC2.2)
export function deriveSizeFromMeasurements(m: BodyMeasurements): (typeof STANDARD_SIZES)[number] | null {
  const primary = m.chest ?? m.waist ?? m.hip;
  if (primary == null || Number.isNaN(primary)) return null;
  const bracket = CONVERSION_BRACKETS.find((b) => primary <= b.max);
  return bracket ? bracket.size : null;
}

export function isValidOption(value: string, options: ReadonlyArray<{ value: string }>) {
  return options.some((o) => o.value === value);
}
