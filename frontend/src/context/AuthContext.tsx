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
}

interface LoginResult {
  redirect: string;
  pendingApproval?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<LoginResult>;
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
    setToken(res.data.token);
    setUser(res.data.user);
    return { redirect: res.data.redirect, pendingApproval: res.data.pendingApproval };
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
    <AuthContext.Provider value={{ user, loading, login, setSession, logout }}>
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
