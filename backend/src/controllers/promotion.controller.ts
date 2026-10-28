import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC13.1 - Quản lý khuyến mãi: Voucher đầy đủ + Flash Sale.
//  Người bán quản lý trong phạm vi gian hàng; Quản trị viên quản lý toàn hệ thống.
// ============================================================

const isAdmin = (req: Request) => req.user?.role === 'ADMIN';

// Trạng thái vòng đời suy ra từ thời gian khi kích hoạt (DRAFT -> SCHEDULED/RUNNING/ENDED)
function lifecycleOnActivate(startsAt: Date | null, endsAt: Date | null, now = new Date()): 'SCHEDULED' | 'RUNNING' | 'ENDED' {
  if (endsAt && now > endsAt) return 'ENDED';
  if (startsAt && now < startsAt) return 'SCHEDULED';
  return 'RUNNING';
}

// ---------------------------------------------------------------
//  VOUCHER
// ---------------------------------------------------------------

const voucherSchema = z.object({
  code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/, 'Mã chỉ gồm chữ, số, gạch.'),
  description: z.string().trim().max(200).optional(),
  type: z.enum(['PERCENT', 'FIXED']),
  value: z.coerce.number().int().positive(),
  minOrder: z.coerce.number().int().min(0).default(0),
  maxDiscount: z.coerce.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  usageLimit: z.coerce.number().int().positive().nullable().optional(),
  perUserLimit: z.coerce.number().int().positive().nullable().optional(),
  scope: z.enum(['ALL', 'PRODUCT', 'CATEGORY']).default('ALL'),
  scopeIds: z.array(z.coerce.number().int()).default([]),
});

// Kiểm tra dữ liệu chung + quyền sở hữu khi scope theo sản phẩm (Người bán).
async function validateVoucherInput(req: Request, data: z.infer<typeof voucherSchema>): Promise<string | null> {
  if (data.type === 'PERCENT' && data.value > 100) return 'Giảm theo phần trăm phải trong khoảng 1–100.'; // 7E.1
  if (data.startsAt && data.endsAt && data.endsAt <= data.startsAt) return 'Thời gian kết thúc phải sau thời gian bắt đầu.'; // 7E
  if (data.scope !== 'ALL' && data.scopeIds.length === 0) return 'Vui lòng chọn sản phẩm/danh mục áp dụng cho phạm vi đã chọn.';
  if (data.scope === 'PRODUCT' && !isAdmin(req)) {
    const owned = await prisma.product.count({ where: { id: { in: data.scopeIds }, sellerId: req.user!.userId } });
    if (owned !== data.scopeIds.length) return 'Chỉ được áp dụng cho sản phẩm thuộc gian hàng của bạn.';
  }
  return null;
}

// GET /api/promotions/vouchers
export async function listVouchersManage(req: Request, res: Response, next: NextFunction) {
  try {
    const where = isAdmin(req) ? {} : { sellerId: req.user!.userId };
    const vouchers = await prisma.voucher.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ vouchers });
  } catch (err) { next(err); }
}

// POST /api/promotions/vouchers
export async function createVoucher(req: Request, res: Response, next: NextFunction) {
  try {
    const body = voucherSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' });
    const err = await validateVoucherInput(req, body.data);
    if (err) return res.status(400).json({ message: err });

    const code = body.data.code.toUpperCase();
    if (await prisma.voucher.findUnique({ where: { code } })) return res.status(409).json({ message: 'Mã voucher đã tồn tại.' });

    const sellerId = isAdmin(req) ? null : req.user!.userId; // Admin = toàn hệ thống; Người bán = của mình
    const v = await prisma.voucher.create({
      data: {
        code, description: body.data.description ?? null, type: body.data.type, value: body.data.value,
        minOrder: body.data.minOrder, maxDiscount: body.data.maxDiscount ?? null,
        startsAt: body.data.startsAt ?? null, endsAt: body.data.endsAt ?? null,
        usageLimit: body.data.usageLimit ?? null, perUserLimit: body.data.perUserLimit ?? null,
        scope: body.data.scope, scopeIds: body.data.scopeIds, sellerId,
        status: 'DRAFT', active: true, // 4a - lưu nháp, kích hoạt sau
      },
    });
    res.status(201).json({ voucher: v });
  } catch (err) { next(err); }
}

// Lấy voucher theo id trong phạm vi quyền (seller: của mình).
async function findOwnVoucher(req: Request, id: number) {
  return prisma.voucher.findFirst({ where: isAdmin(req) ? { id } : { id, sellerId: req.user!.userId } });
}

// PATCH /api/promotions/vouchers/:id
export async function updateVoucher(req: Request, res: Response, next: NextFunction) {
  try {
    const v = await findOwnVoucher(req, Number(req.params.id));
    if (!v) return res.status(404).json({ message: 'Không tìm thấy voucher.' });
    const body = voucherSchema.partial().safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });

    // Đang diễn ra: chỉ cho sửa thông tin không ảnh hưởng quyền lợi đơn đã phát sinh (gia hạn/mô tả)
    if (v.status === 'RUNNING') {
      const allowed: any = {};
      if (body.data.description !== undefined) allowed.description = body.data.description ?? null;
      if (body.data.endsAt !== undefined) allowed.endsAt = body.data.endsAt ?? null;
      if (body.data.usageLimit !== undefined) allowed.usageLimit = body.data.usageLimit ?? null;
      const updated = await prisma.voucher.update({ where: { id: v.id }, data: allowed });
      return res.json({ voucher: updated, note: 'Voucher đang diễn ra: chỉ cập nhật mô tả, hạn và tổng lượt.' });
    }
    if (v.status === 'ENDED') return res.status(400).json({ message: 'Voucher đã kết thúc, không thể chỉnh sửa.' });

    const merged = { ...v, ...body.data } as any;
    const err = await validateVoucherInput(req, { ...merged, scopeIds: merged.scopeIds ?? [] });
    if (err) return res.status(400).json({ message: err });
    const d = body.data;
    const updated = await prisma.voucher.update({
      where: { id: v.id },
      data: {
        description: d.description, type: d.type, value: d.value, minOrder: d.minOrder,
        maxDiscount: d.maxDiscount, startsAt: d.startsAt, endsAt: d.endsAt,
        usageLimit: d.usageLimit, perUserLimit: d.perUserLimit, scope: d.scope, scopeIds: d.scopeIds,
      },
    });
    res.json({ voucher: updated });
  } catch (err) { next(err); }
}

// POST /api/promotions/vouchers/:id/activate - đưa Nháp vào vận hành (Lên lịch / Đang diễn ra)
export async function activateVoucher(req: Request, res: Response, next: NextFunction) {
  try {
    const v = await findOwnVoucher(req, Number(req.params.id));
    if (!v) return res.status(404).json({ message: 'Không tìm thấy voucher.' });
    if (v.status !== 'DRAFT' && v.status !== 'SCHEDULED') return res.status(400).json({ message: 'Chỉ kích hoạt được voucher ở trạng thái Nháp/Đã lên lịch.' });
    const status = lifecycleOnActivate(v.startsAt, v.endsAt);
    if (status === 'ENDED') return res.status(400).json({ message: 'Thời gian đã qua, không thể kích hoạt.' });
    const updated = await prisma.voucher.update({ where: { id: v.id }, data: { status, active: true } });
    res.json({ voucher: updated });
  } catch (err) { next(err); }
}

// POST /api/promotions/vouchers/:id/stop - chủ động ngừng (10a)
export async function stopVoucher(req: Request, res: Response, next: NextFunction) {
  try {
    const v = await findOwnVoucher(req, Number(req.params.id));
    if (!v) return res.status(404).json({ message: 'Không tìm thấy voucher.' });
    const updated = await prisma.voucher.update({ where: { id: v.id }, data: { status: 'STOPPED', active: false } });
    res.json({ voucher: updated });
  } catch (err) { next(err); }
}

// DELETE /api/promotions/vouchers/:id - chỉ xóa bản Nháp
export async function deleteVoucher(req: Request, res: Response, next: NextFunction) {
  try {
    const v = await findOwnVoucher(req, Number(req.params.id));
    if (!v) return res.status(404).json({ message: 'Không tìm thấy voucher.' });
    if (v.status !== 'DRAFT') return res.status(400).json({ message: 'Chỉ xóa được voucher ở trạng thái Nháp. Dùng Ngừng cho chương trình đang chạy.' });
    await prisma.voucher.delete({ where: { id: v.id } });
    res.json({ deleted: true });
  } catch (err) { next(err); }
}

// ---------------------------------------------------------------
//  FLASH SALE
// ---------------------------------------------------------------

const flashSchema = z.object({
  productId: z.coerce.number().int(),
  variantId: z.coerce.number().int().nullable().optional(),
  salePrice: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  perUserLimit: z.coerce.number().int().positive().nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

const availableStock = (variants: { stock: number; reserved: number }[]) =>
  variants.reduce((a, v) => a + Math.max(0, v.stock - v.reserved), 0);

// Kiểm tra dữ liệu Flash Sale + quyền sở hữu sản phẩm.
async function validateFlashInput(req: Request, data: z.infer<typeof flashSchema>): Promise<string | null> {
  if (data.endsAt <= data.startsAt) return 'Thời gian kết thúc phải sau thời gian bắt đầu.'; // 7E
  const product = await prisma.product.findUnique({ where: { id: data.productId }, include: { variants: true } });
  if (!product || product.deletedAt) return 'Sản phẩm không tồn tại.';
  if (!isAdmin(req) && product.sellerId !== req.user!.userId) return 'Chỉ tạo Flash Sale cho sản phẩm thuộc gian hàng của bạn.';
  if (product.status !== 'ACTIVE') return 'Sản phẩm đã ngừng bán, không thể đưa vào Flash Sale.'; // 7E.3
  if (data.salePrice >= product.price) return 'Giá Flash Sale phải thấp hơn giá bán hiện tại.'; // 7E.1
  if (data.variantId != null && !product.variants.some((v) => v.id === data.variantId)) return 'Biến thể không thuộc sản phẩm.';
  const stock = data.variantId != null
    ? availableStock(product.variants.filter((v) => v.id === data.variantId))
    : availableStock(product.variants);
  if (data.quantity > stock) return `Số suất (${data.quantity}) vượt tồn kho khả dụng (${stock}).`; // 7E.2
  return null;
}

// GET /api/promotions/flash-sales
export async function listFlashSales(req: Request, res: Response, next: NextFunction) {
  try {
    const where = isAdmin(req) ? {} : { sellerId: req.user!.userId };
    const flashSales = await prisma.flashSale.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { product: { select: { id: true, name: true, price: true, images: { where: { isPrimary: true }, take: 1 } } } },
    });
    res.json({ flashSales });
  } catch (err) { next(err); }
}

// POST /api/promotions/flash-sales
export async function createFlashSale(req: Request, res: Response, next: NextFunction) {
  try {
    const body = flashSchema.safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: body.error.issues[0]?.message ?? 'Dữ liệu không hợp lệ.' });
    const err = await validateFlashInput(req, body.data);
    if (err) return res.status(400).json({ message: err });
    const product = await prisma.product.findUnique({ where: { id: body.data.productId }, select: { sellerId: true } });
    const fs = await prisma.flashSale.create({
      data: {
        sellerId: product!.sellerId, productId: body.data.productId, variantId: body.data.variantId ?? null,
        salePrice: body.data.salePrice, quantity: body.data.quantity, perUserLimit: body.data.perUserLimit ?? null,
        startsAt: body.data.startsAt, endsAt: body.data.endsAt, status: 'DRAFT',
      },
    });
    res.status(201).json({ flashSale: fs });
  } catch (err) { next(err); }
}

async function findOwnFlash(req: Request, id: number) {
  return prisma.flashSale.findFirst({ where: isAdmin(req) ? { id } : { id, sellerId: req.user!.userId } });
}

// PATCH /api/promotions/flash-sales/:id
export async function updateFlashSale(req: Request, res: Response, next: NextFunction) {
  try {
    const fs = await findOwnFlash(req, Number(req.params.id));
    if (!fs) return res.status(404).json({ message: 'Không tìm thấy Flash Sale.' });
    if (fs.status === 'ENDED') return res.status(400).json({ message: 'Flash Sale đã kết thúc.' });
    const body = flashSchema.partial().safeParse(req.body);
    if (!body.success) return res.status(400).json({ message: 'Dữ liệu không hợp lệ.' });

    // Đang diễn ra: chỉ cho tăng suất / gia hạn (không hạ dưới số đã bán)
    if (fs.status === 'RUNNING') {
      const data: any = {};
      if (body.data.endsAt !== undefined) data.endsAt = body.data.endsAt;
      if (body.data.quantity !== undefined) {
        if (body.data.quantity < fs.soldCount) return res.status(400).json({ message: `Số suất không được nhỏ hơn số đã bán (${fs.soldCount}).` });
        data.quantity = body.data.quantity;
      }
      const updated = await prisma.flashSale.update({ where: { id: fs.id }, data });
      return res.json({ flashSale: updated, note: 'Flash Sale đang diễn ra: chỉ cập nhật suất và hạn.' });
    }

    const merged = { ...fs, ...body.data } as z.infer<typeof flashSchema>;
    const err = await validateFlashInput(req, merged);
    if (err) return res.status(400).json({ message: err });
    const updated = await prisma.flashSale.update({ where: { id: fs.id }, data: { ...body.data } as any });
    res.json({ flashSale: updated });
  } catch (err) { next(err); }
}

// POST /api/promotions/flash-sales/:id/activate
export async function activateFlashSale(req: Request, res: Response, next: NextFunction) {
  try {
    const fs = await findOwnFlash(req, Number(req.params.id));
    if (!fs) return res.status(404).json({ message: 'Không tìm thấy Flash Sale.' });
    if (fs.status !== 'DRAFT' && fs.status !== 'SCHEDULED') return res.status(400).json({ message: 'Chỉ kích hoạt được Flash Sale ở trạng thái Nháp/Đã lên lịch.' });
    const status = lifecycleOnActivate(fs.startsAt, fs.endsAt);
    if (status === 'ENDED') return res.status(400).json({ message: 'Thời gian đã qua, không thể kích hoạt.' });
    const updated = await prisma.flashSale.update({ where: { id: fs.id }, data: { status } });
    res.json({ flashSale: updated });
  } catch (err) { next(err); }
}

// POST /api/promotions/flash-sales/:id/stop
export async function stopFlashSale(req: Request, res: Response, next: NextFunction) {
  try {
    const fs = await findOwnFlash(req, Number(req.params.id));
    if (!fs) return res.status(404).json({ message: 'Không tìm thấy Flash Sale.' });
    const updated = await prisma.flashSale.update({ where: { id: fs.id }, data: { status: 'STOPPED' } });
    res.json({ flashSale: updated });
  } catch (err) { next(err); }
}

// DELETE /api/promotions/flash-sales/:id - chỉ xóa bản Nháp
export async function deleteFlashSale(req: Request, res: Response, next: NextFunction) {
  try {
    const fs = await findOwnFlash(req, Number(req.params.id));
    if (!fs) return res.status(404).json({ message: 'Không tìm thấy Flash Sale.' });
    if (fs.status !== 'DRAFT') return res.status(400).json({ message: 'Chỉ xóa được Flash Sale ở trạng thái Nháp.' });
    await prisma.flashSale.delete({ where: { id: fs.id } });
    res.json({ deleted: true });
  } catch (err) { next(err); }
}

// GET /api/promotions/flash-sales/active - CÔNG KHAI: Flash Sale đang diễn ra cho trang chủ
export async function listActiveFlashSales(_req: Request, res: Response, next: NextFunction) {
  try {
    const now = new Date();
    const rows = await prisma.flashSale.findMany({
      where: { status: 'RUNNING', startsAt: { lte: now }, endsAt: { gte: now } },
      orderBy: { endsAt: 'asc' },
      include: {
        product: {
          select: {
            id: true, name: true, price: true, status: true, deletedAt: true,
            images: { where: { isPrimary: true }, take: 1 },
            category: { select: { id: true, name: true } },
          },
        },
      },
    });
    const items = rows
      .filter((s) => s.soldCount < s.quantity && s.product.status === 'ACTIVE' && !s.product.deletedAt)
      .map((s) => ({
        id: s.id, productId: s.productId, salePrice: s.salePrice, originalPrice: s.product.price,
        remaining: Math.max(0, s.quantity - s.soldCount), quantity: s.quantity, soldCount: s.soldCount,
        endsAt: s.endsAt,
        product: { id: s.product.id, name: s.product.name, image: s.product.images[0]?.url ?? null, category: s.product.category },
      }));
    res.json({ items });
  } catch (err) { next(err); }
}
