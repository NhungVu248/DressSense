import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ message: 'Không tìm thấy tài nguyên' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ', errors: err.issues });
  }
  console.error(err);
  res.status(500).json({ message: 'Lỗi máy chủ nội bộ' });
}
