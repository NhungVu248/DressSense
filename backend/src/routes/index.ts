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
import cartRoutes from './cart.routes';
import wishlistRoutes from './wishlist.routes';
import voucherRoutes from './voucher.routes';
import orderRoutes from './order.routes';
import paymentRoutes from './payment.routes';
import sellerOrderRoutes from './seller-order.routes';
import returnRoutes from './return.routes';
import complaintRoutes from './complaint.routes';

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
router.use('/cart', cartRoutes);       // UC8.1 - Giỏ hàng
router.use('/wishlist', wishlistRoutes); // UC8.2 - Danh sách yêu thích
router.use('/vouchers', voucherRoutes);  // UC8.3 - Mã giảm giá
router.use('/orders', orderRoutes);      // UC9.1 - Đặt hàng
router.use('/payments', paymentRoutes);  // UC9.2/9.3 - Thanh toán & lịch sử giao dịch
router.use('/seller', sellerOrderRoutes); // UC10.4/UC11 - Người bán quản lý đơn hàng
router.use('/returns', returnRoutes);     // UC11.1 - Đổi/trả hàng
router.use('/complaints', complaintRoutes); // UC11.2 - Khiếu nại

export default router;
