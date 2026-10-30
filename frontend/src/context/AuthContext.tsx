import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import api from '../lib/api';
import { getToken, setToken, clearToken } from '../lib/token';

export interface User {
  id: number;
  email: string | null;
  phone: string | null;
  fullName: string;
  role: 'CUSTOMER' | 'SELLER' | 'ADMIN';
  status: 'ACTIVE' | 'PENDING_APPROVAL' | 'LOCKED' | 'DISABLED';
  avatarUrl: string | null;
  shopName: string | null;
  marketingOptIn?: boolean; // UC13.3 - nhận thông báo khuyến mãi
}

interface LoginResult {
  redirect?: string;
  pendingApproval?: boolean;
  user?: User;
  // Bảo mật mật khẩu
  needOtp?: boolean; // đăng nhập lần đầu -> cần OTP
  target?: string; // nơi nhận OTP (đã che)
  devOtp?: string; // chỉ ở môi trường dev
  mustChangePassword?: boolean; // hết hạn/buộc đổi
  passwordExpiresInDays?: number | null; // cảnh báo sắp hết hạn
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<LoginResult>;
  verifyLoginOtp: (identifier: string, code: string, rememberMe?: boolean) => Promise<LoginResult>;
  setSession: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    api.get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(identifier: string, password: string, rememberMe?: boolean): Promise<LoginResult> {
    const res = await api.post('/auth/login', { identifier, password, rememberMe });
    // Đăng nhập lần đầu: chưa có token, chuyển sang bước OTP
    if (res.data.needOtp) {
      return { needOtp: true, target: res.data.target, devOtp: res.data.devOtp };
    }
    setToken(res.data.token);
    setUser(res.data.user);
    return {
      redirect: res.data.redirect, pendingApproval: res.data.pendingApproval, user: res.data.user,
      mustChangePassword: res.data.mustChangePassword, passwordExpiresInDays: res.data.passwordExpiresInDays,
    };
  }

  async function verifyLoginOtp(identifier: string, code: string, rememberMe?: boolean): Promise<LoginResult> {
    const res = await api.post('/auth/login/verify-otp', { identifier, code, rememberMe });
    setToken(res.data.token);
    setUser(res.data.user);
    return {
      redirect: res.data.redirect, pendingApproval: res.data.pendingApproval, user: res.data.user,
      mustChangePassword: res.data.mustChangePassword, passwordExpiresInDays: res.data.passwordExpiresInDays,
    };
  }

  function setSession(token: string, u: User) {
    setToken(token);
    setUser(u);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, verifyLoginOtp, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider');
  return ctx;
}
