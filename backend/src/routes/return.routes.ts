import { Router } from 'express';
import { createReturn, listReturns, uploadEvidenceHandler } from '../controllers/return.controller';
import { authenticate } from '../middlewares/auth';
import { uploadEvidence } from '../middlewares/upload';

const router = Router();
router.use(authenticate);

// UC11.1 - khách tạo & xem yêu cầu đổi/trả
router.post('/', createReturn);
router.get('/', listReturns);
router.post('/upload', evidenceUpload, uploadEvidenceHandler); // tải ảnh/video bằng chứng

export default router;

// Middleware tải bằng chứng + xử lý lỗi định dạng/kích thước (dùng chung)
export function evidenceUpload(req: any, res: any, next: any) {
  uploadEvidence(req, res, (err: any) => {
    if (err) {
      const msg = err.message === 'INVALID_EVIDENCE_TYPE' ? 'Chỉ chấp nhận ảnh (JPG/PNG/WEBP) hoặc video (MP4/WEBM/MOV)'
        : err.code === 'LIMIT_FILE_SIZE' ? 'Mỗi tệp tối đa 20MB' : 'Không tải được tệp, vui lòng thử lại';
      return res.status(400).json({ message: msg });
    }
    next();
  });
}
