import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { AuthCard, Field, PrimaryButton, ErrorBox, PasswordChecklist } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

// Đổi mật khẩu (hết hạn 30 ngày / buộc đổi / đổi chủ động)
export default function ChangePasswordPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const home = user?.role === 'ADMIN' ? '/admin' : user?.role === 'SELLER' ? '/seller' : '/';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/auth/password/change', { currentPassword: cur, newPassword: pw, confirmPassword: confirm });
      try { sessionStorage.removeItem('pwWarnDays'); } catch { /* bỏ qua */ }
      setDone(true);
      setTimeout(() => nav(home), 1200);
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }

  return (
    <AuthCard url="dressense.vn/change-password" title="Đổi mật khẩu">
      {done ? (
        <p className="text-sm text-green-600">Đổi mật khẩu thành công. Đang chuyển hướng…</p>
      ) : (
        <form onSubmit={submit}>
          <ErrorBox message={error} />
          <p className="text-sm text-gray-500 mb-4">Vì lý do bảo mật (mật khẩu hết hạn 30 ngày hoặc được yêu cầu), vui lòng đặt mật khẩu mới.</p>
          <Field label="Mật khẩu hiện tại" type="password" placeholder="••••••••" value={cur} onChange={(e) => setCur(e.target.value)} required />
          <Field label="Mật khẩu mới" type="password" placeholder="••••••••" value={pw} onChange={(e) => setPw(e.target.value)} required />
          <PasswordChecklist value={pw} />
          <Field label="Xác nhận mật khẩu mới" type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          <PrimaryButton type="submit" disabled={loading}>{loading ? 'Đang đổi…' : 'Đổi mật khẩu'}</PrimaryButton>
        </form>
      )}
    </AuthCard>
  );
}
