import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AuthCard, PendingBadge } from '../../components/ui';

export default function SellerPendingPage() {
  const { user, logout } = useAuth();
  return (
    <AuthCard url="seller.dressense.vn" title="Gian hàng" badge={<PendingBadge />}>
      <p className="text-sm text-gray-600 mb-2">
        Xin chào <b>{user?.fullName}</b> ({user?.shopName}).
      </p>
      <p className="text-sm text-gray-500 mb-4">
        Hồ sơ người bán của bạn đang <b className="text-amber-600">chờ Quản trị viên kiểm duyệt</b>.
        Bạn có thể hoàn thiện hồ sơ gian hàng trong lúc chờ; các chức năng bán hàng sẽ mở sau khi được phê duyệt (UC16.3).
      </p>
      <button onClick={logout} className="text-sm text-red-500 hover:underline">Đăng xuất</button>
      <Link to="/" className="block text-indigo-600 text-sm hover:underline mt-2">← Về trang mua sắm</Link>
    </AuthCard>
  );
}
