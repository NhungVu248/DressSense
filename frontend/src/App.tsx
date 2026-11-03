import { useEffect } from 'react';
import { Routes, Route, Navigate, useParams, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import GlobalToast from './components/Toast';
import GlobalDialog from './components/Dialog';
import HomePage from './pages/HomePage';
import ProductsPage from './pages/ProductsPage';
// UC7.4 - Xem chi tiết sản phẩm
import ProductDetailPage from './pages/ProductDetailPage';
// UC8 - Giỏ hàng & Danh sách yêu thích
import CartPage from './pages/CartPage';
import WishlistPage from './pages/WishlistPage';
// UC9 - Đặt hàng & thanh toán
import CheckoutPage from './pages/CheckoutPage';
import CheckoutResultPage from './pages/CheckoutResultPage';
import { OrdersPage, OrderDetailPage } from './pages/OrdersPage';
import MyFeedbackPage from './pages/MyFeedbackPage';
import InvoicePage from './pages/InvoicePage';
import TransactionHistoryPage from './pages/TransactionHistoryPage';
// UC1 - Khách hàng
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyOtpPage from './pages/auth/VerifyOtpPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import VerifyLoginOtpPage from './pages/auth/VerifyLoginOtpPage';
import ChangePasswordPage from './pages/auth/ChangePasswordPage';
import PasswordExpiryBanner from './components/PasswordExpiryBanner';
import MessagesPage from './pages/MessagesPage';
// UC1 - Người bán
import SellerLoginPage from './pages/seller/SellerLoginPage';
import SellerRegisterPage from './pages/seller/SellerRegisterPage';
import SellerPendingPage from './pages/seller/SellerPendingPage';
// UC1.4/1.5/1.6 - Hồ sơ & sổ địa chỉ
import ProfilePage from './pages/profile/ProfilePage';
import EditProfilePage from './pages/profile/EditProfilePage';
import AddressBookPage from './pages/profile/AddressBookPage';
// UC2.1/UC2.2 - Hồ sơ cá nhân hóa & thông tin size
import PersonalizationPage from './pages/profile/PersonalizationPage';
import SizeInfoPage from './pages/profile/SizeInfoPage';
// UC3.1 - Phân tích dáng người bằng AI
import BodyAnalysisPage from './pages/profile/BodyAnalysisPage';
// UC5 - Gợi ý sản phẩm cá nhân hóa
import RecommendationsPage from './pages/RecommendationsPage';
// UC1.7 - Quản trị phân quyền người dùng
import AdminUsersPage from './pages/admin/AdminUsersPage';
// UC6 - Quản lý sản phẩm & danh mục (Người bán / Quản trị viên)
import ProductManagePage from './pages/manage/ProductManagePage';
import ProductFormPage from './pages/manage/ProductFormPage';
// UC10.4 - Người bán quản lý đơn hàng
import SellerOrdersPage from './pages/manage/SellerOrdersPage';
// UC13.1 - Người bán quản lý khuyến mãi (voucher + Flash Sale)
import PromotionManagePage from './pages/manage/PromotionManagePage';
// UC11 - Đổi/trả, khiếu nại, hỗ trợ sau bán
import SupportPage from './pages/SupportPage';
import SellerSupportPage from './pages/manage/SellerSupportPage';
import AdminComplaintsPage from './pages/admin/AdminComplaintsPage';
// UC12 - Đánh giá, hỏi đáp, thông báo
import NotificationsPage from './pages/NotificationsPage';
import SellerReviewsPage from './pages/manage/SellerReviewsPage';
import AdminReviewsPage from './pages/admin/AdminReviewsPage';
import CategoryManagePage from './pages/admin/CategoryManagePage';
// UC13 - Quản trị khuyến mãi / banner / thông báo
import AdminPromotionsPage from './pages/admin/AdminPromotionsPage';
import AdminBannersPage from './pages/admin/AdminBannersPage';
import AdminCampaignsPage from './pages/admin/AdminCampaignsPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminLayout from './components/AdminLayout';
// UC14 - Seller Portal
import SellerLayout from './components/SellerLayout';
import SellerReportPage from './pages/seller/SellerReportPage';
import InventoryPage from './pages/seller/InventoryPage';
import SellerShippingPage from './pages/seller/SellerShippingPage';
import ShopProfilePage from './pages/seller/ShopProfilePage';
import SellerAdOrdersPage from './pages/seller/SellerAdOrdersPage';
import SellerVoucherOrdersPage from './pages/seller/SellerVoucherOrdersPage';
import AdminShopsPage from './pages/admin/AdminShopsPage';
// UC16 - Quản trị hệ thống
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import AdminContentPage from './pages/admin/AdminContentPage';
import AdminCommissionReportPage from './pages/admin/AdminCommissionReportPage';
import AdminCommissionPoliciesPage from './pages/admin/AdminCommissionPoliciesPage';
import AdminCommissionsPage from './pages/admin/AdminCommissionsPage';
import AdminSettlementsPage from './pages/admin/AdminSettlementsPage';
import SellerFinancePage from './pages/seller/SellerFinancePage';
import AdminAdOrdersPage from './pages/admin/AdminAdOrdersPage';
import AdminVoucherOrdersPage from './pages/admin/AdminVoucherOrdersPage';
import AdminForgotPasswordPage from './pages/admin/AdminForgotPasswordPage';
import AdminPasswordResetsPage from './pages/admin/AdminPasswordResetsPage';
import AdminOrdersPage from './pages/admin/AdminOrdersPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminModerationLogsPage from './pages/admin/AdminModerationLogsPage';
import AdminActionLogsPage from './pages/admin/AdminActionLogsPage';
import AdminAnnouncementsPage from './pages/admin/AdminAnnouncementsPage';
// UC15 - Phân tích dữ liệu kinh doanh (BI) - trang dùng chung cho Seller & Admin
import RevenueAnalyticsPage from './pages/analytics/RevenueAnalyticsPage';
import CustomerAnalyticsPage from './pages/analytics/CustomerAnalyticsPage';
import BehaviorAnalyticsPage from './pages/analytics/BehaviorAnalyticsPage';
import BodyShapeAnalyticsPage from './pages/analytics/BodyShapeAnalyticsPage';
import InventoryAnalyticsPage from './pages/analytics/InventoryAnalyticsPage';
import RequireAuth from './components/RequireAuth';

// Bố cục trang mua sắm (có Navbar)
function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream flex flex-col justify-between">
      <div>
      <Navbar />
        {children}
      </div>
      <Footer />
    </div>
  );
}

// Redirect /manage/products/:id/edit -> /seller/products/:id/edit (giữ tham số id)
function RedirectManageEdit() {
  const { id } = useParams();
  return <Navigate to={`/seller/products/${id}/edit`} replace />;
}

// Mỗi lần đổi route, cuộn trang về đầu (tránh giữ vị trí cuộn của trang trước).
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <GlobalToast />
      <GlobalDialog />
      <PasswordExpiryBanner />
      <Routes>
      {/* UC7 - Tìm kiếm & duyệt sản phẩm */}
      <Route path="/" element={<ShopLayout><HomePage /></ShopLayout>} />
      <Route path="/products" element={<ShopLayout><ProductsPage /></ShopLayout>} />
      <Route path="/products/:id" element={<ShopLayout><ProductDetailPage /></ShopLayout>} />

      {/* UC1 - Xác thực Khách hàng (toàn màn hình) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-login-otp" element={<VerifyLoginOtpPage />} />{/* OTP đăng nhập lần đầu */}
      <Route path="/change-password" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />{/* đổi/hết hạn MK */}

      {/* UC1 - Cổng Người bán */}
      <Route path="/seller/login" element={<SellerLoginPage />} />
      <Route path="/seller/register" element={<SellerRegisterPage />} />
      <Route path="/seller/pending" element={<SellerPendingPage />} />

      {/* UC1.4/1.5/1.6 - Hồ sơ cá nhân (yêu cầu đăng nhập) */}
      <Route path="/profile" element={<RequireAuth><ShopLayout><ProfilePage /></ShopLayout></RequireAuth>} />
      <Route path="/profile/edit" element={<RequireAuth><ShopLayout><EditProfilePage /></ShopLayout></RequireAuth>} />
      <Route path="/profile/addresses" element={<RequireAuth><ShopLayout><AddressBookPage /></ShopLayout></RequireAuth>} />

      {/* UC2.1/UC2.2 - Hồ sơ cá nhân hóa & thông tin size */}
      <Route path="/profile/personalization" element={<RequireAuth><ShopLayout><PersonalizationPage /></ShopLayout></RequireAuth>} />
      <Route path="/profile/sizes" element={<RequireAuth><ShopLayout><SizeInfoPage /></ShopLayout></RequireAuth>} />

      {/* UC3.1 - Phân tích dáng người bằng AI (CÔNG KHAI: khách dùng thử, lưu hồ sơ cần đăng nhập) */}
      <Route path="/profile/body" element={<ShopLayout><BodyAnalysisPage /></ShopLayout>} />

      {/* UC8 - Giỏ hàng & Danh sách yêu thích (gắn tài khoản) */}
      <Route path="/cart" element={<RequireAuth><ShopLayout><CartPage /></ShopLayout></RequireAuth>} />
      <Route path="/wishlist" element={<RequireAuth><ShopLayout><WishlistPage /></ShopLayout></RequireAuth>} />

      {/* UC9 - Đặt hàng & thanh toán */}
      <Route path="/checkout" element={<RequireAuth><ShopLayout><CheckoutPage /></ShopLayout></RequireAuth>} />
      <Route path="/checkout/result" element={<RequireAuth><ShopLayout><CheckoutResultPage /></ShopLayout></RequireAuth>} />
      <Route path="/orders" element={<RequireAuth><ShopLayout><OrdersPage /></ShopLayout></RequireAuth>} />
      <Route path="/orders/:id" element={<RequireAuth><ShopLayout><OrderDetailPage /></ShopLayout></RequireAuth>} />
      <Route path="/orders/:id/invoice" element={<RequireAuth><ShopLayout><InvoicePage /></ShopLayout></RequireAuth>} />{/* Backlog - hóa đơn VAT */}
      <Route path="/my-feedback" element={<RequireAuth><ShopLayout><MyFeedbackPage /></ShopLayout></RequireAuth>} />{/* Đánh giá & Hỏi đáp của tôi */}
      <Route path="/transactions" element={<RequireAuth><ShopLayout><TransactionHistoryPage /></ShopLayout></RequireAuth>} />

      {/* UC11 - Đổi/trả & khiếu nại (khách) */}
      <Route path="/support" element={<RequireAuth><ShopLayout><SupportPage /></ShopLayout></RequireAuth>} />

      {/* UC12.4 - Thông báo (khách) */}
      <Route path="/notifications" element={<RequireAuth><ShopLayout><NotificationsPage /></ShopLayout></RequireAuth>} />
      <Route path="/messages" element={<RequireAuth><ShopLayout><MessagesPage /></ShopLayout></RequireAuth>} />{/* Tin nhắn/CSKH */}

      {/* UC5 - Gợi ý sản phẩm cá nhân hóa */}
      <Route path="/recommendations" element={<RequireAuth><ShopLayout><RecommendationsPage /></ShopLayout></RequireAuth>} />

      {/* ===== Cổng QUẢN TRỊ VIÊN - luồng riêng (AdminLayout), song song Khách/Người bán ===== */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />{/* admin quên MK */}
      <Route path="/admin" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminDashboardPage /></AdminLayout></RequireAuth>} />{/* UC16.1 */}
      <Route path="/admin/users" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminUsersPage /></AdminLayout></RequireAuth>} />{/* UC16.2 */}
      <Route path="/admin/content" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminContentPage /></AdminLayout></RequireAuth>} />{/* UC16.4 */}
      <Route path="/admin/settings" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminSettingsPage /></AdminLayout></RequireAuth>} />{/* UC16.5 */}
      <Route path="/admin/password-resets" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminPasswordResetsPage /></AdminLayout></RequireAuth>} />{/* admin cấp lại MK */}
      <Route path="/admin/messages" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><MessagesPage /></AdminLayout></RequireAuth>} />{/* CSKH */}
      <Route path="/admin/categories" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><CategoryManagePage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/complaints" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminComplaintsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/reviews" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminReviewsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/shops" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminShopsPage /></AdminLayout></RequireAuth>} />{/* UC14.1/UC16.3 */}
      {/* Bổ sung theo ERD: đơn hàng toàn sàn (#6), báo cáo vi phạm (#8), kiểm duyệt (#9), nhật ký (#12), thông báo (#11) */}
      <Route path="/admin/orders" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminOrdersPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/reports" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminReportsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/moderation" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminModerationLogsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/action-logs" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminActionLogsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/announcements" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminAnnouncementsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/notifications" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><NotificationsPage /></AdminLayout></RequireAuth>} />
      {/* Backlog C.42 - Doanh thu của sàn (phí hoa hồng + banner) */}
      <Route path="/admin/platform-revenue" element={<Navigate to="/admin/finance/report" replace />} />{/* C.42 - gộp vào báo cáo hoa hồng */}
      {/* Mục 2 - Tài chính & Hoa hồng */}
      <Route path="/admin/finance/report" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminCommissionReportPage /></AdminLayout></RequireAuth>} />{/* 2.5 */}
      <Route path="/admin/finance/policies" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminCommissionPoliciesPage /></AdminLayout></RequireAuth>} />{/* 2.1/2.2 */}
      <Route path="/admin/finance/commissions" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminCommissionsPage /></AdminLayout></RequireAuth>} />{/* 2.3 */}
      <Route path="/admin/finance/settlements" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminSettlementsPage /></AdminLayout></RequireAuth>} />{/* 2.4 */}
      {/* Backlog C.41 - Duyệt đơn quảng cáo banner + timeline */}
      <Route path="/admin/ad-orders" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminAdOrdersPage /></AdminLayout></RequireAuth>} />
      {/* Backlog C.45 - Duyệt đơn mua voucher */}
      <Route path="/admin/voucher-orders" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminVoucherOrdersPage /></AdminLayout></RequireAuth>} />
      {/* UC15 - Phân tích (BI) trong Admin (toàn hệ thống) */}
      <Route path="/admin/analytics/revenue" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><RevenueAnalyticsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/analytics/customers" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><CustomerAnalyticsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/analytics/behavior" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><BehaviorAnalyticsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/analytics/body-shapes" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><BodyShapeAnalyticsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/analytics/inventory" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><InventoryAnalyticsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/promotions" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminPromotionsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/banners" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminBannersPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/campaigns" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminCampaignsPage /></AdminLayout></RequireAuth>} />
      {/* Backlog C.40 - Admin không CRUD sản phẩm trực tiếp nữa; chuyển sang kiểm duyệt nội dung */}
      <Route path="/admin/products" element={<Navigate to="/admin/content" replace />} />
      <Route path="/admin/products/*" element={<Navigate to="/admin/content" replace />} />

      {/* ===== UC14 - SELLER PORTAL (khung riêng SellerLayout) ===== */}
      <Route path="/seller" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><SellerReportPage /></SellerLayout></RequireAuth>} />{/* UC14.4 */}
      <Route path="/seller/shop" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><ShopProfilePage /></SellerLayout></RequireAuth>} />{/* UC14.1 */}
      <Route path="/seller/shipping" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><SellerShippingPage /></SellerLayout></RequireAuth>} />{/* ERD 3.3 - vận chuyển */}
      <Route path="/seller/inventory" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><InventoryPage /></SellerLayout></RequireAuth>} />{/* ERD 3.8/3.9 - tồn kho */}
      <Route path="/seller/notifications" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><NotificationsPage /></SellerLayout></RequireAuth>} />{/* thông báo trong portal */}
      <Route path="/seller/products" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><ProductManagePage basePath="/seller/products" /></SellerLayout></RequireAuth>} />{/* UC14.2 */}
      <Route path="/seller/products/new" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><ProductFormPage basePath="/seller/products" /></SellerLayout></RequireAuth>} />
      <Route path="/seller/products/:id/edit" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><ProductFormPage basePath="/seller/products" /></SellerLayout></RequireAuth>} />
      <Route path="/seller/orders" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><SellerOrdersPage /></SellerLayout></RequireAuth>} />{/* UC14.3 */}
      <Route path="/seller/finance" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><SellerFinancePage /></SellerLayout></RequireAuth>} />{/* Mục 3 - Tài chính & doanh thu */}
      <Route path="/seller/promotions" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><PromotionManagePage /></SellerLayout></RequireAuth>} />
      <Route path="/seller/ad-orders" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><SellerAdOrdersPage /></SellerLayout></RequireAuth>} />{/* Backlog B.26 */}
      <Route path="/seller/voucher-orders" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><SellerVoucherOrdersPage /></SellerLayout></RequireAuth>} />{/* Backlog B.27 */}
      <Route path="/seller/reviews" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><SellerReviewsPage /></SellerLayout></RequireAuth>} />
      <Route path="/seller/support" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><SellerSupportPage /></SellerLayout></RequireAuth>} />
      <Route path="/seller/messages" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><MessagesPage /></SellerLayout></RequireAuth>} />{/* tin nhắn KH */}
      {/* UC15 - Phân tích (BI) trong Seller Portal (phạm vi gian hàng) */}
      <Route path="/seller/analytics/revenue" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><RevenueAnalyticsPage /></SellerLayout></RequireAuth>} />
      <Route path="/seller/analytics/customers" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><CustomerAnalyticsPage /></SellerLayout></RequireAuth>} />
      <Route path="/seller/analytics/behavior" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><BehaviorAnalyticsPage /></SellerLayout></RequireAuth>} />
      <Route path="/seller/analytics/body-shapes" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><BodyShapeAnalyticsPage /></SellerLayout></RequireAuth>} />
      <Route path="/seller/analytics/inventory" element={<RequireAuth roles={['SELLER', 'ADMIN']} loginPath="/seller/login"><SellerLayout><InventoryAnalyticsPage /></SellerLayout></RequireAuth>} />

      {/* /manage/* cũ -> gộp vào Seller Portal /seller/* (luồng riêng như admin) */}
      <Route path="/manage/orders" element={<Navigate to="/seller/orders" replace />} />
      <Route path="/manage/promotions" element={<Navigate to="/seller/promotions" replace />} />
      <Route path="/manage/support" element={<Navigate to="/seller/support" replace />} />
      <Route path="/manage/reviews" element={<Navigate to="/seller/reviews" replace />} />
      <Route path="/manage/products" element={<Navigate to="/seller/products" replace />} />
      <Route path="/manage/products/new" element={<Navigate to="/seller/products/new" replace />} />
      <Route path="/manage/products/:id/edit" element={<RedirectManageEdit />} />
      </Routes>
    </>
  );
}
