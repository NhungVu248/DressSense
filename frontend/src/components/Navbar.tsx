import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-brand">
          DressSense
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/" className="hover:text-brand">Sản phẩm</Link>
          {user ? (
            <>
              <span className="text-gray-600">Xin chào, {user.fullName}</span>
              <button onClick={logout} className="text-red-500 hover:underline">
                Đăng xuất
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-brand">Đăng nhập</Link>
              <Link to="/register" className="bg-brand text-white px-3 py-1.5 rounded-md hover:bg-brand-dark">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
