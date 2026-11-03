import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// Gắn tên Quản trị viên vào danh sách log (không có FK cứng - đa hình)
async function attachAdmins<T extends { adminId: number }>(rows: T[]) {
  const ids = [...new Set(rows.map((r) => r.adminId))];
  const admins = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, email: true } });
  const map = new Map(admins.map((u) => [u.id, u]));
  return rows.map((r) => ({ ...r, admin: map.get(r.adminId) ?? null }));
}

// GET /api/admin/moderation-logs?targetType= - ERD 3.18 (Admin #9 "Kiểm duyệt")
export async function listModerationLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const where: any = {};
    if (typeof req.query.targetType === 'string') where.targetType = req.query.targetType;
    const logs = await prisma.moderationLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 });
    res.json({ logs: await attachAdmins(logs) });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/action-logs?targetType= - ERD 3.17 (Admin #12 "Nhật ký hoạt động")
export async function listActionLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const where: any = {};
    if (typeof req.query.targetType === 'string') where.targetType = req.query.targetType;
    const logs = await prisma.adminActionLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 });
    res.json({ logs: await attachAdmins(logs) });
  } catch (err) {
    next(err);
  }
}
