import { Router } from 'express';
import { createReturn, listReturns } from '../controllers/return.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();
router.use(authenticate);

// UC11.1 - khách tạo & xem yêu cầu đổi/trả
router.post('/', createReturn);
router.get('/', listReturns);

export default router;
