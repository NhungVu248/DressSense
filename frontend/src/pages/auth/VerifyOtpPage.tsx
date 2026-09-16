import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { AuthCard, PrimaryButton, ErrorBox } from '../../components/ui';

export default function VerifyOtpPage() {
  const nav = useNavigate();
  const { setSession } = useAuth();
  const state = (useLocation().state || {}) as {
    identifier?: string; purpose?: 'REGISTER' | 'RESET_PASSWORD';
    target?: string; expiresAt?: string; devOtp?: string;
  };

  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | undefined>(state.expiresAt);
  const [devOtp, setDevOtp] = useState<string | undefined>(state.devOtp);
  const [remaining, setRemaining] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Đếm ngược thời hạn OTP
  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (!state.identifier || !state.purpose) {
    return (
      <AuthCard url="dressense.vn/verify-otp" title="Xác thực mã OTP">
        <p className="text-sm text-gray-500">Phiên xác thực không hợp lệ. Vui lòng bắt đầu lại.</p>
        <Link to="/login" className="text-indigo-600 text-sm hover:underline">← Về đăng nhập</Link>
      </AuthCard>
    );
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  // Ghi trực tiếp 1 chữ số vào đúng ô theo index, không phụ thuộc DOM value
  // (tránh việc trình duyệt/tiện ích tự điền gợi ý ghi đè số vừa gõ vào ô kế tiếp)
  function setDigitAt(i: number, value: string) {
    setDigits((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    // Chặn hành vi gõ mặc định của trình duyệt, tự quản lý toàn bộ giá trị qua state
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      setDigitAt(i, e.key);
      if (i < 5) inputs.current[i + 1]?.focus();
      return;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) {
        setDigitAt(i, '');
      } else if (i > 0) {
        setDigitAt(i - 1, '');
        inputs.current[i - 1]?.focus();
      }
      return;
    }
    if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      inputs.current[i - 1]?.focus();
      return;
    }
    if (e.key === 'ArrowRight' && i < 5) {
      e.preventDefault();
      inputs.current[i + 1]?.focus();
      return;
    }
    // Cho phép Tab, Shift, Ctrl... đi qua; chặn mọi ký tự khác (chữ, ký hiệu)
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
    }
  }

  // Dán mã OTP đầy đủ (ví dụ copy từ tin nhắn) vào bất kỳ ô nào
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = ['', '', '', '', '', ''];
    for (let k = 0; k < text.length; k++) next[k] = text[k];
    setDigits(next);
    inputs.current[Math.min(text.length, 5)]?.focus();
  }

  async function resend() {
    setError('');
    try {
      const res = await api.post('/auth/otp/resend', { identifier: state.identifier, purpose: state.purpose });
      setExpiresAt(res.data.expiresAt);
      setDevOtp(res.data.devOtp);
      setDigits(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch (err) { setError(getErrorMessage(err)); }
  }

  async function confirm() {
    const code = digits.join('');
    if (code.length !== 6) { setError('Vui lòng nhập đủ 6 chữ số'); return; }
    setError(''); setLoading(true);
    try {
      if (state.purpose === 'REGISTER') {
        const res = await api.post('/auth/register/verify', { identifier: state.identifier, code });
        setSession(res.data.token, res.data.user);
        nav(res.data.redirect || '/');
      } else {
        // Khôi phục MK: mang code sang bước đặt mật khẩu mới
        nav('/reset-password', { state: { identifier: state.identifier, code } });
      }
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }

  return (
    <AuthCard url="dressense.vn/verify-otp" title="Xác thực mã OTP">
      <p className="text-sm text-gray-500 mb-4">
        Mã xác thực đã gửi tới <b className="text-gray-700">{state.target || state.identifier}</b>
      </p>
      <ErrorBox message={error} />
      <div className="flex gap-2 mb-3">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            value={d}
            onChange={() => {}} // giá trị được ghi qua onKeyDown/onPaste, không qua sự kiện input
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={onPaste}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            type="text"
            autoComplete="one-time-code"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            maxLength={1}
            className="w-11 h-12 text-center text-xl font-semibold border border-gray-300 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-sm mb-4">
        <span className="text-gray-400">{remaining > 0 ? `Còn hiệu lực ${mm}:${ss}` : 'Mã đã hết hạn'}</span>
        <button onClick={resend} className="text-indigo-600 hover:underline">Gửi lại mã</button>
      </div>
      {devOtp && (
        <div className="bg-amber-50 text-amber-700 text-xs rounded-lg px-3 py-2 mb-4">
          [Chế độ phát triển] Mã OTP: <b>{devOtp}</b>
        </div>
      )}
      <PrimaryButton onClick={confirm} disabled={loading}>
        {loading ? 'Đang xác thực...' : 'Xác nhận'}
      </PrimaryButton>
      <p className="text-xs text-gray-400 mt-3">
        Dùng chung cho đăng ký (UC1.1) và khôi phục mật khẩu (UC1.3).
      </p>
    </AuthCard>
  );
}
