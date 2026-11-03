import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { notify } from '../services/notification.service';
import { logAdminAction } from '../services/admin-log.service';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  ERD 3.22 - platform_announcements (Admin #11 "Thông báo")
//  Admin tạo thông báo toàn sàn cho nhóm Buyer/Seller/ALL; khi phát hành thì
//  fan-out thành Notification cho từng người dùng trong nhóm (hiển thị ở UC12.4).
// ============================================================

// GET /api/admin/announcements
export async function listAnnouncements(_req: Request, res: Response, next: NextFunction) {
  try {
    const announcements = await prisma.platformAnnouncement.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    res.json({ announcements });
  } catch (err) {
    next(err);
  }
}

const schema = z.object({
  title: z.string().trim().min(1, 'Nhập tiêu đề').max(200),
  content: z.string().trim().min(1, 'Nhập nội dung'),
  targetAudience: z.enum(['ALL', 'BUYER', 'SELLER']).default('ALL'),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
});

// POST /api/admin/announcements - tạo bản nháp
export async function createAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' });
    const { title, content, targetAudience, startAt, endAt } = parsed.data;
    const announcement = await prisma.platformAnnouncement.create({
      data: {
        adminId: user.userId, title, content, targetAudience,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
      },
    });
    res.status(201).json({ announcement });
  } catch (err) {
    next(err);
  }
}

// PUT /api/admin/announcements/:id - sửa (chỉ khi còn DRAFT)
export async function updateAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.platformAnnouncement.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy thông báo.' });
    if (existing.status !== 'DRAFT') return res.status(400).json({ message: 'Chỉ sửa được bản nháp.' });
    const parsed = schema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const data: any = { ...parsed.data };
    if (parsed.data.startAt !== undefined) data.startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : null;
    if (parsed.data.endAt !== undefined) data.endAt = parsed.data.endAt ? new Date(parsed.data.endAt) : null;
    const announcement = await prisma.platformAnnouncement.update({ where: { id }, data });
    res.json({ announcement });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/announcements/:id/publish - phát hành & gửi tới nhóm người dùng
export async function publishAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const id = Number(req.params.id);
    const ann = await prisma.platformAnnouncement.findUnique({ where: { id } });
    if (!ann) return res.status(404).json({ message: 'Không tìm thấy thông báo.' });
    if (ann.status === 'PUBLISHED') return res.status(400).json({ message: 'Thông báo đã được phát hành.' });

    // Chọn người nhận theo nhóm. Lưu ý: audience ERD "BUYER" ánh xạ sang Role.CUSTOMER của hệ thống.
    const roles: ('CUSTOMER' | 'SELLER')[] =
      ann.targetAudience === 'BUYER' ? ['CUSTOMER']
      : ann.targetAudience === 'SELLER' ? ['SELLER']
      : ['CUSTOMER', 'SELLER'];
    const recipients = await prisma.user.findMany({ where: { role: { in: roles } }, select: { id: true } });

    await Promise.all(recipients.map((u) =>
      notify(u.id, 'SHOP', ann.title, ann.content, '/notifications')));

    const announcement = await prisma.platformAnnouncement.update({
      where: { id },
      data: { status: 'PUBLISHED', recipientCount: recipients.length },
    });
    await logAdminAction(user.userId, 'PUBLISH_ANNOUNCEMENT', 'SETTING', id, `${ann.targetAudience} · ${recipients.length} người`, req.ip);
    res.json({ announcement });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/admin/announcements/:id
export async function deleteAnnouncement(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.platformAnnouncement.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy thông báo.' });
    await prisma.platformAnnouncement.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
