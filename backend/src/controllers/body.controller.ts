import type { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { BODY_MEASUREMENT_RANGES } from '../constants/body-analysis';
import { processBodyAnalysis } from '../services/body-analysis.service';
import { generateBodyProfile } from '../services/body-profile.service';
import { syncBodyProfile } from '../services/body-sync.service';
import { aiEnabled, aiClassify, aiPose } from '../services/ai-client';

// ============================================================
//  UC3.1 - PHÂN TÍCH DÁNG NGƯỜI (điểm vào cho người dùng)
//  UC3.2/UC3.3 - xử lý & sinh Body Profile (thực hiện nội bộ trong analyzeBody)
//  UC3.4 - Xóa dữ liệu cơ thể
// ============================================================

function serializeProfile(p: any) {
  return {
    id: p.id,
    version: p.version,
    bodyShape: p.bodyShape,
    source: p.source,
    height: p.height,
    weight: p.weight,
    bust: p.bust,
    waist: p.waist,
    hip: p.hip,
    confidence: p.confidence,
    isPreliminary: p.isPreliminary,
    photoUrl: p.photoUrl,
    recommendations: p.recommendations,
    suggestedSizes: p.suggestedSizes,
    createdAt: p.createdAt,
  };
}

// GET /api/body/consent - trạng thái đồng ý xử lý dữ liệu cơ thể (UC3.1 bước 2)
export async function getConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    res.json({ consented: !!user?.bodyDataConsentAt, consentedAt: user?.bodyDataConsentAt ?? null });
  } catch (err) {
    next(err);
  }
}

// POST /api/body/consent - khách hàng đồng ý điều khoản xử lý dữ liệu cơ thể
export async function giveConsent(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { bodyDataConsentAt: new Date() },
    });
    res.json({ consented: true, consentedAt: user.bodyDataConsentAt });
  } catch (err) {
    next(err);
  }
}

const analyzeSchema = z.object({
  source: z.enum(['MANUAL', 'PHOTO']),
  height: z.coerce.number(),
  weight: z.coerce.number().optional(),
  bust: z.coerce.number(),
  waist: z.coerce.number(),
  hip: z.coerce.number(),
  // Tỷ lệ vai/hông ước lượng từ ảnh (nếu có) - chỉ mang tính tham khảo, lưu vào analysisResult
  shoulderHipRatio: z.coerce.number().optional(),
});

function inRange(value: number, range: { min: number; max: number }) {
  return value >= range.min && value <= range.max;
}

// POST /api/body/analyze - UC3.1 bước 4-9 (bao gồm gọi include UC3.2 xử lý + UC3.3 sinh hồ sơ)
export async function analyzeBody(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;

    // 2F: chưa đồng ý điều khoản xử lý dữ liệu cơ thể
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.bodyDataConsentAt) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(403).json({ message: 'Bạn cần đồng ý điều khoản xử lý dữ liệu cơ thể trước khi phân tích.', code: 'CONSENT_REQUIRED' });
    }

    const parsed = analyzeSchema.safeParse(req.body);
    if (!parsed.success) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'Vui lòng nhập đầy đủ số đo bắt buộc (chiều cao, ngực, eo, hông).' }); // 5F
    }
    const data = parsed.data;

    // 5F: số đo ngoài miền hợp lệ
    const rangeChecks: Array<[number, { min: number; max: number }, string]> = [
      [data.height, BODY_MEASUREMENT_RANGES.height, 'chiều cao'],
      [data.bust, BODY_MEASUREMENT_RANGES.bust, 'vòng ngực'],
      [data.waist, BODY_MEASUREMENT_RANGES.waist, 'vòng eo'],
      [data.hip, BODY_MEASUREMENT_RANGES.hip, 'vòng hông'],
    ];
    if (data.weight !== undefined) rangeChecks.push([data.weight, BODY_MEASUREMENT_RANGES.weight, 'cân nặng']);

    for (const [value, range, label] of rangeChecks) {
      if (!inRange(value, range)) {
        if (req.file) fs.unlink(req.file.path, () => {});
        return res.status(400).json({ message: `Số đo "${label}" phải nằm trong khoảng ${range.min}–${range.max}.` });
      }
    }

    // UC3.2 - include tới module xử lý phân tích cơ thể (số đo/ảnh -> tỷ lệ, dáng người, độ tin cậy)
    const result = processBodyAnalysis({
      source: data.source,
      height: data.height,
      weight: data.weight ?? null,
      bust: data.bust,
      waist: data.waist,
      hip: data.hip,
      shoulderHipRatio: data.shoulderHipRatio ?? null,
      hasPhoto: !!req.file,
    });

    // 6E: UC3.2 xử lý thất bại (2E/3E/5E/7E) -> thông báo, cho phép thử lại hoặc nhập số đo thủ công
    if (!result.ok || !result.bodyShape) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(422).json({
        message: `${result.note} Vui lòng thử lại hoặc nhập số đo thủ công.`,
        code: 'ANALYSIS_FAILED',
        status: result.status,
      });
    }
    const photoUrl = req.file ? `/uploads/body/${req.file.filename}` : null;

    // GĐ7 - nối AI service (nếu bật): chạy pose thật trên ảnh + phân loại bằng mô hình ML.
    // Mọi lỗi/timeout tự fallback về kết quả luật Node (result) ở trên.
    const analysisExtra: Record<string, unknown> = { engine: 'node-rule' };
    if (aiEnabled()) {
      if (req.file) {
        const pose = await aiPose(req.file.path, req.file.filename);
        if (pose) analysisExtra.pose = pose; // {status, confidence, numLandmarks}
      }
      const ai = await aiClassify({ bust: data.bust, waist: data.waist, hip: data.hip, shoulder: result.measurements.shoulder });
      if (ai) {
        result.bodyShape = ai.bodyShape as typeof result.bodyShape;
        if (ai.confidence != null) result.confidence = ai.confidence;
        analysisExtra.engine = 'ai-' + ai.method; // vd ai-ml
      }
    }

    // UC3.3 - include tới module sinh Body Profile (khuyến nghị + gợi ý size + lưu bản mới có phiên bản)
    const profile = await generateBodyProfile({
      userId,
      source: data.source,
      height: data.height,
      weight: data.weight ?? null,
      bust: data.bust,
      waist: data.waist,
      hip: data.hip,
      shoulderHipRatio: data.shoulderHipRatio ?? null,
      photoUrl,
      processing: result,
      analysisExtra,
    });

    // UC2.3 - 2a: tự đồng bộ ngay nếu khách hàng đã bật chế độ tự đồng bộ
    let autoSynced = false;
    const cp = await prisma.customerProfile.findUnique({ where: { userId }, select: { bodyProfileAutoSync: true } });
    if (cp?.bodyProfileAutoSync) {
      try {
        await syncBodyProfile(userId);
        autoSynced = true;
      } catch {
        // đồng bộ tự động thất bại không làm hỏng kết quả phân tích; khách hàng có thể đồng bộ thủ công
      }
    }

    res.status(201).json({
      message: 'Phân tích dáng người thành công',
      profile: serializeProfile(profile),
      canSyncToPersonalization: true, // UC2.3 đã sẵn sàng
      autoSynced,
    });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    next(err);
  }
}

// GET /api/body/profile - Body Profile hiện hành (bản mới nhất) - UC3.1 hiển thị lại khi quay lại trang
export async function getLatestProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const profile = await prisma.bodyProfile.findFirst({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ profile: profile ? serializeProfile(profile) : null });
  } catch (err) {
    next(err);
  }
}

// GET /api/body/history - lịch sử các lần phân tích (phiên bản, phục vụ truy vết - 7a/5a)
export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const profiles = await prisma.bodyProfile.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ history: profiles.map(serializeProfile) });
  } catch (err) {
    next(err);
  }
}

const deleteQuerySchema = z.object({
  scope: z.enum(['PHOTO_ONLY', 'PROFILE', 'ALL']),
});

// DELETE /api/body/data?scope=PHOTO_ONLY|PROFILE|ALL - UC3.4
export async function deleteBodyData(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const q = deleteQuerySchema.safeParse(req.query);
    if (!q.success) return res.status(400).json({ message: 'Phạm vi xóa không hợp lệ' });
    const { scope } = q.data;

    const profiles = await prisma.bodyProfile.findMany({ where: { userId } });
    // 2F: không tồn tại dữ liệu cơ thể để xóa
    if (profiles.length === 0) {
      return res.status(404).json({ message: 'Hiện không có dữ liệu cơ thể nào để xóa.' });
    }

    const photoPaths = profiles.filter((p: any) => p.photoUrl).map((p: any) => process.cwd() + p.photoUrl!);

    // 7E: xóa theo cơ chế nguyên tử - hoặc xóa trọn vẹn theo phạm vi, hoặc không đổi gì
    await prisma.$transaction(async (tx) => {
      if (scope === 'PHOTO_ONLY') {
        await tx.bodyProfile.updateMany({ where: { userId }, data: { photoUrl: null } });
      } else {
        // PROFILE hoặc ALL: xóa toàn bộ các bản Body Profile (không thể tách "giữ ảnh, xóa hồ sơ"
        // vì ảnh được lưu gắn theo từng bản ghi Body Profile trong mô hình dữ liệu hiện tại).
        // FK CustomerProfile.bodyProfileId (onDelete SetNull) tự hủy liên kết đồng bộ (UC2.3).
        await tx.bodyProfile.deleteMany({ where: { userId } });
        // b8 - dọn các size đề xuất từ Body Profile để chức năng phụ thuộc (UC2.2/UC5) quay về
        // thông tin thủ công/mặc định, không để lại tham chiếu mồ côi (bodyProfileId đã tự null qua FK)
        const cp = await tx.customerProfile.findUnique({ where: { userId }, select: { id: true } });
        if (cp) {
          await tx.customerSize.deleteMany({ where: { profileId: cp.id, source: 'BODY_PROFILE' } });
          await tx.customerProfile.update({ where: { id: cp.id }, data: { bodyProfileSyncedAt: null } });
        }
      }
      await tx.bodyDataDeletionLog.create({ data: { userId, scope } });
    });

    // Dọn file vật lý sau khi transaction DB thành công (best-effort, không ảnh hưởng tính nguyên tử của DB)
    for (const p of photoPaths) fs.unlink(p, () => {});

    const messages: Record<string, string> = {
      PHOTO_ONLY: 'Đã xóa ảnh, giữ lại Body Profile đã phân tích.',
      PROFILE: 'Đã xóa dữ liệu Body Profile.',
      ALL: 'Đã xóa toàn bộ dữ liệu cơ thể của bạn.',
    };
    res.json({ message: messages[scope] });
  } catch (err) {
    next(err);
  }
}
