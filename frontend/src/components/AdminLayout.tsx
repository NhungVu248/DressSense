import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Bố cục khu QUẢN TRỊ - đồng bộ phong cách Figma (nền kem, xanh ô-liu, serif).
// Sidebar nhóm chức năng; tách biệt hoàn toàn giao diện Khách hàng/Người bán.
const NAV_GROUPS: { heading: string; items: { to: string; label: string; end?: boolean }[] }[] = [
  {
    heading: 'Quản trị',
    items: [
      { to: '/admin', label: 'Tổng quan', end: true }, // UC16.1
      { to: '/admin/users', label: 'Người dùng' }, // UC16.2
      { to: '/admin/categories', label: 'Danh mục' },
      { to: '/admin/products', label: 'Sản phẩm' },
      { to: '/admin/settings', label: 'Cấu hình hệ thống' }, // UC16.5
      { to: '/admin/password-resets', label: 'Cấp lại mật khẩu' }, // admin quên MK
    ],
  },
  {
    heading: 'Kiểm duyệt',
    items: [
      { to: '/admin/shops', label: 'Gian hàng' },
      { to: '/admin/content', label: 'Nội dung (SP)' }, // UC16.4
      { to: '/admin/complaints', label: 'Khiếu nại' },
      { to: '/admin/reviews', label: 'Đánh giá' },
      { to: '/admin/messages', label: 'Tin nhắn CSKH' },
    ],
  },
  {
    heading: 'Khuyến mãi & tiếp thị',
    items: [
      { to: '/admin/promotions', label: 'Khuyến mãi' },
      { to: '/admin/banners', label: 'Banner quảng cáo' },
      { to: '/admin/campaigns', label: 'Thông báo khuyến mãi' },
    ],
  },
  {
    heading: 'Phân tích (BI)', // UC15 - toàn hệ thống
    items: [
      { to: '/admin/analytics/revenue', label: 'Doanh thu' },
      { to: '/admin/analytics/customers', label: 'Khách hàng' },
      { to: '/admin/analytics/behavior', label: 'Hành vi' },
      { to: '/admin/analytics/body-shapes', label: 'Dáng người' },
      { to: '/admin/analytics/inventory', label: 'Tồn kho' },
    ],
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive ? 'bg-brand text-white font-medium' : 'text-ink/70 hover:bg-brand/10 hover:text-brand'
    }`;

  const sidebar = (
    <nav className="p-4 space-y-5">
      {NAV_GROUPS.map((g) => (
        <div key={g.heading}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/40 px-3 mb-1.5">{g.heading}</p>
          <div className="space-y-0.5">
            {g.items.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={linkCls}>
                {n.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* Thanh trên */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-brand/10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <button className="md:hidden p-2 -ml-2" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          <span className="font-display text-xl font-bold tracking-tight">DressSense <span className="text-brand">Admin</span></span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-ink/60">{user?.fullName} · Quản trị viên</span>
            <button onClick={() => { logout(); nav('/admin/login'); }} className="text-red-500 hover:text-red-600">Đăng xuất</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto md:flex">
        {/* Sidebar desktop */}
        <aside className="hidden md:block w-60 shrink-0 border-r border-brand/10 min-h-[calc(100vh-3.5rem)]">{sidebar}</aside>
        {/* Sidebar mobile (drawer) */}
        {open && (
          <>
            <div className="md:hidden fixed inset-0 bg-black/30 z-20" onClick={() => setOpen(false)} />
            <aside className="md:hidden fixed top-14 left-0 bottom-0 w-64 bg-cream border-r border-brand/10 z-30 overflow-y-auto">{sidebar}</aside>
          </>
        )}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
