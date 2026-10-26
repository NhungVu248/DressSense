import { Router } from 'express';
import { createComplaint, listComplaints, respondComplaint } from '../controllers/complaint.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

// UC11.2 - khách gửi & theo dõi khiếu nại
router.post('/', createComplaint);
router.get('/', listComplaints);
router.patch('/:id/respond', respondComplaint); // phản hồi phương án của người bán

export default router;
