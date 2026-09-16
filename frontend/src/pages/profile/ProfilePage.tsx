import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { useAuth, type User } from '../../context/AuthContext';

interface ProfileData {
  user: User;
  addresses: any[];
  missingFields: string[];
  customerProfile: { styleDeclaredAt: string | null } | null;
}

const roleLabel: Record<string, string> = {
  CUSTOMER: 'Khách hàng', SELLER: 'Người bán', ADMIN: 'Quản trị viên',
};
const statusLabel: Record<string, { text: string; cls: string }> = {
  ACTIVE: { text: 'Đã kích hoạt', cls: 'bg-green-100 text-green-700' },
  PENDING_APPROVAL: { text: 'Chờ kiểm duyệt', cls: 'bg-amber-100 text-amber-700' },
  LOCKED: { text: 'Tạm khóa', cls: 'bg-red-100 text-red-700' },
  DISABLED: { text: 'Đã vô hiệu hóa', cls: 'bg-gray-200 text-gray-600' },
};

// UC1.4 - Xem hồ sơ
export default function ProfilePage() {
  const { user: authUser } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/users/me')
      .then((res) => setData(res.data))
      .catch((err) => setError(getErrorMessage(err)));
  }, []);

  if (error) return <p className="max-w-2xl mx-auto px-4 py-10 text-red-500">{error}</p>;
  if (!data) return <p className="max-w-2xl mx-auto px-4 py-10 text-gray-400">Đang tải hồ sơ...</p>;

  const { user, addresses, missingFields, customerProfile } = data;
  const status = statusLabel[user.status];
  const defaultAddress = addresses.find((a) => a.isDefault);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Hồ sơ cá nhân</h1>

      <div className="bg-white rounded-xl border p-6 flex items-start gap-5 mb-5">
        <img
          src={user.avatarUrl ? (import.meta.env.VITE_API_URL?.replace('/api', '') + user.avatarUrl) : 'https://via.placeholder.com/96'}
          alt="avatar"
          className="w-20 h-20 rounded-full object-cover bg-gray-100"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">{user.fullName}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full ${status.cls}`}>{status.text}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{roleLabel[user.role]}</span>
          </div>
          {user.shopName && <p className="text-sm text-gray-500 mt-0.5">Gian hàng: {user.shopName}</p>}
          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex gap-2"><dt className="text-gray-400 w-16">Email</dt><dd>{user.email || <em className="text-gray-300">chưa có</em>}</dd></div>
            <div className="flex gap-2"><dt className="text-gray-400 w-16">SĐT</dt><dd>{user.phone || <em className="text-gray-300">chưa có</em>}</dd></div>
          </dl>
        </div>
        <Link to="/profile/edit" className="text-sm text-indigo-600 hover:underline whitespace-nowrap">Chỉnh sửa</Link>
      </div>

      {missingFields.length > 0 && (
        <div className="bg-amber-50 text-amber-700 text-sm rounded-lg px-4 py-3 mb-5">
          Hồ sơ còn thiếu: {missingFields.join(', ')}. <Link to="/profile/edit" className="underline font-medium">Bổ sung ngay</Link>
        </div>
      )}

      <div className="bg-white rounded-xl border p-6 flex items-center justify-between">
        <div>
          <h3 className="font-medium">Sổ địa chỉ giao hàng</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {defaultAddress
              ? `Mặc định: ${defaultAddress.recipientName} · ${defaultAddress.detail}, ${defaultAddress.ward}, ${defaultAddress.district}, ${defaultAddress.province}`
              : `${addresses.length} địa chỉ đã lưu`}
          </p>
        </div>
        <Link to="/profile/addresses" className="text-sm text-indigo-600 hover:underline whitespace-nowrap">Quản lý →</Link>
      </div>

      {/* UC2.1 - Hồ sơ cá nhân hóa (sở thích, ngân sách, dịp sử dụng) */}
      <div className="bg-white rounded-xl border p-6 flex items-center justify-between mt-5">
        <div>
          <h3 className="font-medium">Hồ sơ cá nhân hóa</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {customerProfile?.styleDeclaredAt
              ? 'Đã khai báo sở thích, ngân sách và dịp sử dụng.'
              : 'Cho AI hiểu gu thời trang của bạn để gợi ý chính xác hơn.'}
          </p>
        </div>
        <Link to="/profile/personalization" className="text-sm text-indigo-600 hover:underline whitespace-nowrap">
          {customerProfile?.styleDeclaredAt ? 'Quản lý →' : 'Thiết lập ngay →'}
        </Link>
      </div>

      {/* UC2.2 - Thông tin size theo danh mục */}
      <div className="bg-white rounded-xl border p-6 flex items-center justify-between mt-5">
        <div>
          <h3 className="font-medium">Thông tin size</h3>
          <p className="text-sm text-gray-500 mt-0.5">Lưu size theo từng danh mục để đặt hàng nhanh và đúng kích cỡ.</p>
        </div>
        <Link to="/profile/sizes" className="text-sm text-indigo-600 hover:underline whitespace-nowrap">Quản lý →</Link>
      </div>

      {authUser?.role === 'SELLER' && (
        <div className="bg-white rounded-xl border p-6 mt-5">
          <h3 className="font-medium mb-1">Thông tin gian hàng</h3>
          <p className="text-sm text-gray-500">Quản lý sản phẩm và đơn hàng tại cổng người bán.</p>
        </div>
      )}
    </div>
  );
}
