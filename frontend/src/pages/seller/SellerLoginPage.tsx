import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../lib/api';
import { AuthCard, Field, PrimaryButton, ErrorBox } from '../../components/ui';

export default function SellerLoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { redirect } = await login(identifier, password, remember);
      nav(redirect || '/seller');
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }

  return (
    <AuthCard url="seller.dressense.vn/login" title="Đăng nhập người bán">
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        <Field label="Email hoặc số điện thoại" placeholder="seller@example.com"
          value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        <Field label="Mật khẩu" type="password" placeholder="••••••••"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        <div className="flex items-center justify-between mb-5 text-sm">
          <label className="flex items-center gap-2 text-gray-600">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Ghi nhớ đăng nhập
          </label>
          <Link to="/forgot-password" className="text-indigo-600 hover:underline">Quên mật khẩu?</Link>
        </div>
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </PrimaryButton>
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        Chưa có gian hàng? <Link to="/seller/register" className="text-indigo-600 hover:underline">Đăng ký người bán</Link>
      </p>
      <p className="text-xs text-gray-400 mt-3">
        Tài khoản chờ duyệt đăng nhập được vào khu vực hoàn thiện hồ sơ nhưng chưa mở chức năng bán hàng (UC1.2 – 8a).
      </p>
    </AuthCard>
  );
}
