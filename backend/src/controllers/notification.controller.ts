import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC12.4 - Quản lý thông báo của khách hàng
// ============================================================

const VALID_TYPES = ['ORDER', 'PAYMENT', 'RETURN', 'COMPLAINT', 'REVIEW', 'QA', 'PROMO', 'SUGGEST'];

// GET /api/notifications?type=&unread= - danh sách (lọc theo loại / chưa đọc)
export async function listNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const where: any = { userId };
    if (typeof req.query.type === 'string' && VALID_TYPES.includes(req.query.type)) where.type = req.query.type;
    if (req.query.unread === 'true') where.read = false;
    const items = await prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    const unread = await prisma.notification.count({ where: { userId, read: false } });
    res.json({ items, unread });
  } catch (err) {
    next(err);
  }
}

// GET /api/notifications/count - số chưa đọc (badge)
export async function unreadCount(req: Request, res: Response, next: NextFunction) {
  try {
    const count = await prisma.notification.count({ where: { userId: req.user!.userId, read: false } });
    res.json({ count });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notifications/:id/read - đánh dấu đã đọc
export async function markRead(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.notification.updateMany({ where: { id: Number(req.params.id), userId: req.user!.userId }, data: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notifications/read-all - đánh dấu tất cả đã đọc (5b)
export async function markAllRead(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.notification.updateMany({ where: { userId: req.user!.userId, read: false }, data: { read: true } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}
