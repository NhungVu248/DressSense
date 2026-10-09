import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProductsPage from './pages/ProductsPage';
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
import CategoryManagePage from './pages/admin/CategoryManagePage';
import RequireAuth from './components/RequireAuth';

// Bố cục trang mua sắm (có Navbar)
function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {children}
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Trang mua sắm */}
      <Route path="/" element={<ShopLayout><ProductsPage /></ShopLayout>} />

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

      {/* UC3.1 - Phân tích dáng người bằng AI */}
      <Route path="/profile/body" element={<RequireAuth><ShopLayout><BodyAnalysisPage /></ShopLayout></RequireAuth>} />

      {/* UC5 - Gợi ý sản phẩm cá nhân hóa */}
      <Route path="/recommendations" element={<RequireAuth><ShopLayout><RecommendationsPage /></ShopLayout></RequireAuth>} />

      {/* UC1.7 - Phân quyền người dùng (chỉ ADMIN) */}
      <Route path="/admin" element={<RequireAuth roles={['ADMIN']}><ShopLayout><AdminUsersPage /></ShopLayout></RequireAuth>} />

      {/* UC6 - Quản lý sản phẩm (Người bán + Quản trị viên) */}
      <Route path="/manage/products" element={<RequireAuth roles={['SELLER', 'ADMIN']}><ShopLayout><ProductManagePage /></ShopLayout></RequireAuth>} />
      <Route path="/manage/products/new" element={<RequireAuth roles={['SELLER', 'ADMIN']}><ShopLayout><ProductFormPage /></ShopLayout></RequireAuth>} />
      <Route path="/manage/products/:id/edit" element={<RequireAuth roles={['SELLER', 'ADMIN']}><ShopLayout><ProductFormPage /></ShopLayout></RequireAuth>} />
      {/* UC6.2 - Quản lý danh mục (chỉ ADMIN) */}
      <Route path="/admin/categories" element={<RequireAuth roles={['ADMIN']}><ShopLayout><CategoryManagePage /></ShopLayout></RequireAuth>} />
    </Routes>
  );
}
