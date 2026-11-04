import { Router } from 'express';
import {
  listUsers,
  getUserDetail,
  updateUserRole,
  listAuditLogs,
  listAdminPasswordResets,
  resolveAdminPasswordReset,
} from '../controllers/admin.controller';
import { listAdminComplaints, adminResolveComplaint } from '../controllers/complaint.controller';
import { listAdminReviews, moderateReview } from '../controllers/review.controller';
import { listShopsAdmin, approveShop, rejectShop, setShopSuspension, requestInfoShop } from '../controllers/shop.controller';
import { getAdminDashboard } from '../controllers/admin-dashboard.controller';
import { getPlatformRevenue } from '../controllers/platform-revenue.controller';
import {
  listAdminBannerOrders, bannerTimeline, approveBannerOrder, rejectBannerOrder,
} from '../controllers/banner-order.controller';
import { listSettings, updateSettings, getSettingHistory } from '../controllers/settings.controller';
import { listModerationProducts, moderateProduct } from '../controllers/content-moderation.controller';
import { listReports, resolveReport } from '../controllers/report.controller';
import { listModerationLogs, listActionLogs } from '../controllers/admin-log.controller';
import {
  listAnnouncements, createAnnouncement, updateAnnouncement, publishAnnouncement, deleteAnnouncement,
} from '../controllers/announcement.controller';
import { listAllOrders, getOrderDetailAdmin } from '../controllers/admin-order.controller';
import {
  listCommissionPolicies, createCommissionPolicy, updateCommissionPolicy, setCommissionPolicyStatus, getCommissionPolicyHistory,
  listOrderCommissions, getSettlementBalances, listEligibleOrders, createSettlement, confirmSettlementPayment,
  cancelSettlement, listSettlements, getSettlement, getCommissionReport,
} from '../controllers/commission-admin.controller';
import { authenticate, authorize } from '../middlewares/auth';

const router = Router();

// UC1.7 - Phân quyền người dùng: chỉ Quản trị viên (ADMIN) đã đăng nhập
router.use(authenticate, authorize('ADMIN'));

router.get('/users', listUsers);
router.get('/users/:id', getUserDetail);
router.patch('/users/:id', updateUserRole);
router.get('/audit-logs', listAuditLogs);

// Admin cấp lại mật khẩu cho admin quên mật khẩu
router.get('/password-resets', listAdminPasswordResets);
router.post('/password-resets/:id/resolve', resolveAdminPasswordReset);

// UC11.2 - phân xử khiếu nại
router.get('/complaints', listAdminComplaints);
router.patch('/complaints/:id/resolve', adminResolveComplaint);

// UC12.1 - kiểm duyệt đánh giá
router.get('/reviews', listAdminReviews);
router.patch('/reviews/:id/moderate', moderateReview);

// UC14.1 / UC16.3 - kiểm duyệt gian hàng
router.get('/shops', listShopsAdmin);
router.patch('/shops/:id/approve', approveShop);
router.patch('/shops/:id/reject', rejectShop);
router.patch('/shops/:id/request-info', requestInfoShop); // UC16.3 - 5a yêu cầu bổ sung
router.patch('/shops/:id/suspension', setShopSuspension);

// UC16.1 - Dashboard quản trị
router.get('/dashboard', getAdminDashboard);

// Backlog C.42 - Doanh thu của sàn (phí hoa hồng + banner) - giữ tương thích; thay bằng /commission/report
router.get('/platform-revenue', getPlatformRevenue);

// Mục 2 - Quản lý & cấu hình hoa hồng / đối soát
// 2.1/2.2 - Chính sách hoa hồng
router.get('/commission/policies', listCommissionPolicies);
router.post('/commission/policies', createCommissionPolicy);
router.get('/commission/policies/history', getCommissionPolicyHistory);
router.put('/commission/policies/:id', updateCommissionPolicy);
router.patch('/commission/policies/:id/status', setCommissionPolicyStatus);
// 2.3 - Giao dịch hoa hồng
router.get('/commission/transactions', listOrderCommissions);
// 2.4 - Đối soát & thanh toán Seller
router.get('/commission/settlements/balances', getSettlementBalances);
router.get('/commission/settlements/eligible', listEligibleOrders);
router.get('/commission/settlements', listSettlements);
router.post('/commission/settlements', createSettlement);
router.get('/commission/settlements/:id', getSettlement);
router.post('/commission/settlements/:id/pay', confirmSettlementPayment);
router.post('/commission/settlements/:id/cancel', cancelSettlement);
// 2.5 - Báo cáo doanh thu hoa hồng
router.get('/commission/report', getCommissionReport);

// Backlog C.41 - Duyệt đơn quảng cáo banner + bảng timeline
router.get('/ad-orders', listAdminBannerOrders);
router.get('/ad-orders/timeline', bannerTimeline);
router.post('/ad-orders/:id/approve', approveBannerOrder);
router.post('/ad-orders/:id/reject', rejectBannerOrder);

// UC16.4 - Kiểm duyệt nội dung (sản phẩm; đánh giá dùng /admin/reviews sẵn có)
router.get('/moderation/products', listModerationProducts);
router.patch('/moderation/products/:id', moderateProduct);

// UC16.5 - Cấu hình hệ thống
router.get('/settings', listSettings);
router.put('/settings', updateSettings);
router.get('/settings/history', getSettingHistory);

// Admin #6 - Quản lý đơn hàng (theo dõi toàn sàn, chỉ đọc)
router.get('/orders', listAllOrders);
router.get('/orders/:id', getOrderDetailAdmin);

// ERD 3.19 (Admin #8) - Báo cáo vi phạm
router.get('/reports', listReports);
router.patch('/reports/:id', resolveReport);

// ERD 3.18 (Admin #9) - Lịch sử kiểm duyệt
router.get('/moderation-logs', listModerationLogs);

// ERD 3.22 (Admin #11) - Thông báo toàn sàn (Buyer/Seller)
router.get('/announcements', listAnnouncements);
router.post('/announcements', createAnnouncement);
router.put('/announcements/:id', updateAnnouncement);
router.post('/announcements/:id/publish', publishAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

// ERD 3.17 (Admin #12) - Nhật ký hoạt động Admin
router.get('/action-logs', listActionLogs);

export default router;
