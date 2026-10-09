import { Router } from 'express';
import { listCategories, createCategory, updateCategory, deleteCategory } from '../controllers/category-admin.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// UC6.2 - chỉ Quản trị viên quản lý cây danh mục (toàn sàn)
router.use(authenticate, authorize('ADMIN'));

router.get('/', listCategories);
router.post('/', createCategory);
router.patch('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;
