import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_AVATAR } from '../lib/placeholder';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const avatar = user?.avatarUrl
    ? (import.meta.env.VITE_API_URL?.replace('/api', '') + user.avatarUrl)
    : DEFAULT_AVATAR;

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold text-brand" onClick={close}>
          DressSense
        </Link>

        {/* Menu ngang - máy tính / tablet */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          <Link to="/" className="hover:text-brand">Sản phẩm</Link>
          {user && <Link to="/recommendations" className="hover:text-brand">Gợi ý cho bạn</Link>}
          {user ? (
            <>
              {user.role === 'SELLER' && (
                <Link to="/manage/products" className="text-indigo-600 hover:underline">Quản lý gian hàng</Link>
              )}
              <Link to="/profile" className="flex items-center gap-2 hover:text-brand">
                <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover bg-gray-100" />
                {user.fullName}
              </Link>
              <button onClick={logout} className="text-red-500 hover:underline">Đăng xuất</button>
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

        {/* Nút mở menu - điện thoại */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 -mr-2 text-gray-600"
          aria-label="Mở menu" aria-expanded={open}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* Bảng menu xổ xuống - điện thoại */}
      {open && (
        <div className="md:hidden border-t bg-white px-4 py-2 flex flex-col text-sm">
          {user && (
            <Link to="/profile" onClick={close} className="flex items-center gap-2 py-2.5 font-medium border-b">
              <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-100" />
              {user.fullName}
            </Link>
          )}
          <Link to="/" onClick={close} className="py-2.5 hover:text-brand">Sản phẩm</Link>
          {user && <Link to="/recommendations" onClick={close} className="py-2.5 hover:text-brand">Gợi ý cho bạn</Link>}
          {user?.role === 'SELLER' && (
            <Link to="/manage/products" onClick={close} className="py-2.5 text-indigo-600">Quản lý gian hàng</Link>
          )}
          {user ? (
            <button onClick={() => { close(); logout(); }} className="py-2.5 text-left text-red-500">Đăng xuất</button>
          ) : (
            <>
              <Link to="/login" onClick={close} className="py-2.5 hover:text-brand">Đăng nhập</Link>
              <Link to="/register" onClick={close} className="py-2.5 text-brand font-medium">Đăng ký</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
