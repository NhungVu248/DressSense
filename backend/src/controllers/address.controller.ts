import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

const addressSchema = z.object({
  recipientName: z.string().min(1, 'Vui lòng nhập tên người nhận'),
  phone: z.string().min(1, 'Vui lòng nhập số điện thoại'),
  province: z.string().min(1, 'Vui lòng chọn tỉnh/thành'),
  district: z.string().min(1, 'Vui lòng chọn quận/huyện'),
  ward: z.string().min(1, 'Vui lòng chọn phường/xã'),
  detail: z.string().min(1, 'Vui lòng nhập địa chỉ chi tiết'),
});

const MAX_ADDRESSES = 20; // 4dE: giới hạn số lượng địa chỉ

// GET /api/addresses - UC1.6 bước 1-3
export async function listAddresses(req: Request, res: Response, next: NextFunction) {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user!.userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ addresses });
  } catch (err) {
    next(err);
  }
}

// POST /api/addresses - bước 4-9 (thêm địa chỉ mới)
export async function createAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const data = addressSchema.parse(req.body);
    const userId = req.user!.userId;

    const count = await prisma.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) {
      // 4dE: vượt giới hạn tối đa
      return res.status(400).json({ message: `Bạn chỉ có thể lưu tối đa ${MAX_ADDRESSES} địa chỉ` });
    }

    // 8a: địa chỉ đầu tiên tự động làm mặc định
    const isFirst = count === 0;

    const address = await prisma.address.create({
      data: { ...data, userId, isDefault: isFirst },
    });
    res.status(201).json({ message: 'Thêm địa chỉ thành công', address });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/addresses/:id - luồng thay thế 4a: chỉnh sửa địa chỉ
export async function updateAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const data = addressSchema.partial().parse(req.body);

    const existing = await prisma.address.findFirst({ where: { id, userId: req.user!.userId } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });

    const address = await prisma.address.update({ where: { id }, data });
    res.json({ message: 'Cập nhật địa chỉ thành công', address });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/addresses/:id - luồng thay thế 4b: xóa địa chỉ
export async function deleteAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.userId;

    const existing = await prisma.address.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });

    await prisma.address.delete({ where: { id } });

    // 4bE: nếu xóa địa chỉ đang mặc định -> tự động gán địa chỉ khác (mới nhất) làm mặc định
    if (existing.isDefault) {
      const next = await prisma.address.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (next) {
        await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ message: 'Xóa địa chỉ thành công', addresses });
  } catch (err) {
    next(err);
  }
}

// POST /api/addresses/:id/default - luồng thay thế 4c: đặt làm mặc định
export async function setDefaultAddress(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.userId;

    const existing = await prisma.address.findFirst({ where: { id, userId } });
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy địa chỉ' });

    // Mỗi tài khoản chỉ có duy nhất 1 địa chỉ mặc định tại một thời điểm
    await prisma.$transaction([
      prisma.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
      prisma.address.update({ where: { id }, data: { isDefault: true } }),
    ]);

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ message: 'Đặt địa chỉ mặc định thành công', addresses });
  } catch (err) {
    next(err);
  }
}
