import type { BodyShape, BodyProfileSource } from '@prisma/client';
import { classifyBodyShape, CONFIDENCE_THRESHOLD } from '../constants/body-analysis';

// ============================================================
//  UC3.2 - XỬ LÝ PHÂN TÍCH CƠ THỂ (module nội bộ do "AI" đảm nhiệm)
//  Được UC3.1 gọi qua quan hệ «include»; KHÔNG phải điểm vào trực tiếp
//  của người dùng. Nhận đầu vào (ảnh toàn thân hoặc số đo), xử lý và
//  trả kết quả (số đo, tỷ lệ vai–eo–hông, phân loại dáng người, độ tin
//  cậy) cho bước sinh Body Profile (UC3.3).
//
//  Ghi chú kiến trúc: bước thị giác máy tính (phát hiện người, ước lượng
//  tư thế, trích xuất điểm mốc) sẽ do microservice Python (MediaPipe/
//  OpenCV) đảm nhiệm ở giai đoạn sau. Ở đây `runVisionModule` là điểm nối
//  (adapter) mô phỏng ranh giới đó: hiện dùng số đo khách hàng cung cấp
//  kèm ảnh; khi module thị giác sẵn sàng chỉ cần thay phần thân hàm này.
// ============================================================

// Trạng thái kết quả xử lý (ánh xạ tới các luồng trong đặc tả UC3.2)
export type ProcessingStatus =
  | 'OK' //                    thành công, độ tin cậy đạt ngưỡng
  | 'LOW_CONFIDENCE' //        6a - có kết quả nhưng độ tin cậy dưới ngưỡng -> ước lượng sơ bộ
  | 'NO_PERSON' //             2E - không phát hiện được người/đối tượng chính trong ảnh
  | 'INSUFFICIENT_KEYPOINTS' //3E - không đủ điểm mốc để ước lượng số đo
  | 'UNCLASSIFIED' //          5E - thiếu dữ liệu, không phân loại được dáng người
  | 'MODULE_ERROR'; //         7E - lỗi trong quá trình xử lý của module

export interface ProcessingInput {
  source: BodyProfileSource;
  height?: number | null;
  weight?: number | null;
  bust?: number | null;
  waist?: number | null;
  hip?: number | null;
  shoulder?: number | null; // rộng vai (cm) nếu ước lượng được từ ảnh
  shoulderHipRatio?: number | null; // tỷ lệ vai/hông ước lượng từ ảnh (tham khảo)
  hasPhoto?: boolean; // có ảnh toàn thân kèm theo hay không
}

export interface Measurements {
  height: number | null;
  weight: number | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
  shoulder: number | null;
}

// Tỷ lệ tương quan giữa các vòng (bước 4).
// Index signature để tương thích kiểu JSON đầu vào của Prisma khi lưu vào analysisResult.
export interface BodyRatios {
  waistToHip: number; // WHR - eo/hông
  waistToBust: number; // eo/ngực
  bustToHip: number; // ngực/hông
  shoulderToHip: number | null; // vai/hông (nếu có dữ liệu vai)
  [key: string]: number | null;
}

export interface ProcessingResult {
  status: ProcessingStatus;
  ok: boolean; // true nếu đủ điều kiện để UC3.3 sinh Body Profile (OK hoặc LOW_CONFIDENCE)
  bodyShape: BodyShape | null;
  measurements: Measurements;
  ratios: BodyRatios | null;
  confidence: number; // 0-1
  isPreliminary: boolean; // đánh dấu ước lượng sơ bộ (6a)
  note: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function hasCore(m: Pick<Measurements, 'bust' | 'waist' | 'hip'>): m is { bust: number; waist: number; hip: number } {
  return m.bust != null && m.waist != null && m.hip != null && m.bust > 0 && m.waist > 0 && m.hip > 0;
}

// Bước 4 - Phân tích tỷ lệ và tương quan vai–eo–hông
function computeRatios(m: Measurements): BodyRatios | null {
  if (!hasCore(m)) return null;
  return {
    waistToHip: round2(m.waist / m.hip),
    waistToBust: round2(m.waist / m.bust),
    bustToHip: round2(m.bust / m.hip),
    shoulderToHip: m.shoulder != null && m.shoulder > 0 ? round2(m.shoulder / m.hip) : null,
  };
}

// Bước 2-3 (luồng chính, đầu vào ảnh) - Điểm nối tới module thị giác máy tính.
// TODO(UC3.2): thay bằng lời gọi microservice Python (MediaPipe/OpenCV) để phát
// hiện người, ước lượng tư thế và trích xuất số đo từ điểm mốc. Hiện tại chưa có
// module thị giác nên dùng số đo khách hàng cung cấp kèm ảnh; nếu không có số đo
// nào thì coi như không trích xuất được -> trả lỗi để UC3.1 chuyển sang nhập thủ công.
function runVisionModule(input: ProcessingInput): { status: ProcessingStatus; measurements?: Measurements } {
  const core = { bust: input.bust ?? null, waist: input.waist ?? null, hip: input.hip ?? null };
  if (!hasCore(core)) {
    // 2E/3E: không có dữ liệu để trích xuất từ ảnh (module thị giác chưa sẵn sàng)
    return { status: 'NO_PERSON' };
  }
  // Suy ra rộng vai từ tỷ lệ vai/hông nếu module cung cấp (tham khảo)
  const shoulder =
    input.shoulder ??
    (input.shoulderHipRatio != null && core.hip != null ? round2(input.shoulderHipRatio * core.hip) : null);
  return {
    status: 'OK',
    measurements: {
      height: input.height ?? null,
      weight: input.weight ?? null,
      bust: core.bust,
      waist: core.waist,
      hip: core.hip,
      shoulder,
    },
  };
}

function fail(status: ProcessingStatus, note: string): ProcessingResult {
  return {
    status,
    ok: false,
    bodyShape: null,
    measurements: { height: null, weight: null, bust: null, waist: null, hip: null, shoulder: null },
    ratios: null,
    confidence: 0,
    isPreliminary: false,
    note,
  };
}

// Điểm vào của UC3.2 - được UC3.1 include sau khi dữ liệu đầu vào đã hợp lệ.
export function processBodyAnalysis(input: ProcessingInput): ProcessingResult {
  try {
    let measurements: Measurements;

    if (input.source === 'PHOTO' && input.hasPhoto) {
      // Bước 2-3: xử lý ảnh qua module thị giác
      const vision = runVisionModule(input);
      if (vision.status !== 'OK' || !vision.measurements) {
        // 2E - trả trạng thái lỗi về UC3.1 (tương ứng ngoại lệ 6E của UC3.1)
        return fail(vision.status, 'Không phát hiện được cơ thể trong ảnh hoặc ảnh không đủ điều kiện phân tích.');
      }
      measurements = vision.measurements;
    } else {
      // 1a - đầu vào là số đo thủ công: bỏ qua nhận diện ảnh, chuẩn hóa và dùng trực tiếp
      const shoulder =
        input.shoulder ??
        (input.shoulderHipRatio != null && input.hip != null ? round2(input.shoulderHipRatio * input.hip) : null);
      measurements = {
        height: input.height ?? null,
        weight: input.weight ?? null,
        bust: input.bust ?? null,
        waist: input.waist ?? null,
        hip: input.hip ?? null,
        shoulder,
      };
    }

    // 5E - thiếu số đo cốt lõi, không thể phân tích tỷ lệ / phân loại
    if (!hasCore(measurements)) {
      return fail('UNCLASSIFIED', 'Thiếu số đo cốt lõi (ngực, eo, hông) để phân loại dáng người.');
    }

    // Bước 4 - phân tích tỷ lệ vai–eo–hông
    const ratios = computeRatios(measurements);

    // Bước 5 - phân loại dáng người theo tỷ lệ nhân trắc
    const classification = classifyBodyShape({
      bust: measurements.bust!,
      waist: measurements.waist!,
      hip: measurements.hip!,
    });

    // Bước 6 - đánh giá độ tin cậy (6a: dưới ngưỡng -> đánh dấu ước lượng sơ bộ)
    const isPreliminary = classification.confidence < CONFIDENCE_THRESHOLD;
    const note = isPreliminary
      ? `${classification.note} Độ tin cậy thấp — nên hiệu chỉnh hoặc bổ sung số đo thủ công.`
      : classification.note;

    return {
      status: isPreliminary ? 'LOW_CONFIDENCE' : 'OK',
      ok: true,
      bodyShape: classification.bodyShape,
      measurements,
      ratios,
      confidence: classification.confidence,
      isPreliminary,
      note,
    };
  } catch {
    // 7E - lỗi module trong quá trình xử lý
    return fail('MODULE_ERROR', 'Lỗi trong quá trình xử lý phân tích cơ thể.');
  }
}
