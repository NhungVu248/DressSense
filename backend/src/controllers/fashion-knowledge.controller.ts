import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC4.2 - QUẢN LÝ TRI THỨC THỜI TRANG (chỉ Quản trị viên)
//  (a) Danh mục thuộc tính chuẩn (FashionAttribute)
//  (b) Luật hợp dáng (ShapeFitRule)
//  Mọi thay đổi ghi KnowledgeAudit (phiên bản/nhật ký). Không xóa cứng mục đang
//  tham chiếu (ưu tiên vô hiệu hóa - 4c/6F). Luật không được trùng/mâu thuẫn (6E).
// ============================================================

const ATTR_TYPES = ['GARMENT', 'COLOR', 'MATERIAL', 'FIT', 'NECKLINE', 'SLEEVE', 'LENGTH', 'STYLE', 'OCCASION', 'PATTERN', 'BODY_SHAPE'] as const;

// Loại thuộc tính -> cột tương ứng trên Product (để đếm tham chiếu/ảnh hưởng)
const TYPE_TO_COLUMN: Record<string, string | null> = {
  FIT: 'fit', NECKLINE: 'neckline', SLEEVE: 'sleeve', LENGTH: 'length',
  COLOR: 'color', STYLE: 'style', GARMENT: 'garmentType', MATERIAL: 'material',
  OCCASION: 'occasion', PATTERN: 'pattern', BODY_SHAPE: null,
};

async function audit(entity: 'ATTRIBUTE' | 'FIT_RULE' | 'PAIRING_RULE', entityId: number | null,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'DEACTIVATE' | 'IMPORT', actorId: number | undefined,
  before: unknown, after: unknown, note?: string) {
  await prisma.knowledgeAudit.create({
    data: { entity, entityId, action, actorId: actorId ?? null, before: before as any, after: after as any, note: note ?? null },
  });
}

// Đếm sản phẩm đang tham chiếu 1 giá trị thuộc tính (cột đúng loại; khớp code hoặc alias)
async function countProductRefs(type: string, code: string, aliases: string[]): Promise<number> {
  const col = TYPE_TO_COLUMN[type];
  if (!col) return 0;
  const values = [code, ...aliases];
  return prisma.product.count({ where: { OR: values.map((v) => ({ [col]: v })) } as any });
}

// ---------------- (a) FashionAttribute ----------------

export async function listAttributes(req: Request, res: Response, next: NextFunction) {
  try {
    const q = z.object({
      type: z.enum(ATTR_TYPES).optional(),
      active: z.enum(['true', 'false']).optional(),
    }).parse(req.query);
    const where: any = {};
    if (q.type) where.type = q.type;
    if (q.active) where.active = q.active === 'true';
    const items = await prisma.fashionAttribute.findMany({ where, orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }] });
    res.json({ items, total: items.length });
  } catch (err) { next(err); }
}

const attrCreateSchema = z.object({
  type: z.enum(ATTR_TYPES),
  code: z.string().min(1).max(100),
  label: z.string().min(1).max(191),
  aliases: z.array(z.string()).optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export async function createAttribute(req: Request, res: Response, next: NextFunction) {
  try {
    const d = attrCreateSchema.parse(req.body);
    const dup = await prisma.fashionAttribute.findUnique({ where: { type_code: { type: d.type, code: d.code } } });
    if (dup) return res.status(409).json({ message: `Thuộc tính ${d.type}/${d.code} đã tồn tại.` }); // 6E
    const created = await prisma.fashionAttribute.create({
      data: { type: d.type, code: d.code, label: d.label, aliases: d.aliases ?? undefined, sortOrder: d.sortOrder ?? 0 },
    });
    await audit('ATTRIBUTE', created.id, 'CREATE', req.user?.userId, null, created);
    res.status(201).json({ attribute: created });
  } catch (err) { next(err); }
}

const attrUpdateSchema = z.object({
  label: z.string().min(1).max(191).optional(),
  aliases: z.array(z.string()).optional(),
  sortOrder: z.coerce.number().int().optional(),
  active: z.boolean().optional(),
});

export async function updateAttribute(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const d = attrUpdateSchema.parse(req.body);
    const before = await prisma.fashionAttribute.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ message: 'Không tìm thấy thuộc tính.' });
    const updated = await prisma.fashionAttribute.update({
      where: { id },
      data: { label: d.label, aliases: d.aliases ?? undefined, sortOrder: d.sortOrder, active: d.active },
    });
    const action = d.active === false && before.active ? 'DEACTIVATE' : 'UPDATE';
    await audit('ATTRIBUTE', id, action, req.user?.userId, before, updated);
    res.json({ attribute: updated });
  } catch (err) { next(err); }
}

// Xóa: mặc định VÔ HIỆU HÓA (soft). Chỉ xóa cứng khi ?hard=true và không còn tham chiếu (4c/6F).
export async function deleteAttribute(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const hard = req.query.hard === 'true';
    const attr = await prisma.fashionAttribute.findUnique({ where: { id } });
    if (!attr) return res.status(404).json({ message: 'Không tìm thấy thuộc tính.' });
    const refs = await countProductRefs(attr.type, attr.code, (attr.aliases as string[] | null) ?? []);
    if (!hard) {
      const updated = await prisma.fashionAttribute.update({ where: { id }, data: { active: false } });
      await audit('ATTRIBUTE', id, 'DEACTIVATE', req.user?.userId, attr, updated, `vô hiệu hóa (còn ${refs} SP tham chiếu)`);
      return res.json({ attribute: updated, deactivated: true, referencedProducts: refs });
    }
    if (refs > 0) {
      return res.status(409).json({ // 6F - chặn xóa cứng khi đang tham chiếu
        message: `Không thể xóa cứng: còn ${refs} sản phẩm tham chiếu. Hãy vô hiệu hóa hoặc ánh xạ sang mục thay thế.`,
        referencedProducts: refs,
      });
    }
    await prisma.fashionAttribute.delete({ where: { id } });
    await audit('ATTRIBUTE', id, 'DELETE', req.user?.userId, attr, null);
    res.json({ deleted: true });
  } catch (err) { next(err); }
}

// ---------------- (b) ShapeFitRule ----------------

const BODY_SHAPES = ['HOURGLASS', 'RECTANGLE', 'PEAR', 'APPLE', 'INVERTED_TRIANGLE'] as const;
const RULE_ATTRS = ['fit', 'neckline', 'length', 'sleeve'] as const;

export async function listRules(req: Request, res: Response, next: NextFunction) {
  try {
    const q = z.object({
      bodyShape: z.enum(BODY_SHAPES).optional(),
      active: z.enum(['true', 'false']).optional(),
    }).parse(req.query);
    const where: any = {};
    if (q.bodyShape) where.bodyShape = q.bodyShape;
    if (q.active) where.active = q.active === 'true';
    const items = await prisma.shapeFitRule.findMany({ where, orderBy: [{ bodyShape: 'asc' }, { attr: 'asc' }] });
    res.json({ items, total: items.length });
  } catch (err) { next(err); }
}

const ruleSchema = z.object({
  bodyShape: z.enum(BODY_SHAPES),
  attr: z.enum(RULE_ATTRS),
  value: z.string().min(1).max(100),
  kind: z.enum(['PREFER', 'AVOID']),
  weight: z.coerce.number().min(0).max(1),
  reason: z.string().min(1).max(191),
});

// Số sản phẩm bị ảnh hưởng nếu luật này đổi (cùng cột attr = value) -> gợi ý phân tích lại (UC4.1)
async function affectedByRule(attr: string, value: string): Promise<number> {
  return prisma.product.count({ where: { [attr]: value } as any });
}

// Kiểm tra trùng / mâu thuẫn trong tập luật (6E)
async function ruleConflict(bodyShape: string, attr: string, value: string, kind: string, excludeId?: number) {
  const siblings = await prisma.shapeFitRule.findMany({
    where: { bodyShape: bodyShape as any, attr, value, active: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  const dup = siblings.find((s) => s.kind === kind);
  const conflict = siblings.find((s) => s.kind !== kind);
  return { dup, conflict };
}

export async function createRule(req: Request, res: Response, next: NextFunction) {
  try {
    const d = ruleSchema.parse(req.body);
    const { dup, conflict } = await ruleConflict(d.bodyShape, d.attr, d.value, d.kind);
    if (dup) return res.status(409).json({ message: 'Luật đã tồn tại (trùng dáng/thuộc tính/giá trị/loại).' });
    if (conflict) return res.status(409).json({ message: `Mâu thuẫn: đã có luật ${conflict.kind} cho ${d.bodyShape}/${d.attr}=${d.value}.` });
    const created = await prisma.shapeFitRule.create({ data: d });
    await audit('FIT_RULE', created.id, 'CREATE', req.user?.userId, null, created);
    const affected = await affectedByRule(d.attr, d.value);
    res.status(201).json({ rule: created, affectedProducts: affected });
  } catch (err) { next(err); }
}

export async function updateRule(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const d = ruleSchema.partial().extend({ active: z.boolean().optional() }).parse(req.body);
    const before = await prisma.shapeFitRule.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ message: 'Không tìm thấy luật.' });
    const merged = { bodyShape: d.bodyShape ?? before.bodyShape, attr: d.attr ?? before.attr, value: d.value ?? before.value, kind: d.kind ?? before.kind };
    const { conflict } = await ruleConflict(merged.bodyShape, merged.attr, merged.value, merged.kind, id);
    if (conflict) return res.status(409).json({ message: `Mâu thuẫn với luật ${conflict.kind} hiện có.` });
    const updated = await prisma.shapeFitRule.update({ where: { id }, data: d as any });
    const action = d.active === false && before.active ? 'DEACTIVATE' : 'UPDATE';
    await audit('FIT_RULE', id, action, req.user?.userId, before, updated);
    const affected = await affectedByRule(updated.attr, updated.value);
    res.json({ rule: updated, affectedProducts: affected });
  } catch (err) { next(err); }
}

export async function deleteRule(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const before = await prisma.shapeFitRule.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ message: 'Không tìm thấy luật.' });
    await prisma.shapeFitRule.delete({ where: { id } });
    await audit('FIT_RULE', id, 'DELETE', req.user?.userId, before, null);
    res.json({ deleted: true, affectedProducts: await affectedByRule(before.attr, before.value) });
  } catch (err) { next(err); }
}

// ---------------- (b2) OutfitRule - luật phối đồ ----------------

const outfitSchema = z.object({
  kind: z.enum(['COLOR', 'STYLE', 'OCCASION', 'BODYSHAPE']),
  subjectA: z.string().min(1).max(100),
  subjectB: z.string().min(1).max(100).optional(),
  score: z.coerce.number().min(-1).max(1),
  reason: z.string().min(1).max(191),
});

export async function listOutfitRules(req: Request, res: Response, next: NextFunction) {
  try {
    const q = z.object({ kind: z.enum(['COLOR', 'STYLE', 'OCCASION', 'BODYSHAPE']).optional(), active: z.enum(['true', 'false']).optional() }).parse(req.query);
    const where: any = {};
    if (q.kind) where.kind = q.kind;
    if (q.active) where.active = q.active === 'true';
    const items = await prisma.outfitRule.findMany({ where, orderBy: [{ kind: 'asc' }, { subjectA: 'asc' }] });
    res.json({ items, total: items.length });
  } catch (err) { next(err); }
}

// Dò luật phối cùng cặp (2 chiều) để chặn trùng/mâu thuẫn (6E)
async function outfitSiblings(kind: string, a: string, b: string | undefined, excludeId?: number) {
  const items = await prisma.outfitRule.findMany({ where: { kind: kind as any, active: true, ...(excludeId ? { id: { not: excludeId } } : {}) } });
  return items.filter((r) => (r.subjectA === a && r.subjectB === (b ?? null)) || (b !== undefined && r.subjectA === b && r.subjectB === a));
}

export async function createOutfitRule(req: Request, res: Response, next: NextFunction) {
  try {
    const d = outfitSchema.parse(req.body);
    const sib = await outfitSiblings(d.kind, d.subjectA, d.subjectB);
    if (sib.some((s) => Math.sign(s.score) === Math.sign(d.score))) return res.status(409).json({ message: 'Luật phối đã tồn tại cho cặp này.' });
    if (sib.some((s) => Math.sign(s.score) !== Math.sign(d.score))) return res.status(409).json({ message: 'Mâu thuẫn: đã có luật phối trái dấu cho cặp này.' });
    const created = await prisma.outfitRule.create({ data: { kind: d.kind, subjectA: d.subjectA, subjectB: d.subjectB ?? null, score: d.score, reason: d.reason } });
    await audit('PAIRING_RULE', created.id, 'CREATE', req.user?.userId, null, created);
    res.status(201).json({ rule: created });
  } catch (err) { next(err); }
}

export async function updateOutfitRule(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const d = outfitSchema.partial().extend({ active: z.boolean().optional() }).parse(req.body);
    const before = await prisma.outfitRule.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ message: 'Không tìm thấy luật phối.' });
    const updated = await prisma.outfitRule.update({ where: { id }, data: d as any });
    const action = d.active === false && before.active ? 'DEACTIVATE' : 'UPDATE';
    await audit('PAIRING_RULE', id, action, req.user?.userId, before, updated);
    res.json({ rule: updated });
  } catch (err) { next(err); }
}

export async function deleteOutfitRule(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const before = await prisma.outfitRule.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ message: 'Không tìm thấy luật phối.' });
    await prisma.outfitRule.delete({ where: { id } });
    await audit('PAIRING_RULE', id, 'DELETE', req.user?.userId, before, null);
    res.json({ deleted: true });
  } catch (err) { next(err); }
}

// ---------------- Nhật ký ----------------

export async function listAudit(req: Request, res: Response, next: NextFunction) {
  try {
    const q = z.object({
      entity: z.enum(['ATTRIBUTE', 'FIT_RULE', 'PAIRING_RULE']).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }).parse(req.query);
    const items = await prisma.knowledgeAudit.findMany({
      where: q.entity ? { entity: q.entity } : {},
      orderBy: { createdAt: 'desc' }, take: q.limit,
    });
    res.json({ items, total: items.length });
  } catch (err) { next(err); }
}
