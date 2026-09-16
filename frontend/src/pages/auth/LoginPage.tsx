import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../lib/api';
import { AuthCard, Field, PrimaryButton, OrDivider, ErrorBox } from '../../components/ui';
import GoogleLoginButton from '../../components/GoogleLoginButton';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
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
      navigate(redirect || '/');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthCard url="dressense.vn/login" title="Đăng nhập">
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        <Field label="Email hoặc số điện thoại" placeholder="name@example.com"
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
      <OrDivider />
      <GoogleLoginButton text="continue_with" onError={setError} />
      <p className="text-center text-sm text-gray-500 mt-4">
        Chưa có tài khoản? <Link to="/register" className="text-indigo-600 hover:underline">Đăng ký</Link>
      </p>
    </AuthCard>
  );
}
