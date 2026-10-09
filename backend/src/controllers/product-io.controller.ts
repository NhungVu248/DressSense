import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { analyzeProduct } from '../services/product-analysis.service';

// ============================================================
//  UC6.7 - NHẬP/XUẤT SẢN PHẨM HÀNG LOẠT (CSV)
//  Nhập: kiểm từng dòng, nhập một phần (bỏ dòng lỗi + báo cáo), tạo/cập nhật + tự phân tích (UC4.1).
//  Xuất: tải danh sách SP kèm thông tin quản lý theo phạm vi vai trò.
// ============================================================

const COLUMNS = ['id', 'name', 'description', 'categoryId', 'price', 'brand', 'color', 'material', 'style', 'garmentType', 'occasion', 'status', 'variants'];

// CSV tối giản có xử lý ô trong ngoặc kép
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/products/import/template - tải tệp mẫu
export function importTemplate(_req: Request, res: Response) {
  const header = COLUMNS.join(',');
  const example = ['', 'Áo thun basic', 'Áo cotton cổ tròn', '2', '150000', 'DressSense', 'Trắng', 'Cotton', 'Casual', 'Áo thun tay ngắn', 'STREET', 'ACTIVE', 'S:10;M:8;L:5'].map(csvCell).join(',');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="product-import-template.csv"');
  res.send('﻿' + header + '\n' + example + '\n');
}

// GET /api/products/export - xuất danh sách theo vai trò
export async function exportProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const where: any = { deletedAt: null };
    if (req.user?.role !== 'ADMIN') where.sellerId = req.user!.userId;
    const products = await prisma.product.findMany({
      where, orderBy: { id: 'asc' },
      include: { category: { select: { name: true } }, variants: { select: { size: true, stock: true } } },
    });
    const header = ['id', 'name', 'description', 'category', 'price', 'brand', 'status', 'stock', 'variants'];
    const lines = [header.join(',')];
    for (const p of products) {
      const stock = p.variants.reduce((a, v) => a + v.stock, 0);
      const variants = p.variants.map((v) => `${v.size}:${v.stock}`).join(';');
      lines.push([p.id, p.name, p.description ?? '', p.category.name, p.price, p.brand ?? '', p.status, stock, variants].map(csvCell).join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="products-export.csv"');
    res.send('﻿' + lines.join('\n') + '\n');
  } catch (err) { next(err); }
}

function parseVariants(s: string): Array<{ size: string; stock: number }> {
  return (s || '').split(';').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [size, st] = p.split(':');
    return { size: (size || '').trim(), stock: Math.max(0, parseInt(st || '0', 10) || 0) };
  }).filter((v) => v.size);
}

// POST /api/products/import - nhập hàng loạt (multipart 'file')
export async function importProducts(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) return res.status(400).json({ message: 'Vui lòng tải lên tệp CSV.' }); // 4E
    const rows = parseCsv(req.file.buffer.toString('utf8').replace(/^﻿/, ''));
    if (rows.length < 2) return res.status(400).json({ message: 'Tệp rỗng hoặc chỉ có tiêu đề. Dùng đúng tệp mẫu.' }); // 4E
    const header = rows[0].map((h) => h.trim());
    const idx = (k: string) => header.indexOf(k);
    if (idx('name') < 0 || idx('price') < 0 || idx('categoryId') < 0) {
      return res.status(400).json({ message: 'Tệp sai mẫu: cần tối thiểu các cột name, price, categoryId.' }); // 4E
    }

    const cats = new Map((await prisma.category.findMany({ select: { id: true, active: true } })).map((c) => [c.id, c.active]));
    let created = 0, updated = 0; const errors: Array<{ row: number; message: string }> = [];
    const touched: number[] = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r]; const get = (k: string) => { const i = idx(k); return i >= 0 ? (row[i] ?? '').trim() : ''; };
      const name = get('name'); const price = Number(get('price')); const categoryId = Number(get('categoryId'));
      if (!name) { errors.push({ row: r + 1, message: 'Thiếu tên' }); continue; }
      if (!Number.isFinite(price) || price < 0) { errors.push({ row: r + 1, message: 'Giá không hợp lệ' }); continue; } // 7E
      if (!cats.has(categoryId) || cats.get(categoryId) === false) { errors.push({ row: r + 1, message: 'Danh mục không hợp lệ hoặc đã ẩn' }); continue; } // 7F
      const status = ['DRAFT', 'PENDING', 'ACTIVE', 'HIDDEN'].includes(get('status')) ? get('status') : 'ACTIVE';
      const fields: any = {
        name, description: get('description') || null, price: Math.round(price), categoryId, status,
        brand: get('brand') || null, color: get('color') || null, material: get('material') || null,
        style: get('style') || null, garmentType: get('garmentType') || null, occasion: get('occasion') || null,
      };
      const variants = parseVariants(get('variants'));
      try {
        const rawId = Number(get('id'));
        if (Number.isFinite(rawId) && rawId > 0) {
          // 2a - cập nhật theo id (chỉ SP thuộc phạm vi quản lý)
          const existing = await prisma.product.findUnique({ where: { id: rawId }, select: { sellerId: true } });
          if (!existing) { errors.push({ row: r + 1, message: `Không thấy sản phẩm id ${rawId}` }); continue; }
          if (req.user?.role !== 'ADMIN' && existing.sellerId !== req.user?.userId) { errors.push({ row: r + 1, message: 'Không có quyền với sản phẩm này' }); continue; }
          await prisma.product.update({ where: { id: rawId }, data: fields });
          for (const v of variants) await prisma.productVariant.upsert({ where: { productId_size: { productId: rawId, size: v.size } }, update: { stock: v.stock }, create: { productId: rawId, size: v.size, stock: v.stock } });
          touched.push(rawId); updated++;
        } else {
          const p = await prisma.product.create({ data: { ...fields, sellerId: req.user!.userId, variants: variants.length ? { create: variants } : undefined } });
          touched.push(p.id); created++;
        }
      } catch (e: any) {
        errors.push({ row: r + 1, message: 'Lỗi lưu: ' + String(e.message || e).split('\n')[0] }); // 7E - dòng lỗi không chặn lô
      }
    }

    // UC4.1 - phân tích gán nhãn hàng loạt cho SP mới/đã đổi (trừ DRAFT), chạy nền nhẹ
    for (const id of touched) { try { await analyzeProduct(id); } catch { /* bỏ qua */ } }

    if (created + updated === 0) return res.status(422).json({ message: 'Không có dòng hợp lệ nào để nhập.', created, updated, skipped: errors.length, errors }); // 4F
    res.json({ created, updated, skipped: errors.length, errors });
  } catch (err) { next(err); }
}
