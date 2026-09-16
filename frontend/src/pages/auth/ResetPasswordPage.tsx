import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { AuthCard, Field, PrimaryButton, ErrorBox } from '../../components/ui';

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const state = (useLocation().state || {}) as { identifier?: string; code?: string };
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!state.identifier || !state.code) {
    return (
      <AuthCard url="dressense.vn/reset-password" title="Bước 3 · Đặt mật khẩu mới">
        <p className="text-sm text-gray-500">Phiên đặt lại không hợp lệ. Vui lòng bắt đầu lại.</p>
        <Link to="/forgot-password" className="text-indigo-600 text-sm hover:underline">← Khôi phục mật khẩu</Link>
      </AuthCard>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/auth/password/reset', {
        identifier: state.identifier, code: state.code, newPassword, confirmPassword,
      });
      alert('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.');
      nav('/login');
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }

  return (
    <AuthCard url="dressense.vn/reset-password" title="Bước 3 · Đặt mật khẩu mới">
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        <Field label="Mật khẩu mới" type="password" placeholder="••••••••" hint="Tối thiểu 8 ký tự, gồm chữ và số"
          value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        <Field label="Xác nhận mật khẩu mới" type="password" placeholder="••••••••"
          value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Đang lưu...' : 'Đặt lại mật khẩu'}
        </PrimaryButton>
      </form>
      <p className="text-xs text-gray-400 mt-3">
        Sau khi đổi thành công, mã OTP bị vô hiệu hóa và bạn có thể đăng nhập bằng mật khẩu mới.
      </p>
    </AuthCard>
  );
}
