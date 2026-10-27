import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Bố cục riêng cho khu QUẢN TRỊ — tách biệt hoàn toàn giao diện Khách hàng/Người bán.
// Không có phần duyệt sản phẩm, gợi ý hay phân tích dáng người.
const NAV = [
  { to: '/admin', label: 'Người dùng', end: true },
  { to: '/admin/products', label: 'Sản phẩm' },
  { to: '/admin/categories', label: 'Danh mục' },
  { to: '/admin/complaints', label: 'Khiếu nại' },
  { to: '/admin/reviews', label: 'Đánh giá' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-slate-900 text-slate-100">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center gap-x-6 gap-y-1 py-2 md:py-0 md:h-14">
          <span className="order-1 font-bold text-white">DressSense <span className="text-indigo-400">Admin</span></span>
          <div className="order-2 md:order-3 ml-auto flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-slate-300">{user?.fullName}</span>
            <button onClick={() => { logout(); nav('/admin/login'); }} className="text-red-300 hover:text-red-200">Đăng xuất</button>
          </div>
          <nav className="order-3 md:order-2 w-full md:w-auto flex gap-1 text-sm overflow-x-auto">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => `px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
