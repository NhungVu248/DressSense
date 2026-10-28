import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
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
import TransactionHistoryPage from './pages/TransactionHistoryPage';
// UC1 - Khách hàng
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import VerifyOtpPage from './pages/auth/VerifyOtpPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
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
import RequireAuth from './components/RequireAuth';

// Bố cục trang mua sắm (có Navbar)
function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* UC7 - Tìm kiếm & duyệt sản phẩm */}
      <Route path="/" element={<ShopLayout><ProductsPage /></ShopLayout>} />
      <Route path="/products/:id" element={<ShopLayout><ProductDetailPage /></ShopLayout>} />

      {/* UC1 - Xác thực Khách hàng (toàn màn hình) */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

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
      <Route path="/transactions" element={<RequireAuth><ShopLayout><TransactionHistoryPage /></ShopLayout></RequireAuth>} />

      {/* UC11 - Đổi/trả & khiếu nại (khách) */}
      <Route path="/support" element={<RequireAuth><ShopLayout><SupportPage /></ShopLayout></RequireAuth>} />

      {/* UC12.4 - Thông báo (khách) */}
      <Route path="/notifications" element={<RequireAuth><ShopLayout><NotificationsPage /></ShopLayout></RequireAuth>} />

      {/* UC5 - Gợi ý sản phẩm cá nhân hóa */}
      <Route path="/recommendations" element={<RequireAuth><ShopLayout><RecommendationsPage /></ShopLayout></RequireAuth>} />

      {/* ===== Cổng QUẢN TRỊ VIÊN - luồng riêng (AdminLayout), song song Khách/Người bán ===== */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminUsersPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/categories" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><CategoryManagePage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/complaints" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminComplaintsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/reviews" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminReviewsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/promotions" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminPromotionsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/banners" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminBannersPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/campaigns" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><AdminCampaignsPage /></AdminLayout></RequireAuth>} />
      <Route path="/admin/products" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><ProductManagePage basePath="/admin/products" /></AdminLayout></RequireAuth>} />
      <Route path="/admin/products/new" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><ProductFormPage basePath="/admin/products" /></AdminLayout></RequireAuth>} />
      <Route path="/admin/products/:id/edit" element={<RequireAuth roles={['ADMIN']} loginPath="/admin/login"><AdminLayout><ProductFormPage basePath="/admin/products" /></AdminLayout></RequireAuth>} />

      {/* UC6 - Người bán quản lý sản phẩm của gian hàng (trong giao diện shop) */}
      <Route path="/manage/orders" element={<RequireAuth roles={['SELLER', 'ADMIN']}><ShopLayout><SellerOrdersPage /></ShopLayout></RequireAuth>} />
      <Route path="/manage/promotions" element={<RequireAuth roles={['SELLER', 'ADMIN']}><ShopLayout><PromotionManagePage /></ShopLayout></RequireAuth>} />
      <Route path="/manage/support" element={<RequireAuth roles={['SELLER', 'ADMIN']}><ShopLayout><SellerSupportPage /></ShopLayout></RequireAuth>} />
      <Route path="/manage/reviews" element={<RequireAuth roles={['SELLER', 'ADMIN']}><ShopLayout><SellerReviewsPage /></ShopLayout></RequireAuth>} />
      <Route path="/manage/products" element={<RequireAuth roles={['SELLER', 'ADMIN']}><ShopLayout><ProductManagePage /></ShopLayout></RequireAuth>} />
      <Route path="/manage/products/new" element={<RequireAuth roles={['SELLER', 'ADMIN']}><ShopLayout><ProductFormPage /></ShopLayout></RequireAuth>} />
      <Route path="/manage/products/:id/edit" element={<RequireAuth roles={['SELLER', 'ADMIN']}><ShopLayout><ProductFormPage /></ShopLayout></RequireAuth>} />
    </Routes>
  );
}
