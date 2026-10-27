import { Router } from 'express';
import { createComplaint, listComplaints, respondComplaint } from '../controllers/complaint.controller';
import { uploadEvidenceHandler } from '../controllers/return.controller';
import { evidenceUpload } from './return.routes';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

// UC11.2 - khách gửi & theo dõi khiếu nại
router.post('/', createComplaint);
router.get('/', listComplaints);
router.patch('/:id/respond', respondComplaint); // phản hồi phương án của người bán
router.post('/upload', evidenceUpload, uploadEvidenceHandler); // tải ảnh/video bằng chứng

export default router;
