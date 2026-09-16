import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { AuthCard, Field, PrimaryButton, ErrorBox } from '../../components/ui';

export default function ForgotPasswordPage() {
  const nav = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/password/forgot', { identifier });
      nav('/verify-otp', { state: { identifier, purpose: 'RESET_PASSWORD', ...res.data } });
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }

  return (
    <AuthCard url="dressense.vn/forgot-password" title="Bước 1 · Nhập tài khoản">
      <p className="text-sm text-gray-500 mb-4">
        Nhập email hoặc số điện thoại đã đăng ký để nhận mã xác thực.
      </p>
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        <Field label="Email hoặc số điện thoại" placeholder="name@example.com"
          value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Đang gửi...' : 'Gửi mã xác thực'}
        </PrimaryButton>
      </form>
      <p className="text-xs text-gray-400 mt-3">
        Vì lý do bảo mật, hệ thống hiển thị thông báo trung lập, không tiết lộ tài khoản có tồn tại hay không.
      </p>
      <Link to="/login" className="text-indigo-600 text-sm hover:underline block mt-3">← Về đăng nhập</Link>
    </AuthCard>
  );
}
