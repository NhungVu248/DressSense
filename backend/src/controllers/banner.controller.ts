import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC13.2 - Quản lý banner quảng cáo (Quản trị viên).
//  Banner có vị trí, thời gian, mức ưu tiên; hết hạn tự ngừng (scheduler).
// ============================================================

function lifecycleOnActivate(startsAt: Date | null, endsAt: Date | null, now = new Date()): 'SCHEDULED' | 'RUNNING' | 'ENDED' {
  if (endsAt && now > endsAt) return 'ENDED';
  if (startsAt && now < startsAt) return 'SCHEDULED';
  return 'RUNNING';
}

const bannerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  imageUrl: z.string().trim().min(1, 'Vui lòng cung cấp ảnh banner.'),
  title: z.string().trim().max(120).nullable().optional(),
  subtitle: z.string().trim().max(200).nullable().optional(),
  position: z.enum(['HOME_HERO', 'HOME_STRIP', 'PROMO_PAGE']).default('HOME_HERO'),
  linkType: z.enum(['NONE', 'PRODUCT', 'CATEGORY', 'PROMO', 'URL']).default('NONE'),
  linkValue: z.string().trim().max(300).nullable().optional(),
  priority: z.coerce.number().int().min(0).default(0),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
});

// Kiểm tra liên kết đích + sản phẩm/danh mục còn khả dụng (3E.1, 4E) + thời gian (5E).
async function validateBanner(data: z.infer<typeof bannerSchema>): Promise<string | null> {
  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) return 'Thời gian hiển thị không hợp lệ (kết thúc phải sau bắt đầu).'; // 5E
  if (data.linkType !== 'NONE' && !data.linkValue) return 'Vui lòng nhập liên kết đích cho banner.'; // 3E.1
  if (data.linkType === 'PRODUCT') {
    const p = await prisma.product.findUnique({ where: { id: Number(data.linkValue) }, select: { status: true, deletedAt: true } });
    if (!p || p.deletedAt || p.status !== 'ACTIVE') return 'Sản phẩm đích không khả dụng.'; // 4E
  }
  if (data.linkType === 'CATEGORY') {
    const c = await prisma.category.findUnique({ where: { id: Number(data.linkValue) }, select: { id: true } });
    if (!c) return 'Danh mục đích không tồn tại.'; // 3E.1
  }
  return null;
}

// GET /api/admin/banners - danh sách toàn bộ banner
export async function listBanners(_req: Request, res: Response, next: NextFunction) {
  try {
    const banners = await prisma.banner.findMany({ orderBy: [{ position: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }] });
    res.json({ banners });
  } catch (err) { next(err); }
}

// POST /api/admin/banners
export async function createBanner(req: Request, res: Response, next: NextFunction) {
  try {
    const body = bannerSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' });
    const err = await validateBanner(body.data);
    if (err) return res.status(400).json({ message: err });
    const b = await prisma.banner.create({
      data: {
        name: body.data.name, imageUrl: body.data.imageUrl, title: body.data.title ?? null, subtitle: body.data.subtitle ?? null,
        position: body.data.position, linkType: body.data.linkType, linkValue: body.data.linkValue ?? null,
        priority: body.data.priority, startsAt: body.data.startsAt ?? null, endsAt: body.data.endsAt ?? null,
        status: 'DRAFT', createdBy: req.user!.userId, // 7a - lưu nháp
      },
    });
    res.status(201).json({ banner: b });
  } catch (err) { next(err); }
}

// PATCH /api/admin/banners/:id
export async function updateBanner(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const cur = await prisma.banner.findUnique({ where: { id } });
    if (!cur) return res.status(404).json({ message: 'Không tìm thấy banner.' });
    const body = bannerSchema.partial().safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });
    const merged = { ...cur, ...body.data } as z.infer<typeof bannerSchema>;
    const err = await validateBanner(merged);
    if (err) return res.status(400).json({ message: err });
    const updated = await prisma.banner.update({ where: { id }, data: { ...body.data } as any });
    res.json({ banner: updated });
  } catch (err) { next(err); }
}

// POST /api/admin/banners/:id/activate
export async function activateBanner(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const b = await prisma.banner.findUnique({ where: { id } });
    if (!b) return res.status(404).json({ message: 'Không tìm thấy banner.' });
    const status = lifecycleOnActivate(b.startsAt, b.endsAt);
    if (status === 'ENDED') return res.status(400).json({ message: 'Thời gian đã qua, không thể hiển thị.' });
    const updated = await prisma.banner.update({ where: { id }, data: { status } });
    res.json({ banner: updated });
  } catch (err) { next(err); }
}

// POST /api/admin/banners/:id/hide - tạm ẩn nhưng GIỮ dữ liệu (9b)
export async function hideBanner(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const b = await prisma.banner.findUnique({ where: { id } });
    if (!b) return res.status(404).json({ message: 'Không tìm thấy banner.' });
    const updated = await prisma.banner.update({ where: { id }, data: { status: 'STOPPED' } });
    res.json({ banner: updated });
  } catch (err) { next(err); }
}

// DELETE /api/admin/banners/:id
export async function deleteBanner(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const b = await prisma.banner.findUnique({ where: { id } });
    if (!b) return res.status(404).json({ message: 'Không tìm thấy banner.' });
    await prisma.banner.delete({ where: { id } });
    res.json({ deleted: true });
  } catch (err) { next(err); }
}

// GET /api/banners?position= - CÔNG KHAI: banner đang hiển thị (sắp theo ưu tiên) - 9a
export async function listPublicBanners(req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const position = typeof req.query.position === 'string' ? req.query.position : undefined;
    const banners = await prisma.banner.findMany({
      where: {
        status: 'RUNNING',
        ...(position ? { position: position as any } : {}),
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      select: { id: true, name: true, imageUrl: true, title: true, subtitle: true, position: true, linkType: true, linkValue: true },
    });
    res.json({ banners });
  } catch (err) { next(err); }
}
