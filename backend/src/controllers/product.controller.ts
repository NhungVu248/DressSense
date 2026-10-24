import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { analyzeProduct, analyzeMany } from '../services/product-analysis.service';

// UC4.1 - chỉ Người bán (SP của mình) hoặc Quản trị viên mới được phân tích/xác nhận nhãn
async function assertCanEdit(req: Request, productId: number): Promise<{ ok: true } | { ok: false; code: number; message: string }> {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { sellerId: true } });
  if (!p) return { ok: false, code: 404, message: 'Không tìm thấy sản phẩm' };
  if (req.user?.role !== 'ADMIN' && p.sellerId !== req.user?.userId) return { ok: false, code: 403, message: 'Không có quyền với sản phẩm này' };
  return { ok: true };
}

// Tách chuỗi "S,M,L" -> ['S','M','L'] (bỏ khoảng trắng/rỗng) cho bộ lọc nhiều giá trị
function parseList(v: unknown): string[] {
  if (typeof v !== 'string') return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

// UC7.1/7.2/7.3 - truy vấn công khai: từ khóa + bộ lọc + sắp xếp
const publicQuery = z.object({
  q: z.string().trim().optional(),                 // UC7.1 - từ khóa
  categoryId: z.coerce.number().int().optional(),  // UC7.2 - danh mục
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  size: z.string().optional(),   // UC7.2 - size (phân tách bằng dấu phẩy)
  color: z.string().optional(),  // UC7.2 - màu sắc
  style: z.string().optional(),  // UC7.2 - phong cách
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'bestselling']).default('newest'), // UC7.3
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

// Điều kiện chung: chỉ sản phẩm ĐANG BÁN (ACTIVE) & chưa xóa được hiển thị cho khách (UC7 quy tắc nghiệp vụ)
function publicWhere(q: z.infer<typeof publicQuery>): any {
  const where: any = { status: 'ACTIVE', deletedAt: null };
  if (q.q) {
    where.OR = [
      { name: { contains: q.q } },
      { description: { contains: q.q } },
      { brand: { contains: q.q } },
      { style: { contains: q.q } },
      { garmentType: { contains: q.q } },
      { category: { is: { name: { contains: q.q } } } },
    ];
  }
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.minPrice != null || q.maxPrice != null) {
    where.price = { ...(q.minPrice != null ? { gte: q.minPrice } : {}), ...(q.maxPrice != null ? { lte: q.maxPrice } : {}) };
  }
  const sizes = parseList(q.size);
  const colors = parseList(q.color);
  const styles = parseList(q.style);
  if (sizes.length) where.variants = { some: { size: { in: sizes } } };
  if (colors.length) where.color = { in: colors };
  if (styles.length) where.style = { in: styles };
  return where;
}

// GET /api/products  (UC7.1 tìm kiếm + UC7.2 lọc + UC7.3 sắp xếp)
export async function listProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const q = publicQuery.parse(req.query);
    // 4E (UC7.2) - khoảng giá không hợp lệ: giá tối thiểu lớn hơn giá tối đa
    if (q.minPrice != null && q.maxPrice != null && q.minPrice > q.maxPrice) {
      return res.status(400).json({ message: 'Khoảng giá không hợp lệ: giá tối thiểu lớn hơn giá tối đa.', code: 'INVALID_PRICE_RANGE' });
    }
    const where = publicWhere(q);
    const orderBy =
      q.sort === 'price_asc' ? { price: 'asc' as const }
      : q.sort === 'price_desc' ? { price: 'desc' as const }
      : q.sort === 'bestselling' ? { orderItems: { _count: 'desc' as const } } // UC7.3 - bán chạy (số lượt mua)
      : { createdAt: 'desc' as const }; // newest (mặc định)

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where, orderBy,
        include: {
          images: true, category: { select: { id: true, name: true } },
          variants: { select: { size: true, stock: true } },
          reviews: { select: { rating: true } },
          _count: { select: { orderItems: true } },
        },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      prisma.product.count({ where }),
    ]);

    const items = rows.map((p) => {
      const ratingCount = p.reviews.length;
      const ratingAvg = ratingCount ? p.reviews.reduce((a, r) => a + r.rating, 0) / ratingCount : 0;
      const inStock = p.variants.some((v) => v.stock > 0);
      const { reviews, _count, ...rest } = p as any;
      return {
        ...rest,
        sizes: [...new Set(p.variants.map((v) => v.size))],
        ratingAvg: Math.round(ratingAvg * 10) / 10,
        ratingCount,
        soldCount: p._count.orderItems,
        inStock,
      };
    });

    res.json({ items, total, page: q.page, totalPages: Math.max(1, Math.ceil(total / q.limit)) });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/facets - dữ liệu cho khu vực bộ lọc (UC7.2): danh mục + số lượng, size/màu/phong cách, khoảng giá
export async function getPublicFacets(_req: Request, res: Response, next: NextFunction) {
  try {
    const base: any = { status: 'ACTIVE', deletedAt: null };
    const [byCat, cats, colorRows, styleRows, sizeRows, priceAgg] = await Promise.all([
      prisma.product.groupBy({ by: ['categoryId'], where: base, _count: { _all: true } }),
      prisma.category.findMany({ where: { active: true }, select: { id: true, name: true } }),
      prisma.product.findMany({ where: { ...base, color: { not: null } }, select: { color: true }, distinct: ['color'] }),
      prisma.product.findMany({ where: { ...base, style: { not: null } }, select: { style: true }, distinct: ['style'] }),
      prisma.productVariant.findMany({ where: { product: { is: base } }, select: { size: true }, distinct: ['size'] }),
      prisma.product.aggregate({ where: base, _min: { price: true }, _max: { price: true } }),
    ]);
    const catName = new Map(cats.map((c) => [c.id, c.name]));
    const categories = byCat
      .map((g) => ({ id: g.categoryId, name: catName.get(g.categoryId) ?? 'Khác', count: g._count._all }))
      .filter((c) => catName.has(c.id))
      .sort((a, b) => b.count - a.count);
    res.json({
      categories,
      colors: colorRows.map((r) => r.color).filter(Boolean),
      styles: styleRows.map((r) => r.style).filter(Boolean),
      sizes: sizeRows.map((r) => r.size).filter(Boolean),
      priceMin: priceAgg._min.price ?? 0,
      priceMax: priceAgg._max.price ?? 0,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/suggest?q= - gợi ý tự hoàn thành khi khách gõ từ khóa (UC7.1 luồng 3/3a)
export async function suggestProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (typeof req.query.q === 'string' ? req.query.q : '').trim();
    if (!q) return res.json({ items: [] });
    const rows = await prisma.product.findMany({
      where: { status: 'ACTIVE', deletedAt: null, name: { contains: q } },
      select: { id: true, name: true, price: true, images: { where: { isPrimary: true }, take: 1, select: { url: true } } },
      orderBy: { createdAt: 'desc' },
      take: 6,
    });
    res.json({ items: rows.map((r) => ({ id: r.id, name: r.name, price: r.price, image: r.images[0]?.url ?? null })) });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/:id/related - "Có thể bạn cũng thích" (UC7.4 luồng 9a): cùng danh mục, khác chính nó
export async function getRelatedProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const self = await prisma.product.findUnique({ where: { id }, select: { categoryId: true } });
    if (!self) return res.json({ items: [] });
    const rows = await prisma.product.findMany({
      where: { status: 'ACTIVE', deletedAt: null, categoryId: self.categoryId, id: { not: id } },
      include: {
        images: { where: { isPrimary: true }, take: 1 },
        category: { select: { id: true, name: true } },
        reviews: { select: { rating: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });
    const items = rows.map((p) => {
      const ratingCount = p.reviews.length;
      const ratingAvg = ratingCount ? p.reviews.reduce((a, r) => a + r.rating, 0) / ratingCount : 0;
      const { reviews, ...rest } = p as any;
      return { ...rest, ratingAvg: Math.round(ratingAvg * 10) / 10, ratingCount };
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/:id
export async function getProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true, variants: true, category: true, reviews: true,
        bodyFits: { orderBy: { score: 'desc' } }, // UC4 - điểm tương thích dáng (cao->thấp)
        analysis: true, // UC4.1 - nhãn thuộc tính đề xuất/đã xác nhận
      },
    });
    if (!product || product.deletedAt || product.status !== 'ACTIVE') return res.status(404).json({ message: 'Không tìm thấy sản phẩm' }); // UC6 - chỉ hiện SP đang bán
    res.json({ product });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/:id/manage - UC6.4 nạp chi tiết SP cho Người bán/Admin (mọi trạng thái)
export async function getManagedProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const guard = await assertCanEdit(req, id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.message });
    const product = await prisma.product.findUnique({
      where: { id },
      include: { images: true, variants: { orderBy: { size: 'asc' } }, category: true, analysis: true },
    });
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    res.json({ product });
  } catch (err) {
    next(err);
  }
}

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().positive(),
  categoryId: z.number().int(),
  color: z.string().optional(),
  pattern: z.string().optional(),
  material: z.string().optional(),
  fit: z.string().optional(),
  length: z.string().optional(),
  neckline: z.string().optional(),
  sleeve: z.string().optional(),
  style: z.string().optional(),
  season: z.string().optional(),
  // Trường bổ sung theo lược đồ DeepFashion2
  garmentType: z.string().optional(),
  targetGender: z.string().optional(),
  brand: z.string().optional(),
  occasion: z.string().optional(),
  tags: z.array(z.string()).optional(),
  // UC6.3 - trạng thái + biến thể (size + tồn kho ban đầu, không âm)
  status: z.enum(['DRAFT', 'PENDING', 'ACTIVE', 'HIDDEN']).optional(),
  variants: z.array(z.object({ size: z.string().min(1), stock: z.coerce.number().int().min(0) })).optional(),
});

// POST /api/products  (chỉ SELLER/ADMIN) - UC6.3 thêm sản phẩm (nguyên tử + tự phân tích UC4.1)
export async function createProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const { variants, status, ...fields } = createSchema.parse(req.body);
    // 7F - danh mục phải hợp lệ và đang hoạt động
    const cat = await prisma.category.findUnique({ where: { id: fields.categoryId } });
    if (!cat || !cat.active) return res.status(400).json({ message: 'Danh mục không hợp lệ hoặc đã bị ẩn. Vui lòng chọn lại.' });
    const st = status ?? 'ACTIVE';
    // 8E - nguyên tử: tạo trọn vẹn SP + biến thể (+tồn kho) hoặc không gì
    const product = await prisma.product.create({
      data: {
        ...fields, sellerId: req.user!.userId, status: st,
        variants: variants && variants.length ? { create: variants.map((v) => ({ size: v.size, stock: v.stock })) } : undefined,
      },
    });
    // UC4.1 - tự phân tích (trừ khi lưu nháp 6a). Lỗi không làm hỏng việc tạo SP.
    let analysis = null;
    if (st !== 'DRAFT') { try { analysis = await analyzeProduct(product.id); } catch { /* để phân tích lại sau */ } }
    res.status(201).json({ product, analysis });
  } catch (err) {
    next(err);
  }
}

const updateSchema = createSchema.partial();

// PATCH /api/products/:id - UC6.4 sửa sản phẩm (+ phân tích lại khi đổi nội dung)
export async function updateProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const guard = await assertCanEdit(req, id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.message });
    const { variants, ...d } = updateSchema.parse(req.body);
    const before = await prisma.product.findUnique({ where: { id } });
    if (!before) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    if (d.categoryId != null) {
      const cat = await prisma.category.findUnique({ where: { id: d.categoryId } });
      if (!cat || !cat.active) return res.status(400).json({ message: 'Danh mục không hợp lệ hoặc đã bị ẩn.' }); // 7F
    }
    const updated = await prisma.product.update({ where: { id }, data: d as any });
    // 3b - thêm/sửa biến thể (upsert theo size)
    if (variants) for (const v of variants) {
      await prisma.productVariant.upsert({
        where: { productId_size: { productId: id, size: v.size } },
        update: { stock: v.stock }, create: { productId: id, size: v.size, stock: v.stock },
      });
    }
    // 3c/7 - chỉ phân tích lại khi NỘI DUNG đổi (tên/mô tả/danh mục/thuộc tính), bỏ qua nếu chỉ giá/tồn kho/trạng thái
    const CONTENT = ['name', 'description', 'categoryId', 'color', 'material', 'style', 'garmentType', 'occasion', 'pattern', 'fit', 'neckline', 'sleeve', 'length'];
    const contentChanged = CONTENT.some((k) => (d as any)[k] !== undefined && (before as any)[k] !== (d as any)[k]);
    let analysis = null;
    if (contentChanged && updated.status !== 'DRAFT') { try { analysis = await analyzeProduct(id); } catch { /* để phân tích lại sau */ } }
    res.json({ product: updated, reanalyzed: contentChanged, analysis });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/manage - UC6.1 danh sách QUẢN LÝ theo vai trò (tìm/lọc/sắp xếp)
const manageQuery = z.object({
  search: z.string().optional(),
  categoryId: z.coerce.number().int().optional(),
  sellerId: z.coerce.number().int().optional(), // 2a - Admin lọc theo gian hàng
  status: z.enum(['DRAFT', 'PENDING', 'ACTIVE', 'HIDDEN', 'ARCHIVED']).optional(),
  lowStock: z.enum(['true', 'false']).optional(),
  unlabeled: z.enum(['true', 'false']).optional(), // 5a - lọc SP chưa gán nhãn/đang chờ
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'name']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function listManagedProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const q = manageQuery.parse(req.query);
    const where: any = { deletedAt: null };
    if (req.user?.role !== 'ADMIN') where.sellerId = req.user!.userId; // Người bán: chỉ SP của mình
    else if (q.sellerId) where.sellerId = q.sellerId;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.status) where.status = q.status; else where.status = { not: 'ARCHIVED' };
    if (q.search) where.OR = [{ name: { contains: q.search } }, { brand: { contains: q.search } }];
    const orderBy = q.sort === 'price_asc' ? { price: 'asc' as const } : q.sort === 'price_desc' ? { price: 'desc' as const }
      : q.sort === 'name' ? { name: 'asc' as const } : { createdAt: 'desc' as const };

    const rows = await prisma.product.findMany({
      where, orderBy,
      include: { category: { select: { name: true } }, images: { where: { isPrimary: true }, take: 1 }, variants: { select: { stock: true } }, analysis: { select: { status: true } } },
    });
    let mapped = rows.map((p) => {
      const stock = p.variants.reduce((a, v) => a + v.stock, 0);
      return {
        id: p.id, name: p.name, price: p.price, category: p.category.name,
        image: p.images[0]?.url ?? null, status: p.status, stock,
        outOfStock: stock === 0, analysisStatus: p.analysis?.status ?? null,
      };
    });
    if (q.lowStock === 'true') mapped = mapped.filter((m) => m.stock <= 5); // tồn kho thấp (ngưỡng mặc định)
    if (q.unlabeled === 'true') mapped = mapped.filter((m) => m.analysisStatus == null || m.analysisStatus === 'UNCONFIRMED'); // 5a
    const total = mapped.length;
    const items = mapped.slice((q.page - 1) * q.limit, q.page * q.limit);
    res.json({ items, total, page: q.page, totalPages: Math.max(1, Math.ceil(total / q.limit)) });
  } catch (err) {
    next(err);
  }
}

async function auditProduct(entityId: number, action: 'CREATE' | 'UPDATE' | 'DELETE', actorId: number | undefined, before: unknown, after: unknown, note?: string) {
  await prisma.knowledgeAudit.create({ data: { entity: 'PRODUCT', entityId, action, actorId: actorId ?? null, before: before as any, after: after as any, note: note ?? null } });
}

// DELETE /api/products/:id - UC6.5 xóa SP (mềm nếu có lịch sử đơn; cứng nếu không; chặn khi có đơn chưa xong)
const UNFINISHED_ORDER = ['PENDING', 'AWAITING_PAYMENT', 'PAID', 'SHIPPING'];
export async function deleteProduct(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const guard = await assertCanEdit(req, id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.message });
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product || product.deletedAt) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    // 2G - đang có đơn chưa hoàn tất -> chặn, đề nghị ngừng bán
    const unfinished = await prisma.orderItem.count({ where: { productId: id, order: { status: { in: UNFINISHED_ORDER as any } } } });
    if (unfinished > 0) return res.status(409).json({ message: 'Sản phẩm đang có đơn hàng chưa hoàn tất. Hãy chuyển sang "ngừng bán" (ẩn) thay vì xóa.', code: 'HAS_PENDING_ORDERS' });
    const history = await prisma.orderItem.count({ where: { productId: id } });
    if (history > 0) {
      // Có lịch sử đơn -> XÓA MỀM (lưu trữ) để bảo toàn dữ liệu đơn hàng (UC9/UC10)
      const u = await prisma.product.update({ where: { id }, data: { status: 'ARCHIVED', deletedAt: new Date() } });
      await auditProduct(id, 'DELETE', req.user?.userId, product, u, 'xóa mềm (có lịch sử đơn hàng)');
      return res.json({ archived: true, message: 'Đã lưu trữ sản phẩm (xóa mềm) để bảo toàn dữ liệu đơn hàng.' });
    }
    // Không có đơn -> XÓA CỨNG (cascade biến thể/nhãn/điểm dáng/ảnh/giỏ hàng)
    await prisma.product.delete({ where: { id } });
    await auditProduct(id, 'DELETE', req.user?.userId, product, null, 'xóa cứng (không có đơn hàng)');
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
}

// GET /api/products/:id/inventory - UC6.6 xem tồn kho theo biến thể
export async function getInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const guard = await assertCanEdit(req, id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.message });
    const vs = await prisma.productVariant.findMany({ where: { productId: id }, orderBy: { size: 'asc' } });
    res.json({
      productId: id,
      variants: vs.map((v) => {
        const available = v.stock - v.reserved;
        const state = v.stock <= 0 ? 'out' : (v.lowStockThreshold != null && v.stock <= v.lowStockThreshold) ? 'low' : 'in';
        return { id: v.id, size: v.size, stock: v.stock, reserved: v.reserved, available, lowStockThreshold: v.lowStockThreshold, state };
      }),
    });
  } catch (err) {
    next(err);
  }
}

const invSchema = z.object({
  updates: z.array(z.object({
    size: z.string().min(1),
    stock: z.coerce.number().int().min(0).optional(),
    lowStockThreshold: z.coerce.number().int().min(0).nullable().optional(),
  })).min(1),
});

// PATCH /api/products/:id/inventory - UC6.6 cập nhật tồn kho (chống oversell: không thấp hơn số giữ chỗ)
export async function updateInventory(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const guard = await assertCanEdit(req, id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.message });
    const { updates } = invSchema.parse(req.body);
    const updated: any[] = []; const errors: any[] = [];
    for (const u of updates) {
      const v = await prisma.productVariant.findUnique({ where: { productId_size: { productId: id, size: u.size } } });
      if (!v) { errors.push({ size: u.size, message: 'Biến thể không tồn tại' }); continue; }
      if (u.stock != null && u.stock < v.reserved) { errors.push({ size: u.size, message: `Không thể đặt tồn kho (${u.stock}) thấp hơn số đang giữ chỗ (${v.reserved}) để tránh bán vượt.` }); continue; } // 6E
      const nv = await prisma.productVariant.update({
        where: { id: v.id },
        data: { stock: u.stock ?? v.stock, lowStockThreshold: u.lowStockThreshold === undefined ? v.lowStockThreshold : u.lowStockThreshold },
      });
      updated.push({ size: nv.size, stock: nv.stock, reserved: nv.reserved, lowStockThreshold: nv.lowStockThreshold, outOfStock: nv.stock <= 0 });
    }
    if (updated.length) await auditProduct(id, 'UPDATE', req.user?.userId, null, { updates: updated }, 'cập nhật tồn kho');
    res.json({ updated, errors });
  } catch (err) {
    next(err);
  }
}

// POST /api/products/:id/analyze - "Phân tích lại sản phẩm" (UC4.1 sự kiện kích hoạt thủ công)
export async function analyzeProductEndpoint(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const guard = await assertCanEdit(req, id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.message });
    const analysis = await analyzeProduct(id);
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
}

const confirmSchema = z.object({
  attributes: z.record(z.string(), z.string()).optional(), // điều chỉnh/bổ sung nhãn thủ công (8b)
});

// POST /api/products/:id/analysis/confirm - Người bán/Admin xác nhận hoặc điều chỉnh nhãn (luồng 8)
export async function confirmAnalysis(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const guard = await assertCanEdit(req, id);
    if (!guard.ok) return res.status(guard.code).json({ message: guard.message });
    const body = confirmSchema.parse(req.body);
    const current = await prisma.productAnalysis.findUnique({ where: { productId: id } });
    if (!current) return res.status(404).json({ message: 'Sản phẩm chưa được phân tích. Hãy chạy phân tích trước.' });
    const attributes = { ...(current.attributes as Record<string, string> | null ?? {}), ...(body.attributes ?? {}) };
    const analysis = await prisma.productAnalysis.update({
      where: { productId: id },
      data: {
        status: 'CONFIRMED', attributes, occasion: attributes.occasion ?? current.occasion,
        confirmedAt: new Date(), confirmedBy: req.user!.userId,
      },
    });
    res.json({ analysis });
  } catch (err) {
    next(err);
  }
}

// POST /api/products/analyze-batch - phân tích hàng loạt (UC4.1 luồng 1a). ADMIN: toàn sàn; SELLER: SP của mình.
export async function analyzeBatch(req: Request, res: Response, next: NextFunction) {
  try {
    const sellerId = req.user?.role === 'ADMIN' ? undefined : req.user?.userId;
    const result = await analyzeMany(sellerId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
