import { Router } from 'express';
import {
  listProducts, getProduct, createProduct, updateProduct, listManagedProducts,
  deleteProduct, getInventory, updateInventory,
  analyzeProductEndpoint, confirmAnalysis, analyzeBatch,
} from '../controllers/product.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();
router.get('/', listProducts);

// UC6.1 - danh sách quản lý theo vai trò + UC4.1 phân tích hàng loạt (đặt trước '/:id')
router.get('/manage', authenticate, authorize('SELLER', 'ADMIN'), listManagedProducts);
router.post('/analyze-batch', authenticate, authorize('SELLER', 'ADMIN'), analyzeBatch);

router.get('/:id', getProduct);
router.post('/', authenticate, authorize('SELLER', 'ADMIN'), createProduct); // UC6.3
router.patch('/:id', authenticate, authorize('SELLER', 'ADMIN'), updateProduct); // UC6.4
router.delete('/:id', authenticate, authorize('SELLER', 'ADMIN'), deleteProduct); // UC6.5

// UC6.6 - quản lý tồn kho theo biến thể
router.get('/:id/inventory', authenticate, authorize('SELLER', 'ADMIN'), getInventory);
router.patch('/:id/inventory', authenticate, authorize('SELLER', 'ADMIN'), updateInventory);

// UC4.1 - phân tích lại + xác nhận/điều chỉnh nhãn thuộc tính
router.post('/:id/analyze', authenticate, authorize('SELLER', 'ADMIN'), analyzeProductEndpoint);
router.post('/:id/analysis/confirm', authenticate, authorize('SELLER', 'ADMIN'), confirmAnalysis);

export default router;
