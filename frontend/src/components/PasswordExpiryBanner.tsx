import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Cảnh báo mật khẩu sắp hết hạn (hiện khi còn <= 7 ngày; thông báo 7/3/24h cuối).
export default function PasswordExpiryBanner() {
  const loc = useLocation();
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem('pwWarnDays');
      setDays(v != null ? Number(v) : null);
    } catch { setDays(null); }
  }, [loc.pathname]);

  if (days == null || loc.pathname === '/change-password') return null;

  return (
    <div className="bg-amber-100 text-amber-900 text-sm px-4 py-2 flex items-center justify-center gap-3">
      <span>⚠️ Mật khẩu của bạn sẽ hết hạn sau <b>{days} ngày</b>. <Link to="/change-password" className="underline font-medium">Đổi ngay</Link></span>
      <button onClick={() => { try { sessionStorage.removeItem('pwWarnDays'); } catch { /* bỏ qua */ } setDays(null); }}
        aria-label="Đóng" className="text-amber-700 hover:text-amber-900">✕</button>
    </div>
  );
}
