import type { BodyProfileSource } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { STYLE_RECOMMENDATIONS, suggestSizesByCategory } from '../constants/body-analysis';
import { deriveSizeFromMeasurements } from '../constants/personalization';
import type { ProcessingResult } from './body-analysis.service';

// ============================================================
//  UC3.3 - SINH BODY PROFILE (module nội bộ do "AI" đảm nhiệm)
//  Được UC3.1 gọi sau khi UC3.2 hoàn tất; KHÔNG phải điểm vào trực tiếp
//  của người dùng. Tổng hợp kết quả xử lý (UC3.2) thành Body Profile:
//  số đo, phân loại dáng người, khuyến nghị trang phục (tri thức thời
//  trang - UC4), gợi ý size sơ bộ theo danh mục (bảng quy đổi - UC2.2),
//  độ tin cậy; lưu bản mới kèm phiên bản để truy vết (5a).
// ============================================================

export interface GenerateProfileInput {
  userId: number;
  source: BodyProfileSource;
  height: number | null;
  weight: number | null;
  bust: number;
  waist: number;
  hip: number;
  shoulderHipRatio: number | null;
  photoUrl: string | null;
  processing: ProcessingResult; // kết quả UC3.2 (ok = true, có bodyShape)
}

// Điểm vào của UC3.3 - trả về Body Profile vừa sinh cho UC3.1 hiển thị (bước 6).
export async function generateBodyProfile(input: GenerateProfileInput) {
  const { processing } = input;
  const bodyShape = processing.bodyShape;
  // 1E - kết quả từ UC3.2 không đủ để sinh hồ sơ (không có phân loại dáng người)
  if (!bodyShape) {
    throw new Error('UC3.3: thiếu kết quả phân loại dáng người từ UC3.2');
  }

  // Bước 3 - khuyến nghị trang phục theo dáng người (tập luật/tri thức thời trang - UC4)
  const recommendations = STYLE_RECOMMENDATIONS[bodyShape];

  // Bước 5 - lưu Body Profile trong transaction (5E: nguyên tử, không lưu bản lỗi/dở dang)
  return prisma.$transaction(async (tx) => {
    // 5a - mỗi lần sinh tạo bản mới; bản hiện hành = version lớn nhất của user
    const last = await tx.bodyProfile.findFirst({
      where: { userId: input.userId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;

    // Bước 3 - gợi ý size sơ bộ theo danh mục dựa trên số đo + bảng quy đổi chuẩn (UC2.2)
    const categories = await tx.category.findMany();
    const suggestedSizes = suggestSizesByCategory(
      { bust: input.bust, waist: input.waist, hip: input.hip },
      categories,
      deriveSizeFromMeasurements
    );

    return tx.bodyProfile.create({
      data: {
        userId: input.userId,
        bodyShape,
        source: input.source,
        version,
        height: input.height,
        weight: input.weight,
        bust: input.bust,
        waist: input.waist,
        hip: input.hip,
        shoulder: processing.measurements.shoulder,
        confidence: processing.confidence,
        isPreliminary: processing.isPreliminary, // 4a - đánh dấu sơ bộ nếu độ tin cậy thấp
        photoUrl: input.photoUrl,
        recommendations,
        suggestedSizes,
        analysisResult: {
          status: processing.status,
          note: processing.note,
          ratios: processing.ratios,
          shoulderHipRatio: input.shoulderHipRatio,
        },
      },
    });
  });
}
