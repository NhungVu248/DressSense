import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../lib/api';
import { AuthCard, Field, PrimaryButton, ErrorBox } from '../../components/ui';
import { routeAfterLogin } from '../../lib/postLogin';

// Cổng đăng nhập QUẢN TRỊ VIÊN (luồng riêng, song song với Khách hàng & Người bán).
export default function AdminLoginPage() {
  const { login, logout } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await login(identifier, password);
      if (r.needOtp) {
        nav('/verify-login-otp', { state: { identifier, devOtp: r.devOtp, target: r.target } });
        return;
      }
      if (r.user!.role !== 'ADMIN') { logout(); setError('Tài khoản này không có quyền quản trị.'); return; }
      routeAfterLogin({ ...r, redirect: '/admin' }, nav);
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }

  return (
    <AuthCard url="admin.dressense.vn/login" title="Bảng quản trị DressSense">
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        <Field label="Email quản trị" placeholder="admin@dresssense.vn"
          value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        <Field label="Mật khẩu" type="password" placeholder="••••••••"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập quản trị'}
        </PrimaryButton>
      </form>
      <p className="text-xs text-gray-400 mt-4">
        Khu vực dành riêng cho Quản trị viên (quản lý người dùng, danh mục, sản phẩm, tri thức thời trang).
        Khách hàng và Người bán đăng nhập ở cổng riêng.
      </p>
    </AuthCard>
  );
}
