import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { AuthCard, Field, PrimaryButton, ErrorBox, PendingBadge } from '../../components/ui';

export default function SellerRegisterPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    fullName: '', identifier: '', password: '', confirmPassword: '', shopName: '', contactPhone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/register/request', { portal: 'seller', ...form });
      nav('/verify-otp', { state: { ...res.data, identifier: res.data.identifier, purpose: 'REGISTER' } });
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }

  return (
    <AuthCard url="seller.dressense.vn/register" title="Đăng ký người bán" badge={<PendingBadge />}>
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        <Field label="Họ và tên chủ tài khoản" placeholder="Trần Thị B" value={form.fullName} onChange={set('fullName')} required />
        <Field label="Email hoặc số điện thoại" placeholder="seller@example.com" value={form.identifier} onChange={set('identifier')} required />
        <Field label="Mật khẩu" type="password" placeholder="••••••••" hint="Tối thiểu 8 ký tự, gồm chữ và số"
          value={form.password} onChange={set('password')} required />
        <Field label="Xác nhận mật khẩu" type="password" placeholder="••••••••"
          value={form.confirmPassword} onChange={set('confirmPassword')} required />
        <Field label="Tên gian hàng" placeholder="Gian hàng thời trang B" value={form.shopName} onChange={set('shopName')} required />
        <Field label="Thông tin liên hệ kinh doanh" placeholder="0900 000 000" value={form.contactPhone} onChange={set('contactPhone')} />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Đăng ký gian hàng'}
        </PrimaryButton>
      </form>
      <p className="text-xs text-gray-400 mt-3">
        Tài khoản tạo với vai trò Người bán, chờ Quản trị viên phê duyệt (UC16.3) trước khi mở đầy đủ quyền bán hàng.
      </p>
      <p className="text-center text-sm text-gray-500 mt-3">
        Đã có gian hàng? <Link to="/seller/login" className="text-indigo-600 hover:underline">Đăng nhập người bán</Link>
      </p>
    </AuthCard>
  );
}
