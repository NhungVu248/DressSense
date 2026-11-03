import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Bố cục khu QUẢN TRỊ - cấu trúc theo bản thiết kế phân hệ (ảnh 4): nhóm
// "QUẢN LÝ NỀN TẢNG" + "HỆ THỐNG". Mỗi phân hệ 1 mục chính; các chức năng liên
// quan gom vào mục con (indent) để rạch ròi, tránh gối chức năng.
type NavItem = { to: string; label: string; end?: boolean; sub?: { to: string; label: string }[] };
const NAV_GROUPS: { heading: string; items: NavItem[] }[] = [
  {
    heading: 'Quản lý nền tảng',
    items: [
      { to: '/admin', label: 'Tổng quan', end: true }, // #1 Dashboard
      { to: '/admin/users', label: 'Người dùng' }, // #2
      { to: '/admin/shops', label: 'Cửa hàng' }, // #3
      {
        to: '/admin/products', label: 'Sản phẩm', // #4 + #5 (danh mục) + #9 (kiểm duyệt nội dung)
        sub: [
          { to: '/admin/content', label: 'Kiểm duyệt nội dung' },
          { to: '/admin/categories', label: 'Danh mục' },
        ],
      },
      { to: '/admin/orders', label: 'Đơn hàng' }, // #6
      {
        to: '/admin/finance/report', label: 'Tài chính', // #7 Hoa hồng & đối soát + Thống kê BI (UC15)
        sub: [
          { to: '/admin/finance/policies', label: 'Chính sách hoa hồng' },
          { to: '/admin/finance/commissions', label: 'Giao dịch hoa hồng' },
          { to: '/admin/finance/settlements', label: 'Đối soát & thanh toán' },
          { to: '/admin/analytics/revenue', label: 'Thống kê doanh thu' },
          { to: '/admin/analytics/customers', label: 'Khách hàng' },
          { to: '/admin/analytics/behavior', label: 'Hành vi' },
          { to: '/admin/analytics/body-shapes', label: 'Dáng người' },
          { to: '/admin/analytics/inventory', label: 'Tồn kho' },
        ],
      },
      {
        to: '/admin/reports', label: 'Báo cáo vi phạm', // #8 + Khiếu nại
        sub: [{ to: '/admin/complaints', label: 'Khiếu nại đơn hàng' }],
      },
      {
        to: '/admin/moderation', label: 'Kiểm duyệt', // #9 lịch sử + Đánh giá
        sub: [{ to: '/admin/reviews', label: 'Duyệt đánh giá' }],
      },
    ],
  },
  {
    heading: 'Hệ thống',
    items: [
      {
        to: '/admin/announcements', label: 'Thông báo', // #11 + tiếp thị
        sub: [
          { to: '/admin/campaigns', label: 'Chiến dịch' },
          { to: '/admin/banners', label: 'Banner quảng cáo' },
          { to: '/admin/ad-orders', label: 'Duyệt đơn QC banner' }, // Backlog C.41
          { to: '/admin/voucher-orders', label: 'Duyệt mua voucher' }, // Backlog C.45
          { to: '/admin/promotions', label: 'Khuyến mãi' },
        ],
      },
      { to: '/admin/messages', label: 'Tin nhắn CSKH' },
      { to: '/admin/action-logs', label: 'Nhật ký hoạt động' }, // #12
      {
        to: '/admin/settings', label: 'Cài đặt', // #10 Cấu hình hệ thống
        sub: [{ to: '/admin/password-resets', label: 'Cấp lại mật khẩu' }],
      },
    ],
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
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
            {g.items.map((n) => {
              const showSub = n.sub && (loc.pathname === n.to || n.sub.some((s) => loc.pathname === s.to));
              return (
                <div key={n.to}>
                  <NavLink to={n.to} end={n.end} onClick={() => setOpen(false)} className={linkCls}>{n.label}</NavLink>
                  {showSub && (
                    <div className="ml-3 mt-0.5 space-y-0.5 border-l border-brand/15 pl-2">
                      {n.sub!.map((s) => (
                        <NavLink key={s.to} to={s.to} onClick={() => setOpen(false)}
                          className={({ isActive }) => `block px-2 py-1 rounded text-[13px] ${isActive ? 'text-brand font-medium' : 'text-ink/50 hover:text-brand'}`}>
                          {s.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
