// ============================================================
//  UC3.2/UC3.3 - Phân tích tỷ lệ cơ thể & sinh khuyến nghị
//  Thuật toán phân loại dựa trên tỷ lệ nhân trắc (ngực/eo/hông) -
//  theo nguyên tắc chuẩn hóa dùng phổ biến trong các công cụ xác
//  định dáng người thời trang (rule-based, không phải mô hình học sâu).
// ============================================================

import type { BodyShape } from '@prisma/client';

// Miền hợp lệ số đo (đơn giản hóa cho phạm vi đồ án) - luồng ngoại lệ 5F
export const BODY_MEASUREMENT_RANGES = {
  height: { min: 100, max: 220 }, // cm
  weight: { min: 30, max: 150 }, // kg
  bust: { min: 50, max: 150 }, // cm
  waist: { min: 40, max: 150 }, // cm
  hip: { min: 50, max: 150 }, // cm
};

// Ngưỡng độ tin cậy: dưới ngưỡng này -> đánh dấu "ước lượng sơ bộ" (UC3.2 bước 6, UC3.3 4a)
export const CONFIDENCE_THRESHOLD = 0.6;

export interface CoreMeasurements {
  bust: number;
  waist: number;
  hip: number;
}

export interface ClassificationResult {
  bodyShape: BodyShape;
  confidence: number;
  note: string;
}

// Phân loại dáng người dựa trên tỷ lệ ngực/eo/hông (UC3.2 bước 3-6)
// Quy tắc chuẩn hóa (đơn vị cm):
//  - HOURGLASS: ngực và hông xấp xỉ nhau, eo thu nhỏ rõ rệt so với cả hai
//  - PEAR: hông lớn hơn ngực rõ rệt
//  - INVERTED_TRIANGLE: ngực lớn hơn hông rõ rệt, eo không thu nhỏ rõ
//  - APPLE: eo là điểm rộng nhất (gần hoặc vượt ngực/hông)
//  - RECTANGLE: ngực/eo/hông không chênh lệch nhiều (thân hình thẳng)
export function classifyBodyShape(m: CoreMeasurements): ClassificationResult {
  const { bust, waist, hip } = m;
  const bustHipDiff = bust - hip; // dương: ngực to hơn hông
  const waistBustGap = bust - waist; // dương: eo thu nhỏ so với ngực
  const waistHipGap = hip - waist; // dương: eo thu nhỏ so với hông

  const BALANCE_THRESHOLD = 5; // cm - coi là "xấp xỉ nhau"
  const DEFINED_WAIST_THRESHOLD = 9; // cm - eo được coi là "thu nhỏ rõ rệt"
  const DOMINANT_THRESHOLD = 9; // cm - ngực/hông "lớn hơn rõ rệt"

  function marginConfidence(value: number, threshold: number, base = 0.65): number {
    // Giá trị vượt xa ngưỡng -> tin cậy cao hơn; sát ngưỡng -> tin cậy thấp hơn (cận biên)
    const margin = Math.abs(value - threshold);
    return Math.min(0.95, base + margin / 40);
  }

  // Eo là điểm rộng nhất hoặc gần bằng ngực/hông -> APPLE
  if (waist >= bust - 2 || waist >= hip - 2) {
    return {
      bodyShape: 'APPLE',
      confidence: marginConfidence(waist, Math.min(bust, hip), 0.6),
      note: 'Vòng eo gần bằng hoặc lớn hơn vòng ngực/hông.',
    };
  }

  // Ngực và hông xấp xỉ nhau
  if (Math.abs(bustHipDiff) <= BALANCE_THRESHOLD) {
    if (waistBustGap >= DEFINED_WAIST_THRESHOLD && waistHipGap >= DEFINED_WAIST_THRESHOLD) {
      return {
        bodyShape: 'HOURGLASS',
        confidence: marginConfidence(Math.min(waistBustGap, waistHipGap), DEFINED_WAIST_THRESHOLD),
        note: 'Ngực và hông cân đối, vòng eo thu nhỏ rõ rệt.',
      };
    }
    return {
      bodyShape: 'RECTANGLE',
      confidence: marginConfidence(BALANCE_THRESHOLD, Math.abs(bustHipDiff), 0.6),
      note: 'Ngực, eo và hông không chênh lệch nhiều.',
    };
  }

  // Hông lớn hơn ngực rõ rệt
  if (bustHipDiff <= -DOMINANT_THRESHOLD) {
    return {
      bodyShape: 'PEAR',
      confidence: marginConfidence(-bustHipDiff, DOMINANT_THRESHOLD),
      note: 'Vòng hông lớn hơn vòng ngực rõ rệt.',
    };
  }

  // Ngực lớn hơn hông rõ rệt
  if (bustHipDiff >= DOMINANT_THRESHOLD) {
    return {
      bodyShape: 'INVERTED_TRIANGLE',
      confidence: marginConfidence(bustHipDiff, DOMINANT_THRESHOLD),
      note: 'Vòng ngực/vai lớn hơn vòng hông rõ rệt.',
    };
  }

  // Chênh lệch không đủ rõ để phân loại chắc chắn -> mặc định Rectangle, tin cậy thấp
  return { bodyShape: 'RECTANGLE', confidence: 0.5, note: 'Tỷ lệ cơ thể không rõ rệt, kết quả mang tính tham khảo.' };
}

// UC3.3 bước 3 - Khuyến nghị trang phục theo dáng người (tập luật tạm thời, sẽ được
// thay bằng tri thức thời trang đầy đủ khi UC4 được xây dựng)
export const STYLE_RECOMMENDATIONS: Record<BodyShape, { should: string[]; avoid: string[]; description: string }> = {
  HOURGLASS: {
    description: 'Vai và hông cân đối, vòng eo thu nhỏ rõ rệt.',
    should: ['Đầm/áo ôm dáng tôn eo', 'Chân váy/quần cạp cao', 'Belt tạo điểm nhấn eo'],
    avoid: ['Trang phục quá rộng, thùng thình che mất đường eo'],
  },
  RECTANGLE: {
    description: 'Vai, eo và hông không chênh lệch nhiều, thân hình thẳng.',
    should: ['Đầm peplum hoặc áo có belt tạo hiệu ứng eo', 'Chân váy xòe, quần ống loe'],
    avoid: ['Trang phục quá thẳng, không có điểm nhấn tạo đường cong'],
  },
  PEAR: {
    description: 'Vòng hông lớn hơn vòng ngực/vai.',
    should: ['Áo vai bồng, cổ thuyền hoặc có chi tiết ở phần trên để cân đối', 'Quần/chân váy tối màu, ống suông'],
    avoid: ['Quần bó sát hoặc chân váy có chi tiết cầu kỳ ở vùng hông'],
  },
  APPLE: {
    description: 'Vòng eo là điểm rộng nhất.',
    should: ['Đầm suông chữ A', 'Áo cổ V kéo dài thân trên', 'Quần cạp cao vừa vặn'],
    avoid: ['Áo bó sát vùng eo/bụng', 'Quần cạp trễ, chi tiết bèo nhún ở eo'],
  },
  INVERTED_TRIANGLE: {
    description: 'Vòng ngực/vai lớn hơn vòng hông rõ rệt.',
    should: ['Chân váy xòe, quần ống rộng để cân bằng phần dưới', 'Áo cổ tròn hoặc chữ V nhẹ'],
    avoid: ['Áo độn vai, cổ thuyền rộng làm vai thêm nổi bật'],
  },
};

// UC3.3 bước 3 - Gợi ý size sơ bộ theo nhóm sản phẩm, dựa trên số đo và bảng quy đổi
// chuẩn (đồng bộ với UC2.2). categorySlug -> số đo chính dùng để quy đổi.
const CATEGORY_PRIMARY_MEASUREMENT: Record<string, keyof CoreMeasurements> = {
  top: 'bust',
  dress: 'bust',
  bottom: 'waist',
};

export function suggestSizesByCategory(
  m: CoreMeasurements,
  categories: Array<{ id: number; slug: string }>,
  deriveSize: (measurements: { chest?: number; waist?: number; hip?: number }) => string | null
): Array<{ categoryId: number; sizeValue: string }> {
  const results: Array<{ categoryId: number; sizeValue: string }> = [];
  for (const c of categories) {
    const key = CATEGORY_PRIMARY_MEASUREMENT[c.slug];
    if (!key) continue; // danh mục không có phép quy đổi rõ ràng (giày, phụ kiện...) -> bỏ qua
    const value = m[key];
    const derived = deriveSize(key === 'bust' ? { chest: value } : { waist: value });
    if (derived) results.push({ categoryId: c.id, sizeValue: derived });
  }
  return results;
}
