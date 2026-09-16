import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// Tải script Google Identity Services (chỉ 1 lần)
let gsiPromise: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.id) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Không tải được Google. Kiểm tra kết nối mạng.'));
    document.head.appendChild(s);
  });
  return gsiPromise;
}

export default function GoogleLoginButton({
  text = 'continue_with',
  onError,
}: {
  text?: 'continue_with' | 'signup_with';
  onError?: (msg: string) => void;
}) {
  const { setSession } = useAuth();
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !ref.current) return;
        const g = (window as any).google;
        g.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async (resp: any) => {
            try {
              const res = await api.post('/auth/google', { credential: resp.credential });
              setSession(res.data.token, res.data.user);
              nav(res.data.redirect || '/');
            } catch (e) {
              onError?.(getErrorMessage(e));
            }
          },
        });
        g.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          text,
          locale: 'vi',
          width: 360,
        });
      })
      .catch((e) => onError?.(e.message));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) {
    return (
      <div className="w-full border border-dashed border-gray-300 rounded-lg py-2.5 text-center text-xs text-gray-400">
        Đăng nhập Google chưa cấu hình (thiếu VITE_GOOGLE_CLIENT_ID)
      </div>
    );
  }
  return <div ref={ref} className="flex justify-center min-h-[44px]" />;
}
