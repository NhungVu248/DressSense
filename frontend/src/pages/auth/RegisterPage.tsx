import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { AuthCard, Field, PrimaryButton, OrDivider, ErrorBox } from '../../components/ui';
import GoogleLoginButton from '../../components/GoogleLoginButton';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', identifier: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/register/request', { portal: 'customer', ...form });
      navigate('/verify-otp', { state: { ...res.data, identifier: res.data.identifier, purpose: 'REGISTER' } });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally { setLoading(false); }
  }

  return (
    <AuthCard url="dressense.vn/register" title="Đăng ký tài khoản">
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        <Field label="Họ và tên" placeholder="Nguyễn Văn A" value={form.fullName} onChange={set('fullName')} required />
        <Field label="Email hoặc số điện thoại" placeholder="name@example.com" value={form.identifier} onChange={set('identifier')} required />
        <Field label="Mật khẩu" type="password" placeholder="••••••••" hint="Tối thiểu 8 ký tự, gồm chữ và số"
          value={form.password} onChange={set('password')} required />
        <Field label="Xác nhận mật khẩu" type="password" placeholder="••••••••"
          value={form.confirmPassword} onChange={set('confirmPassword')} required />
        <PrimaryButton type="submit" disabled={loading}>
          {loading ? 'Đang xử lý...' : 'Tạo tài khoản'}
        </PrimaryButton>
      </form>
      <OrDivider />
      <GoogleLoginButton text="signup_with" onError={setError} />
      <p className="text-center text-sm text-gray-500 mt-4">
        Đã có tài khoản? <Link to="/login" className="text-indigo-600 hover:underline">Đăng nhập</Link>
      </p>
    </AuthCard>
  );
}
