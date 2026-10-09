import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';

// ============================================================
//  UC6.2 - QUẢN LÝ DANH MỤC (chỉ Quản trị viên)
//  Cây đa cấp cha-con; tên duy nhất trong cùng cấp cha; không vòng lặp; giới hạn độ sâu.
//  Không xóa cứng danh mục đang có SP/con/tham chiếu -> đề nghị ẩn hoặc di chuyển (4c/6F).
// ============================================================

const MAX_DEPTH = 3; // gốc = 1

function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'muc';
}

async function audit(entityId: number | null, action: 'CREATE' | 'UPDATE' | 'DELETE' | 'DEACTIVATE',
  actorId: number | undefined, before: unknown, after: unknown, note?: string) {
  await prisma.knowledgeAudit.create({
    data: { entity: 'CATEGORY', entityId, action, actorId: actorId ?? null, before: before as any, after: after as any, note: note ?? null },
  });
}

// Độ sâu tính từ gốc (gốc = 1)
async function depthOf(id: number | null): Promise<number> {
  let d = 0; let cur = id;
  while (cur != null && d < 20) {
    const c = await prisma.category.findUnique({ where: { id: cur }, select: { parentId: true } });
    if (!c) break; d++; cur = c.parentId;
  }
  return d;
}

// Chiều cao cây con (node = 1)
async function subtreeHeight(id: number): Promise<number> {
  const kids = await prisma.category.findMany({ where: { parentId: id }, select: { id: true } });
  if (!kids.length) return 1;
  let h = 0;
  for (const k of kids) h = Math.max(h, await subtreeHeight(k.id));
  return h + 1;
}

// newParent có phải chính node hoặc hậu duệ của node không (chống vòng lặp)
async function isDescendantOrSelf(nodeId: number, candidateParentId: number): Promise<boolean> {
  let cur: number | null = candidateParentId;
  while (cur != null) {
    if (cur === nodeId) return true;
    const c: { parentId: number | null } | null = await prisma.category.findUnique({ where: { id: cur }, select: { parentId: true } });
    cur = c?.parentId ?? null;
  }
  return false;
}

export async function listCategories(_req: Request, res: Response, next: NextFunction) {
  try {
    const cats = await prisma.category.findMany({
      orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true, children: true, budgets: true, sizes: true } } },
    });
    res.json({
      items: cats.map((c) => ({
        id: c.id, name: c.name, slug: c.slug, parentId: c.parentId, active: c.active, sortOrder: c.sortOrder,
        productCount: c._count.products, childCount: c._count.children,
        referenced: c._count.products + c._count.children + c._count.budgets + c._count.sizes,
      })),
      total: cats.length,
    });
  } catch (err) { next(err); }
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(60).optional(),
  parentId: z.coerce.number().int().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export async function createCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const d = createSchema.parse(req.body);
    if (d.parentId != null) {
      const parent = await prisma.category.findUnique({ where: { id: d.parentId } });
      if (!parent) return res.status(400).json({ message: 'Danh mục cha không tồn tại.' });
      if ((await depthOf(d.parentId)) + 1 > MAX_DEPTH) return res.status(409).json({ message: `Vượt quá độ sâu phân cấp cho phép (${MAX_DEPTH}).` }); // 6E
    }
    const dup = await prisma.category.findFirst({ where: { parentId: d.parentId ?? null, name: d.name } });
    if (dup) return res.status(409).json({ message: 'Tên danh mục đã tồn tại trong cùng cấp cha.' }); // 6E
    let slug = d.slug ? slugify(d.slug) : slugify(d.name);
    if (await prisma.category.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString().slice(-4)}`;
    const created = await prisma.category.create({ data: { name: d.name, slug, parentId: d.parentId ?? null, sortOrder: d.sortOrder ?? 0 } });
    await audit(created.id, 'CREATE', req.user?.userId, null, created);
    res.status(201).json({ category: created });
  } catch (err) { next(err); }
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(60).optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  parentId: z.coerce.number().int().nullable().optional(), // null = đưa về gốc
});

export async function updateCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const d = updateSchema.parse(req.body);
    const before = await prisma.category.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ message: 'Không tìm thấy danh mục.' });

    const newParent = d.parentId !== undefined ? d.parentId : before.parentId;
    if (d.parentId !== undefined && d.parentId !== before.parentId) {
      if (d.parentId != null) {
        if (await isDescendantOrSelf(id, d.parentId)) return res.status(409).json({ message: 'Di chuyển tạo quan hệ vòng lặp cha-con.' }); // 6E
        const resultDepth = (await depthOf(d.parentId)) + (await subtreeHeight(id));
        if (resultDepth > MAX_DEPTH) return res.status(409).json({ message: `Vượt quá độ sâu phân cấp cho phép (${MAX_DEPTH}).` }); // 6E
      }
    }
    if (d.name && (d.name !== before.name || newParent !== before.parentId)) {
      const dup = await prisma.category.findFirst({ where: { parentId: newParent ?? null, name: d.name, id: { not: id } } });
      if (dup) return res.status(409).json({ message: 'Tên danh mục đã tồn tại trong cùng cấp cha.' });
    }
    const data: any = {};
    if (d.name !== undefined) data.name = d.name;
    if (d.slug !== undefined) data.slug = slugify(d.slug);
    if (d.active !== undefined) data.active = d.active;
    if (d.sortOrder !== undefined) data.sortOrder = d.sortOrder;
    if (d.parentId !== undefined) data.parentId = d.parentId;
    const updated = await prisma.category.update({ where: { id }, data });
    await audit(id, d.active === false && before.active ? 'DEACTIVATE' : 'UPDATE', req.user?.userId, before, updated);
    res.json({ category: updated });
  } catch (err) { next(err); }
}

export async function deleteCategory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const cat = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true, budgets: true, sizes: true } } },
    });
    if (!cat) return res.status(404).json({ message: 'Không tìm thấy danh mục.' });
    const c = cat._count;
    if (c.products || c.children || c.budgets || c.sizes) {
      // 6F - chặn xóa cứng khi đang tham chiếu; đề nghị ẩn hoặc di chuyển
      return res.status(409).json({
        message: 'Không thể xóa cứng: danh mục đang có sản phẩm/danh mục con hoặc được tham chiếu. Hãy ẩn (active=false) hoặc di chuyển sản phẩm sang danh mục khác.',
        counts: { products: c.products, children: c.children, budgets: c.budgets, sizes: c.sizes },
      });
    }
    await prisma.category.delete({ where: { id } });
    await audit(id, 'DELETE', req.user?.userId, cat, null);
    res.json({ deleted: true });
  } catch (err) { next(err); }
}
