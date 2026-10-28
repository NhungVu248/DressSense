import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { notify } from '../services/notification.service';

// ============================================================
//  UC13.3 - Chiến dịch thông báo khuyến mãi (Quản trị viên tạo & gửi).
//  Hiển thị phía Khách hàng qua UC12.4. Tách bạch với thông báo giao dịch.
//  Chỉ gửi cho Khách hàng đang BẬT nhận marketing (10a).
// ============================================================

const segmentSchema = z.object({
  categoryIds: z.array(z.coerce.number().int()).optional(), // đã từng mua trong các danh mục này
  styles: z.array(z.string()).optional(),                   // phong cách ưa thích (UC2.1)
  hasPurchased: z.boolean().optional(),                     // đã từng mua hàng
}).strict();

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(150),
  content: z.string().trim().min(1).max(2000),
  imageUrl: z.string().trim().max(500).nullable().optional(),
  link: z.string().trim().max(300).nullable().optional(),
  audience: z.enum(['ALL', 'SEGMENT']).default('ALL'),
  segment: segmentSchema.nullable().optional(),
});

type Segment = z.infer<typeof segmentSchema>;

// Xác định danh sách Khách hàng nhận thông báo (userIds). Chỉ gồm KH đang bật marketing (10a).
async function resolveAudience(audience: 'ALL' | 'SEGMENT', segment: Segment | null): Promise<number[]> {
  const base = await prisma.user.findMany({
    where: { role: 'CUSTOMER', status: 'ACTIVE', marketingOptIn: true },
    select: { id: true },
  });
  let ids = new Set(base.map((u) => u.id));
  if (audience === 'ALL' || !segment) return [...ids]; // 4a - gửi toàn bộ

  // SEGMENT: giao (AND) các tiêu chí được cung cấp
  if (segment.categoryIds?.length) {
    const buyers = await prisma.order.findMany({
      where: { items: { some: { product: { categoryId: { in: segment.categoryIds } } } } },
      select: { userId: true }, distinct: ['userId'],
    });
    const set = new Set(buyers.map((b) => b.userId));
    ids = new Set([...ids].filter((id) => set.has(id)));
  }
  if (segment.hasPurchased) {
    const buyers = await prisma.order.findMany({ select: { userId: true }, distinct: ['userId'] });
    const set = new Set(buyers.map((b) => b.userId));
    ids = new Set([...ids].filter((id) => set.has(id)));
  }
  if (segment.styles?.length) {
    const profiles = await prisma.customerProfile.findMany({
      where: { userId: { in: [...ids] }, styleDeclaredAt: { not: null } },
      select: { userId: true, preferredStyles: true },
    });
    const wanted = segment.styles.map((s) => s.toLowerCase());
    const matched = new Set(
      profiles.filter((p) => {
        const arr = Array.isArray(p.preferredStyles) ? (p.preferredStyles as any[]) : [];
        return arr.some((x) => wanted.includes(String(x?.style ?? x).toLowerCase()));
      }).map((p) => p.userId),
    );
    ids = new Set([...ids].filter((id) => matched.has(id)));
  }
  return [...ids];
}

// Gửi chiến dịch tới nhóm đối tượng (dùng chung cho "gửi ngay" và scheduler). Trả số người nhận.
export async function dispatchCampaign(campaignId: number): Promise<number> {
  const c = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!c || c.status === 'SENT' || c.status === 'CANCELLED') return 0; // 9E - không gửi lại
  const recipients = await resolveAudience(c.audience, (c.segment as Segment | null) ?? null);
  for (const userId of recipients) {
    await notify(userId, 'PROMO', c.title, c.content, c.link ?? undefined); // UC12.4 - hiển thị phía KH
  }
  await prisma.campaign.update({ where: { id: c.id }, data: { status: 'SENT', sentAt: new Date(), recipientCount: recipients.length } });
  return recipients.length;
}

// GET /api/admin/campaigns
export async function listCampaigns(_req: Request, res: Response, next: NextFunction) {
  try {
    const campaigns = await prisma.campaign.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ campaigns });
  } catch (err) { next(err); }
}

// POST /api/admin/campaigns
export async function createCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const body = campaignSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' });
    const c = await prisma.campaign.create({
      data: {
        name: body.data.name, title: body.data.title, content: body.data.content,
        imageUrl: body.data.imageUrl ?? null, link: body.data.link ?? null,
        audience: body.data.audience, segment: body.data.segment ?? undefined,
        status: 'DRAFT', createdBy: req.user!.userId, // 6b - lưu nháp
      },
    });
    res.status(201).json({ campaign: c });
  } catch (err) { next(err); }
}

// PATCH /api/admin/campaigns/:id - chỉ sửa khi chưa gửi
export async function updateCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const cur = await prisma.campaign.findUnique({ where: { id } });
    if (!cur) return res.status(404).json({ message: 'Không tìm thấy chiến dịch.' });
    if (cur.status === 'SENT') return res.status(400).json({ message: 'Chiến dịch đã gửi, không thể chỉnh sửa.' }); // 9E
    const body = campaignSchema.partial().safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const d = body.data;
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        name: d.name, title: d.title, content: d.content, imageUrl: d.imageUrl, link: d.link,
        audience: d.audience, ...(d.segment !== undefined ? { segment: d.segment ?? undefined } : {}),
      },
    });
    res.json({ campaign: updated });
  } catch (err) { next(err); }
}

// DELETE /api/admin/campaigns/:id
export async function deleteCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const c = await prisma.campaign.findUnique({ where: { id } });
    if (!c) return res.status(404).json({ message: 'Không tìm thấy chiến dịch.' });
    await prisma.campaign.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (err) { next(err); }
}

// GET /api/admin/campaigns/:id/audience - xem trước số người nhận (5E nếu rỗng)
export async function previewAudience(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const c = await prisma.campaign.findUnique({ where: { id } });
    if (!c) return res.status(404).json({ message: 'Không tìm thấy chiến dịch.' });
    const recipients = await resolveAudience(c.audience, (c.segment as Segment | null) ?? null);
    res.json({ count: recipients.length, empty: recipients.length === 0 });
  } catch (err) { next(err); }
}

// POST /api/admin/campaigns/:id/send - gửi ngay (8-10)
export async function sendCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const c = await prisma.campaign.findUnique({ where: { id } });
    if (!c) return res.status(404).json({ message: 'Không tìm thấy chiến dịch.' });
    if (c.status === 'SENT') return res.status(400).json({ message: 'Chiến dịch đã được gửi.' }); // 9E
    const recipients = await resolveAudience(c.audience, (c.segment as Segment | null) ?? null);
    if (recipients.length === 0) return res.status(400).json({ message: 'Không có Khách hàng phù hợp với tiêu chí (danh sách nhận rỗng).', code: 'EMPTY_AUDIENCE' }); // 5E
    const sent = await dispatchCampaign(id);
    res.json({ sent, recipientCount: sent });
  } catch (err) { next(err); }
}

const scheduleSchema = z.object({ scheduledAt: z.coerce.date() });

// POST /api/admin/campaigns/:id/schedule - lên lịch gửi (6a)
export async function scheduleCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const c = await prisma.campaign.findUnique({ where: { id } });
    if (!c) return res.status(404).json({ message: 'Không tìm thấy chiến dịch.' });
    if (c.status === 'SENT') return res.status(400).json({ message: 'Chiến dịch đã được gửi.' });
    const body = scheduleSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Thời gian lên lịch không hợp lệ.' });
    if (body.data.scheduledAt <= new Date()) return res.status(400).json({ message: 'Thời gian lên lịch phải ở tương lai.' });
    const updated = await prisma.campaign.update({ where: { id }, data: { status: 'SCHEDULED', scheduledAt: body.data.scheduledAt } });
    res.json({ campaign: updated });
  } catch (err) { next(err); }
}

// POST /api/admin/campaigns/:id/cancel - hủy chiến dịch đã lên lịch (9a)
export async function cancelCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const c = await prisma.campaign.findUnique({ where: { id } });
    if (!c) return res.status(404).json({ message: 'Không tìm thấy chiến dịch.' });
    if (c.status === 'SENT') return res.status(400).json({ message: 'Chiến dịch đã gửi, không thể hủy.' });
    const updated = await prisma.campaign.update({ where: { id }, data: { status: 'CANCELLED' } });
    res.json({ campaign: updated });
  } catch (err) { next(err); }
}
