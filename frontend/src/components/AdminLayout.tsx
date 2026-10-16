import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Bố cục riêng cho khu QUẢN TRỊ — tách biệt hoàn toàn giao diện Khách hàng/Người bán.
// Không có phần duyệt sản phẩm, gợi ý hay phân tích dáng người.
const NAV = [
  { to: '/admin', label: 'Người dùng', end: true },
  { to: '/admin/products', label: 'Sản phẩm' },
  { to: '/admin/categories', label: 'Danh mục' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-slate-900 text-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-bold text-white">DressSense <span className="text-indigo-400">Admin</span></span>
            <nav className="flex gap-1 text-sm">
              {NAV.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end}
                  className={({ isActive }) => `px-3 py-1.5 rounded-md transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-300">{user?.fullName}</span>
            <button onClick={() => { logout(); nav('/admin/login'); }} className="text-red-300 hover:text-red-200">Đăng xuất</button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
