import { prisma } from '../lib/prisma';
import type {
  AdminLogTarget,
  ModerationTarget,
  ModerationAction,
} from '@prisma/client';

// ERD 3.17 - ghi nhật ký thao tác quản trị (truy vết). Lỗi ghi log KHÔNG được
// làm hỏng nghiệp vụ chính, nên luôn bọc try/catch và nuốt lỗi.
export async function logAdminAction(
  adminId: number,
  action: string,
  targetType: AdminLogTarget,
  targetId?: number | null,
  description?: string,
  ipAddress?: string | null,
) {
  try {
    await prisma.adminActionLog.create({
      data: { adminId, action, targetType, targetId: targetId ?? null, description, ipAddress: ipAddress ?? null },
    });
  } catch {
    /* bỏ qua lỗi ghi log */
  }
}

// ERD 3.18 - ghi lịch sử kiểm duyệt (duyệt/từ chối/ẩn/khôi phục shop & sản phẩm).
export async function logModeration(
  adminId: number,
  targetType: ModerationTarget,
  targetId: number,
  action: ModerationAction,
  reason?: string | null,
) {
  try {
    await prisma.moderationLog.create({
      data: { adminId, targetType, targetId, action, reason: reason ?? null },
    });
  } catch {
    /* bỏ qua lỗi ghi log */
  }
}
