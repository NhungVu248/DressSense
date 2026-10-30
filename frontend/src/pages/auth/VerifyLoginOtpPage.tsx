import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { getErrorMessage } from '../../lib/api';
import { AuthCard, Field, PrimaryButton, ErrorBox } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { routeAfterLogin } from '../../lib/postLogin';

// OTP đăng nhập lần đầu (dùng chung cho Khách hàng / Người bán / Admin)
export default function VerifyLoginOtpPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { verifyLoginOtp } = useAuth();
  const state = (loc.state || {}) as { identifier?: string; rememberMe?: boolean; devOtp?: string; target?: string };
  const [code, setCode] = useState(state.devOtp || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!state.identifier) return <Navigate to="/login" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await verifyLoginOtp(state.identifier!, code, state.rememberMe);
      routeAfterLogin(r, nav);
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }

  return (
    <AuthCard url="dressense.vn/verify-login" title="Xác thực đăng nhập">
      <form onSubmit={submit}>
        <ErrorBox message={error} />
        <p className="text-sm text-gray-500 mb-4">
          Đăng nhập lần đầu cần xác thực. Mã OTP đã gửi tới <b>{state.target}</b>.
          {state.devOtp && <span className="block text-xs text-gray-400 mt-1">(DEV OTP: {state.devOtp})</span>}
        </p>
        <Field label="Mã OTP (6 số)" placeholder="______" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={6} />
        <PrimaryButton type="submit" disabled={loading}>{loading ? 'Đang xác thực…' : 'Xác nhận'}</PrimaryButton>
      </form>
    </AuthCard>
  );
}
