import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { prisma } from '../lib/prisma';
import { uploadProductImages, uploadProductVideos } from '../middlewares/upload';

// ============================================================
//  Kho ảnh gian hàng (tái sử dụng) + tải video sản phẩm.
//  Chạy multer trong handler để trả lỗi thân thiện (sai định dạng / quá dung lượng).
// ============================================================

function runMulter(mw: RequestHandler, req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => (mw as any)(req, res, (err: any) => (err ? reject(err) : resolve())));
}

function mapUploadError(err: any): { code: number; message: string } {
  const m = err?.message;
  if (m === 'INVALID_IMAGE_TYPE') return { code: 400, message: 'Chỉ chấp nhận ảnh JPG/PNG/WEBP.' };
  if (m === 'INVALID_VIDEO_TYPE') return { code: 400, message: 'Chỉ chấp nhận video MP4/WEBM/MOV.' };
  if (err?.code === 'LIMIT_FILE_SIZE') return { code: 400, message: 'Tệp vượt quá dung lượng cho phép.' };
  if (err?.code === 'LIMIT_UNEXPECTED_FILE') return { code: 400, message: 'Vượt quá số tệp cho phép mỗi lượt.' };
  return { code: 500, message: '' };
}

// POST /api/seller/media/images - tải ảnh lên kho của gian hàng
export async function uploadMediaImages(req: Request, res: Response, next: NextFunction) {
  try {
    await runMulter(uploadProductImages, req, res);
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) return res.status(400).json({ message: 'Chưa chọn ảnh để tải lên.' });
    const sellerId = req.user!.userId;
    const created = await prisma.$transaction(
      files.map((f) => prisma.mediaAsset.create({ data: { sellerId, url: `/uploads/products/${f.filename}` } })),
    );
    res.status(201).json({ assets: created });
  } catch (err) {
    const e = mapUploadError(err);
    if (e.code !== 500) return res.status(e.code).json({ message: e.message });
    next(err);
  }
}

// GET /api/seller/media/images - danh sách ảnh trong kho của gian hàng
export async function listMediaImages(req: Request, res: Response, next: NextFunction) {
  try {
    const assets = await prisma.mediaAsset.findMany({ where: { sellerId: req.user!.userId }, orderBy: { createdAt: 'desc' }, take: 300 });
    res.json({ assets });
  } catch (err) { next(err); }
}

// DELETE /api/seller/media/images/:id - xóa khỏi kho (ảnh đã gắn vào sản phẩm vẫn giữ)
export async function deleteMediaImage(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const asset = await prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.sellerId !== req.user!.userId) return res.status(404).json({ message: 'Không tìm thấy ảnh trong kho.' });
    await prisma.mediaAsset.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// POST /api/seller/media/videos - tải video sản phẩm (trả URL, không lưu kho)
export async function uploadMediaVideos(req: Request, res: Response, next: NextFunction) {
  try {
    await runMulter(uploadProductVideos, req, res);
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (!files.length) return res.status(400).json({ message: 'Chưa chọn video để tải lên.' });
    res.status(201).json({ urls: files.map((f) => `/uploads/product-videos/${f.filename}`) });
  } catch (err) {
    const e = mapUploadError(err);
    if (e.code !== 500) return res.status(e.code).json({ message: e.message });
    next(err);
  }
}
