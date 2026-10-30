import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { notify } from '../services/notification.service';
import type { JwtPayload } from '../utils/jwt';

// ============================================================
//  Tin nhắn / Chăm sóc khách hàng (CSKH)
//  Khách hàng <-> Người bán (SELLER) hoặc Khách hàng <-> Admin (ADMIN).
// ============================================================

const ADMIN_LABEL = 'CSKH DressSense';

function canAccess(conv: { customerId: number; sellerId: number | null; type: string }, user: JwtPayload) {
  if (conv.customerId === user.userId) return true;
  if (conv.type === 'SELLER' && conv.sellerId === user.userId) return true;
  if (conv.type === 'ADMIN' && user.role === 'ADMIN') return true;
  return false;
}
const isCustomerSide = (conv: { customerId: number }, userId: number) => conv.customerId === userId;

// POST /api/messages/conversation  { type, sellerId?, orderId? }  (khách hàng mở)
export async function openConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const body = z.object({
      type: z.enum(['SELLER', 'ADMIN']),
      sellerId: z.coerce.number().optional(),
      orderId: z.coerce.number().optional(),
    }).parse(req.body);
    if (body.type === 'SELLER' && !body.sellerId) return res.status(400).json({ message: 'Thiếu gian hàng.' });

    let conv = await prisma.conversation.findFirst({
      where: { customerId: user.userId, type: body.type, sellerId: body.type === 'SELLER' ? body.sellerId! : null },
    });
    if (!conv) {
      conv = await prisma.conversation.create({
        data: { type: body.type, customerId: user.userId, sellerId: body.type === 'SELLER' ? body.sellerId! : null, orderId: body.orderId ?? null },
      });
    }
    res.json({ conversationId: conv.id });
  } catch (err) { next(err); }
}

// GET /api/messages/conversations  - danh sách hội thoại theo vai trò
export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const where = user.role === 'ADMIN'
      ? { type: 'ADMIN' as const }
      : { OR: [{ customerId: user.userId }, { type: 'SELLER' as const, sellerId: user.userId }] };

    const convs = await prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    // lấy tên các bên liên quan
    const customerIds = [...new Set(convs.map((c) => c.customerId))];
    const sellerIds = [...new Set(convs.map((c) => c.sellerId).filter(Boolean) as number[])];
    const users = await prisma.user.findMany({ where: { id: { in: [...customerIds, ...sellerIds] } }, select: { id: true, fullName: true, shopName: true } });
    const umap = new Map(users.map((u) => [u.id, u]));

    const items = await Promise.all(convs.map(async (c) => {
      const meCustomer = isCustomerSide(c, user.userId);
      const myReadAt = meCustomer ? c.customerReadAt : c.partnerReadAt;
      const starred = meCustomer ? c.customerStarred : c.partnerStarred;
      const unread = await prisma.message.count({ where: { conversationId: c.id, senderId: { not: user.userId }, createdAt: myReadAt ? { gt: myReadAt } : undefined } });
      // tên đối tác (bên kia)
      let counterpart: string;
      if (meCustomer) counterpart = c.type === 'ADMIN' ? ADMIN_LABEL : (umap.get(c.sellerId!)?.shopName || umap.get(c.sellerId!)?.fullName || 'Gian hàng');
      else counterpart = umap.get(c.customerId)?.fullName || 'Khách hàng';
      return {
        id: c.id, type: c.type, counterpart, orderId: c.orderId,
        lastMessage: c.messages[0]?.content ?? null, lastMessageAt: c.lastMessageAt,
        unread, starred,
      };
    }));
    res.json({ conversations: items });
  } catch (err) { next(err); }
}

// GET /api/messages/conversations/:id  - tin nhắn + đánh dấu đã đọc phía mình
export async function getConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const id = Number(req.params.id);
    const conv = await prisma.conversation.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    if (!conv) return res.status(404).json({ message: 'Không tìm thấy hội thoại.' });
    if (!canAccess(conv, user)) return res.status(403).json({ message: 'Không có quyền xem hội thoại này.' });

    // đánh dấu đã đọc phía mình
    const meCustomer = isCustomerSide(conv, user.userId);
    await prisma.conversation.update({ where: { id }, data: meCustomer ? { customerReadAt: new Date() } : { partnerReadAt: new Date() } });

    const other = meCustomer
      ? (conv.type === 'ADMIN' ? null : conv.sellerId)
      : conv.customerId;
    const u = other ? await prisma.user.findUnique({ where: { id: other }, select: { fullName: true, shopName: true } }) : null;
    const counterpart = meCustomer ? (conv.type === 'ADMIN' ? ADMIN_LABEL : (u?.shopName || u?.fullName || 'Gian hàng')) : (u?.fullName || 'Khách hàng');

    res.json({
      conversation: { id: conv.id, type: conv.type, counterpart, orderId: conv.orderId },
      messages: conv.messages.map((m) => ({ id: m.id, content: m.content, createdAt: m.createdAt, mine: m.senderId === user.userId })),
    });
  } catch (err) { next(err); }
}

// POST /api/messages/conversations/:id/messages  { content }
export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const id = Number(req.params.id);
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ message: 'Nội dung tin nhắn trống.' });
    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv) return res.status(404).json({ message: 'Không tìm thấy hội thoại.' });
    if (!canAccess(conv, user)) return res.status(403).json({ message: 'Không có quyền gửi.' });

    const msg = await prisma.message.create({ data: { conversationId: id, senderId: user.userId, content } });
    const meCustomer = isCustomerSide(conv, user.userId);
    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: new Date(), ...(meCustomer ? { customerReadAt: new Date() } : { partnerReadAt: new Date() }) },
    });

    // thông báo bên nhận
    if (meCustomer) {
      if (conv.type === 'SELLER' && conv.sellerId) {
        await notify(conv.sellerId, 'MESSAGE', 'Tin nhắn mới từ khách hàng', content.slice(0, 80), '/seller/messages');
      } else if (conv.type === 'ADMIN') {
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
        await Promise.all(admins.map((a) => notify(a.id, 'MESSAGE', 'Tin nhắn CSKH mới', content.slice(0, 80), '/admin/messages')));
      }
    } else {
      await notify(conv.customerId, 'MESSAGE', 'Tin nhắn mới', content.slice(0, 80), '/messages');
    }

    res.json({ id: msg.id, content: msg.content, createdAt: msg.createdAt, mine: true });
  } catch (err) { next(err); }
}

// PATCH /api/messages/conversations/:id/star  - đánh dấu quan trọng (phía mình)
export async function toggleStar(req: Request, res: Response, next: NextFunction) {
  try {
    const user = req.user as JwtPayload;
    const id = Number(req.params.id);
    const conv = await prisma.conversation.findUnique({ where: { id } });
    if (!conv) return res.status(404).json({ message: 'Không tìm thấy hội thoại.' });
    if (!canAccess(conv, user)) return res.status(403).json({ message: 'Không có quyền.' });
    const meCustomer = isCustomerSide(conv, user.userId);
    const cur = meCustomer ? conv.customerStarred : conv.partnerStarred;
    const updated = await prisma.conversation.update({ where: { id }, data: meCustomer ? { customerStarred: !cur } : { partnerStarred: !cur } });
    res.json({ starred: meCustomer ? updated.customerStarred : updated.partnerStarred });
  } catch (err) { next(err); }
}
