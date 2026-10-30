import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { notify } from '../services/notification.service';
import { isDev } from '../config/env';

// Sinh mật khẩu ngẫu nhiên đạt chính sách (hoa/thường/số/ký tự đặc biệt)
function generateStrongPassword(len = 12): string {
  const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', L = 'abcdefghijkmnpqrstuvwxyz', D = '23456789', S = '!@#$%^&*';
  const all = U + L + D + S;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pw = pick(U) + pick(L) + pick(D) + pick(S);
  for (let i = pw.length; i < len; i++) pw += pick(all);
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

function publicUser(u: any) {
  return {
    id: u.id, email: u.email, phone: u.phone, fullName: u.fullName,
    role: u.role, status: u.status, avatarUrl: u.avatarUrl, shopName: u.shopName,
    provider: u.provider, createdAt: u.createdAt,
  };
}

// ============================================================
//  UC1.7 - PHÂN QUYỀN NGƯỜI DÙNG (chỉ Quản trị viên)
// ============================================================

const listQuery = z.object({
  search: z.string().optional(),
  role: z.enum(['CUSTOMER', 'SELLER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'PENDING_APPROVAL', 'LOCKED', 'DISABLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// GET /api/admin/users - bước 3, luồng thay thế 4a (tìm kiếm/lọc)
export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const q = listQuery.parse(req.query);
    const where: any = {};
    if (q.role) where.role = q.role;
    if (q.status) where.status = q.status;
    if (q.search) {
      where.OR = [
        { fullName: { contains: q.search } },
        { email: { contains: q.search } },
        { phone: { contains: q.search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      items: items.map(publicUser),
      total, page: q.page, totalPages: Math.max(1, Math.ceil(total / q.limit)),
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/users/:id - bước 5 (thông tin tài khoản trước khi gán vai trò)
export async function getUserDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    // 4E: không tìm thấy tài khoản
    if (!user) return res.status(404).json({ message: 'Tài khoản không tồn tại' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

const updateRoleSchema = z.object({
  role: z.enum(['CUSTOMER', 'SELLER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'PENDING_APPROVAL', 'LOCKED', 'DISABLED']).optional(),
  note: z.string().optional(),
}).refine((d) => d.role !== undefined || d.status !== undefined, {
  message: 'Cần chỉ định vai trò hoặc trạng thái cần thay đổi',
});

// PATCH /api/admin/users/:id - bước 6-9: gán vai trò / phê duyệt / thu hồi quyền
export async function updateUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const targetId = Number(req.params.id);
    const data = updateRoleSchema.parse(req.body);
    const actorId = req.user!.userId;

    const target = await prisma.user.findUnique({ where: { id: targetId } });
    if (!target) return res.status(404).json({ message: 'Tài khoản không tồn tại' }); // 4E

    const newRole = data.role ?? target.role;
    const newStatus = data.status ?? target.status;

    // 6E.1 - không cho Quản trị viên tự khóa/vô hiệu hóa tài khoản đang đăng nhập
    if (targetId === actorId && (newStatus === 'LOCKED' || newStatus === 'DISABLED')) {
      return res.status(400).json({ message: 'Không thể tự khóa/vô hiệu hóa tài khoản đang đăng nhập của chính bạn.' });
    }
    // Khóa tài khoản phải có lý do (quy tắc nghiệp vụ UC16.2)
    if ((newStatus === 'LOCKED' || newStatus === 'DISABLED') && target.status !== newStatus && !data.note?.trim()) {
      return res.status(400).json({ message: 'Vui lòng nhập lý do khóa/vô hiệu hóa tài khoản.' });
    }

    // 7E: ràng buộc số lượng Quản trị viên tối thiểu
    const targetIsCurrentlyActiveAdmin = target.role === 'ADMIN' && target.status === 'ACTIVE';
    const willStillBeActiveAdmin = newRole === 'ADMIN' && newStatus === 'ACTIVE';
    if (targetIsCurrentlyActiveAdmin && !willStillBeActiveAdmin) {
      const activeAdminCount = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
      if (activeAdminCount <= 1) {
        return res.status(400).json({
          message: 'Hệ thống phải luôn duy trì tối thiểu một Quản trị viên đang hoạt động. Không thể thực hiện thao tác này.',
        });
      }
    }
    // 7E: chặn tự hạ quyền chính mình dẫn tới mất quyền kiểm soát (khi đang là admin cuối)
    if (targetId === actorId && target.role === 'ADMIN' && newRole !== 'ADMIN') {
      const activeAdminCount = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
      if (activeAdminCount <= 1) {
        return res.status(400).json({ message: 'Bạn không thể tự hạ quyền của chính mình khi đang là Quản trị viên duy nhất.' });
      }
    }

    const [, , log] = await prisma.$transaction([
      prisma.user.update({ where: { id: targetId }, data: { role: newRole, status: newStatus } }),
      // reset bộ đếm đăng nhập sai nếu mở khóa tài khoản
      prisma.user.updateMany({
        where: { id: targetId, status: 'ACTIVE' },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      }),
      prisma.roleChangeLog.create({
        data: {
          actorId,
          targetUserId: targetId,
          roleBefore: target.role,
          roleAfter: newRole,
          statusBefore: target.status,
          statusAfter: newStatus,
          note: data.note ?? (target.status === 'PENDING_APPROVAL' && newStatus === 'ACTIVE'
            ? 'Phê duyệt hồ sơ Người bán (UC16.3)' // 8a
            : undefined),
        },
      }),
    ]);

    // Thông báo cho người dùng bị ảnh hưởng khi khóa/vô hiệu hóa (UC16.2)
    if (newStatus !== target.status && (newStatus === 'LOCKED' || newStatus === 'DISABLED')) {
      await notify(targetId, 'SHOP', 'Tài khoản bị hạn chế',
        `Tài khoản của bạn đã bị ${newStatus === 'LOCKED' ? 'tạm khóa' : 'vô hiệu hóa'}.${data.note ? ' Lý do: ' + data.note : ''}`);
    }

    const updated = await prisma.user.findUnique({ where: { id: targetId } });
    res.json({ message: 'Cập nhật phân quyền thành công', user: publicUser(updated), log });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/audit-logs - nhật ký phân quyền (phục vụ truy vết/kiểm toán)
export async function listAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Math.min(100, Number(req.query.limit) || 30);
    const logs = await prisma.roleChangeLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: { select: { id: true, fullName: true, email: true, phone: true } },
        target: { select: { id: true, fullName: true, email: true, phone: true } },
      },
    });
    res.json({ logs });
  } catch (err) {
    next(err);
  }
}

// ---------- Admin cấp lại mật khẩu cho admin khác (quên mật khẩu) ----------

// GET /api/admin/password-resets - danh sách yêu cầu chờ cấp
export async function listAdminPasswordResets(_req: Request, res: Response, next: NextFunction) {
  try {
    const resets = await prisma.adminPasswordReset.findMany({ where: { status: 'PENDING' }, orderBy: { requestedAt: 'asc' } });
    const ids = resets.map((r) => r.userId);
    const users = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, email: true } }) : [];
    const umap = new Map(users.map((u) => [u.id, u]));
    res.json({ resets: resets.map((r) => ({ ...r, user: umap.get(r.userId) ?? null })) });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/password-resets/:id/resolve - sinh mật khẩu mới & cấp
export async function resolveAdminPasswordReset(req: Request, res: Response, next: NextFunction) {
  try {
    const actorId = req.user!.userId;
    const id = Number(req.params.id);
    const reset = await prisma.adminPasswordReset.findUnique({ where: { id } });
    if (!reset || reset.status !== 'PENDING') return res.status(404).json({ message: 'Yêu cầu không tồn tại hoặc đã được xử lý.' });
    if (reset.userId === actorId) return res.status(400).json({ message: 'Không thể tự cấp mật khẩu cho chính mình. Cần một Quản trị viên khác thực hiện.' });

    const target = await prisma.user.findUnique({ where: { id: reset.userId } });
    if (!target) return res.status(404).json({ message: 'Tài khoản quản trị không tồn tại.' });

    const newPassword = generateStrongPassword();
    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.$transaction([
      // đặt mật khẩu tạm; buộc đổi + yêu cầu OTP đăng nhập (firstLoginAt=null)
      prisma.user.update({
        where: { id: target.id },
        data: { password: hash, mustChangePassword: true, firstLoginAt: null, failedLoginAttempts: 0, lockedUntil: null, passwordChangedAt: new Date() },
      }),
      prisma.adminPasswordReset.update({ where: { id }, data: { status: 'RESOLVED', resolvedById: actorId, resolvedAt: new Date() } }),
    ]);
    await notify(target.id, 'SHOP', 'Mật khẩu quản trị được cấp lại',
      'Một Quản trị viên đã cấp mật khẩu mới. Kiểm tra email, đăng nhập (kèm OTP) rồi đổi mật khẩu ngay.', '/change-password');

    // Thực tế: gửi mật khẩu qua email đã đăng ký. Dev: trả về để chuyển cho admin yêu cầu.
    res.json({
      message: 'Đã cấp mật khẩu mới. Hệ thống gửi qua email; bạn cũng có thể chuyển trực tiếp cho admin yêu cầu.',
      ...(isDev ? { password: newPassword, email: target.email } : {}),
    });
  } catch (err) {
    next(err);
  }
}
