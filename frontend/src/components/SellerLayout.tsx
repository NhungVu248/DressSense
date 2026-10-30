import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// UC14 - Bố cục Seller Portal (Người bán). Đồng bộ phong cách Figma: nền kem,
// xanh ô-liu, serif; sidebar nhóm chức năng - tách biệt với giao diện Khách & Admin.
const NAV_GROUPS: { heading: string; items: { to: string; label: string; end?: boolean }[] }[] = [
  {
    heading: 'Gian hàng',
    items: [
      { to: '/seller', label: 'Tổng quan', end: true }, // UC14.4 - báo cáo doanh thu
      { to: '/seller/shop', label: 'Thông tin gian hàng' }, // UC14.1
    ],
  },
  {
    heading: 'Bán hàng',
    items: [
      { to: '/seller/products', label: 'Sản phẩm' }, // UC14.2 (tái dùng UC6)
      { to: '/seller/orders', label: 'Đơn hàng' }, // UC14.3 (tái dùng UC10)
    ],
  },
  {
    heading: 'Phân tích (BI)', // UC15
    items: [
      { to: '/seller/analytics/revenue', label: 'Doanh thu' },
      { to: '/seller/analytics/customers', label: 'Khách hàng' },
      { to: '/seller/analytics/behavior', label: 'Hành vi' },
      { to: '/seller/analytics/body-shapes', label: 'Dáng người' },
      { to: '/seller/analytics/inventory', label: 'Tồn kho' },
    ],
  },
  {
    heading: 'Chăm sóc & tiếp thị',
    items: [
      { to: '/seller/promotions', label: 'Khuyến mãi' },
      { to: '/seller/reviews', label: 'Đánh giá & Hỏi đáp' },
      { to: '/seller/messages', label: 'Tin nhắn' },
      { to: '/seller/support', label: 'Hỗ trợ' },
    ],
  },
];

export default function SellerLayout({ children }: { children: ReactNode }) {
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
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-brand/10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <button className="md:hidden p-2 -ml-2" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          <span className="font-display text-xl font-bold tracking-tight">DressSense <span className="text-brand">Người bán</span></span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden sm:inline text-ink/60">{user?.fullName} · Người bán</span>
            <button onClick={() => { logout(); nav('/seller/login'); }} className="text-red-500 hover:text-red-600">Đăng xuất</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto md:flex">
        <aside className="hidden md:block w-60 shrink-0 border-r border-brand/10 min-h-[calc(100vh-3.5rem)]">{sidebar}</aside>
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
