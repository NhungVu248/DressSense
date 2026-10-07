import { Router } from 'express';
import {
  listAttributes, createAttribute, updateAttribute, deleteAttribute,
  listRules, createRule, updateRule, deleteRule, listAudit,
} from '../controllers/fashion-knowledge.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// UC4.2 - chỉ Quản trị viên (toàn sàn) mới quản lý tri thức thời trang
router.use(authenticate, authorize('ADMIN'));

// (a) Danh mục thuộc tính chuẩn
router.get('/attributes', listAttributes);
router.post('/attributes', createAttribute);
router.patch('/attributes/:id', updateAttribute);
router.delete('/attributes/:id', deleteAttribute);

// (b) Luật hợp dáng
router.get('/rules', listRules);
router.post('/rules', createRule);
router.patch('/rules/:id', updateRule);
router.delete('/rules/:id', deleteRule);

// Nhật ký thay đổi
router.get('/audit', listAudit);

export default router;
