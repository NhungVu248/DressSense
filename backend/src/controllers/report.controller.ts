import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { notify } from '../services/notification.service';
import { logAdminAction } from '../services/admin-log.service';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  ERD 3.19 - user_reports (Admin #8 "Báo cáo vi phạm")
//  Buyer/Seller gửi báo cáo về shop/sản phẩm/người dùng; Admin tiếp nhận & xử lý.
// ============================================================

const createSchema = z.object({
  targetType: z.enum(['SHOP', 'PRODUCT', 'USER']),
  targetId: z.number().int().positive(),
  reason: z.string().trim().min(1, 'Nhập lý do báo cáo').max(255),
  description: z.string().trim().max(1000).optional(),
  evidenceUrl: z.string().trim().max(500).optional(),
});

// POST /api/reports - người dùng (Buyer/Seller) gửi báo cáo vi phạm
export async function createReport(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' });

    // Kiểm tra đối tượng bị báo cáo có tồn tại (quan hệ đa hình -> kiểm tra ở backend)
    const { targetType, targetId } = parsed.data;
    const exists =
      targetType === 'SHOP' ? await prisma.shop.count({ where: { id: targetId } })
      : targetType === 'PRODUCT' ? await prisma.product.count({ where: { id: targetId } })
      : await prisma.user.count({ where: { id: targetId } });
    if (!exists) return res.status(404).json({ message: 'Không tìm thấy đối tượng bị báo cáo.' });

    const report = await prisma.userReport.create({
      data: { reporterId: user.userId, ...parsed.data },
    });

    // Báo cho các Quản trị viên có báo cáo mới
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } });
    await Promise.all(admins.map((a) =>
      notify(a.id, 'SHOP', 'Báo cáo vi phạm mới', `Có báo cáo mới về ${targetType}.`, '/admin/reports')));

    res.status(201).json({ report });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/reports?status=&targetType=
export async function listReports(req: Request, res: Response, next: NextFunction) {
  try {
    const where: any = {};
    if (typeof req.query.status === 'string') where.status = req.query.status;
    if (typeof req.query.targetType === 'string') where.targetType = req.query.targetType;
    const reports = await prisma.userReport.findMany({ where, orderBy: { createdAt: 'desc' }, take: 300 });

    // Đính kèm tên người gửi để hiển thị (không có FK cứng)
    const reporterIds = [...new Set(reports.map((r) => r.reporterId))];
    const reporters = await prisma.user.findMany({
      where: { id: { in: reporterIds } }, select: { id: true, fullName: true, email: true },
    });
    const rmap = new Map(reporters.map((u) => [u.id, u]));
    const counts = await prisma.userReport.groupBy({ by: ['status'], _count: { _all: true } });

    res.json({
      reports: reports.map((r) => ({ ...r, reporter: rmap.get(r.reporterId) ?? null })),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
    });
  } catch (err) {
    next(err);
  }
}

const resolveSchema = z.object({
  status: z.enum(['PROCESSING', 'RESOLVED', 'REJECTED']),
  resolutionNote: z.string().trim().max(1000).optional(),
});

// PATCH /api/admin/reports/:id - Admin cập nhật trạng thái xử lý
export async function resolveReport(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const id = Number(req.params.id);
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const existing = await prisma.userReport.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy báo cáo.' });

    const done = parsed.data.status === 'RESOLVED' || parsed.data.status === 'REJECTED';
    const report = await prisma.userReport.update({
      where: { id },
      data: {
        status: parsed.data.status,
        resolutionNote: parsed.data.resolutionNote,
        adminId: user.userId,
        resolvedAt: done ? new Date() : null,
      },
    });
    await logAdminAction(user.userId, `REPORT_${parsed.data.status}`, 'REPORT', id,
      `${existing.targetType}#${existing.targetId}: ${parsed.data.resolutionNote || ''}`, req.ip);
    res.json({ report });
  } catch (err) {
    next(err);
  }
}
