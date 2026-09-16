import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type User } from '../context/AuthContext';

interface RequireAuthProps {
  children: ReactNode;
  roles?: Array<User['role']>;
}

// UC1.4/1.5/1.6 - 2E: phiên hết hạn/không hợp lệ -> điều hướng về đăng nhập
// UC1.7 - tham số roles: giới hạn theo vai trò (ví dụ chỉ ADMIN mới vào được /admin)
export default function RequireAuth({ children, roles }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <p className="text-center py-10 text-gray-400">Đang tải...</p>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
