import { Router } from 'express';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import userRoutes from './user.routes';
import addressRoutes from './address.routes';
import adminRoutes from './admin.routes';
import personalizationRoutes from './personalization.routes';
import categoryRoutes from './category.routes';
import bodyRoutes from './body.routes';
import fashionKnowledgeRoutes from './fashion-knowledge.routes';
import categoryAdminRoutes from './category-admin.routes';
import recommendationRoutes from './recommendation.routes';
import behaviorRoutes from './behavior.routes';

const router = Router();
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/users', userRoutes);     // UC1.4, UC1.5
router.use('/addresses', addressRoutes); // UC1.6
router.use('/admin', adminRoutes);    // UC1.7 - Phân quyền người dùng
router.use('/personalization', personalizationRoutes); // UC2.1, UC2.2 - Hồ sơ cá nhân hóa & size
router.use('/body', bodyRoutes); // UC3 - Phân tích dáng người bằng AI
router.use('/admin/fashion-knowledge', fashionKnowledgeRoutes); // UC4.2 - Quản lý tri thức thời trang
router.use('/admin/categories', categoryAdminRoutes); // UC6.2 - Quản lý danh mục đa cấp
router.use('/recommendations', recommendationRoutes); // UC5 - Gợi ý sản phẩm cá nhân hóa
router.use('/behaviors', behaviorRoutes); // UC5/GĐ6 - Ghi nhận hành vi người dùng

export default router;
