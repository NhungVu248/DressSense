import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { AuthCard, Field, PrimaryButton, ErrorBox } from '../../components/ui';

// Admin quên mật khẩu -> gửi yêu cầu, chờ admin khác cấp
export default function AdminForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await api.post('/auth/admin/forgot', { email });
      setDone(r.data.message);
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }

  return (
    <AuthCard url="admin.dressense.vn/forgot-password" title="Quên mật khẩu quản trị">
      {done ? (
        <p className="text-sm text-green-600">{done}</p>
      ) : (
        <form onSubmit={submit}>
          <ErrorBox message={error} />
          <p className="text-sm text-gray-500 mb-4">Nhập email quản trị. Một Quản trị viên khác sẽ cấp mật khẩu mới và gửi qua email đã đăng ký; bạn đăng nhập (kèm OTP) rồi đổi mật khẩu.</p>
          <Field label="Email quản trị" type="email" placeholder="admin@dresssense.vn" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <PrimaryButton type="submit" disabled={loading}>{loading ? 'Đang gửi…' : 'Gửi yêu cầu'}</PrimaryButton>
        </form>
      )}
      <p className="text-center text-sm text-gray-500 mt-4"><Link to="/admin/login" className="text-brand hover:underline">← Về đăng nhập</Link></p>
    </AuthCard>
  );
}
