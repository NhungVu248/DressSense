import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import type { JwtPayload } from '../utils/jwt';
import { invalidateSettingsCache } from '../services/settings.service';

// Các khóa cấu hình công khai (an toàn để lộ cho frontend khách/người bán).
const PUBLIC_KEYS = ['siteName', 'supportEmail', 'vatEnabled', 'vatRate', 'freeShipThreshold'];

// GET /api/settings/public - cấu hình công khai (không cần quyền admin)
export async function getPublicSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.systemSetting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
    const out: Record<string, string | number | boolean> = {};
    for (const r of rows) {
      out[r.key] = r.type === 'number' ? Number(r.value) : r.type === 'boolean' ? r.value === 'true' : r.value;
    }
    res.json({ settings: out });
  } catch (err) { next(err); }
}

// ============================================================
//  UC16.5 - Cấu hình hệ thống (chỉ Quản trị viên).
// ============================================================

// GET /api/admin/settings
export async function listSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.systemSetting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
    res.json({ settings });
  } catch (err) { next(err); }
}

// PUT /api/admin/settings  { updates: [{ key, value }] }
export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const actorId = (req.user as JwtPayload).userId;
    const updates = req.body?.updates;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ message: 'Không có thay đổi nào.' });
    }
    const changed: string[] = [];
    for (const u of updates) {
      const cur = await prisma.systemSetting.findUnique({ where: { key: String(u.key) } });
      if (!cur) continue;
      const val = String(u.value);
      // 6E - kiểm tra giá trị hợp lệ theo kiểu
      if (cur.type === 'number' && (val.trim() === '' || isNaN(Number(val)))) {
        return res.status(400).json({ message: `Giá trị "${cur.label}" phải là số.` });
      }
      if (cur.type === 'boolean' && !['true', 'false'].includes(val)) {
        return res.status(400).json({ message: `Giá trị "${cur.label}" phải là true/false.` });
      }
      if (val === cur.value) continue; // không đổi -> bỏ qua
      await prisma.$transaction([
        prisma.systemSetting.update({ where: { key: cur.key }, data: { value: val, updatedById: actorId } }),
        prisma.settingChangeLog.create({ data: { key: cur.key, valueBefore: cur.value, valueAfter: val, actorId } }), // lưu lịch sử
      ]);
      changed.push(cur.key);
    }
    if (changed.length) invalidateSettingsCache(); // đảm bảo thuế/giá đọc giá trị mới
    res.json({ updated: changed });
  } catch (err) { next(err); }
}

// GET /api/admin/settings/history
export async function getSettingHistory(_req: Request, res: Response, next: NextFunction) {
  try {
    const logs = await prisma.settingChangeLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ logs });
  } catch (err) { next(err); }
}
