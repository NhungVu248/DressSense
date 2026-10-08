import { Router } from 'express';
import {
  listProducts, getProduct, createProduct,
  analyzeProductEndpoint, confirmAnalysis, analyzeBatch,
} from '../controllers/product.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();
router.get('/', listProducts);

// UC4.1 - phân tích hàng loạt (đặt trước '/:id' để không bị nuốt làm id)
router.post('/analyze-batch', authenticate, authorize('SELLER', 'ADMIN'), analyzeBatch);

router.get('/:id', getProduct);
router.post('/', authenticate, authorize('SELLER', 'ADMIN'), createProduct);

// UC4.1 - phân tích lại + xác nhận/điều chỉnh nhãn thuộc tính
router.post('/:id/analyze', authenticate, authorize('SELLER', 'ADMIN'), analyzeProductEndpoint);
router.post('/:id/analysis/confirm', authenticate, authorize('SELLER', 'ADMIN'), confirmAnalysis);

export default router;
