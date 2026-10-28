import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getCartCount } from '../lib/cart';
import { notificationCount } from '../lib/interact';
import { DEFAULT_AVATAR } from '../lib/placeholder';
import SearchBar from './SearchBar';

// Điều hướng chính theo giao diện Figma (mỗi mục đều dẫn tới một khung duyệt thật)
const NAV = [
  { label: 'Bộ sưu tập', to: '/' },
  { label: 'Hàng mới', to: '/?sort=newest' },
  { label: 'Bán chạy', to: '/?sort=bestselling' },
];

function Icon({ path, badge }: { path: string; badge?: number }) {
  return (
    <span className="relative">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
      {badge != null && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-brand text-white text-[9px] leading-none w-4 h-4 grid place-items-center rounded-full">{badge}</span>
      )}
    </span>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [menu, setMenu] = useState(false);     // dropdown tài khoản (desktop)
  const [mobile, setMobile] = useState(false); // menu điện thoại
  const accRef = useRef<HTMLDivElement>(null);

  const avatar = user?.avatarUrl
    ? (import.meta.env.VITE_API_URL?.replace('/api', '') + user.avatarUrl)
    : DEFAULT_AVATAR;

  // UC8.1 - số mục trong giỏ (badge)
  const { data: cartCount } = useQuery({ queryKey: ['cart-count'], queryFn: getCartCount, enabled: !!user, staleTime: 30_000 });
  // UC12.4 - số thông báo chưa đọc (badge)
  const { data: notifCount } = useQuery({ queryKey: ['notif-count'], queryFn: notificationCount, enabled: !!user, staleTime: 30_000 });

  useEffect(() => {
    const h = (e: MouseEvent) => { if (accRef.current && !accRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <header className="sticky top-0 z-30">
      {/* Dải khuyến mãi mảnh (theo Figma) */}
      <div className="bg-brand-dark text-white/90 text-xs">
        <div className="max-w-6xl mx-auto px-4 h-9 flex items-center justify-center gap-3 text-center">
          <span className="hidden sm:inline tracking-wide">Một chút phong cách. Một chút riêng bạn.</span>
          <Link to="/?sort=newest" className="font-medium hover:text-white underline-offset-2 hover:underline">Khám phá bộ sưu tập mới →</Link>
        </div>
      </div>

      <nav className="bg-cream/95 backdrop-blur border-b border-black/5">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
          {/* Logo serif */}
          <Link to="/" className="font-display text-2xl font-bold text-ink shrink-0" onClick={() => setMobile(false)}>
            DressSense<span className="text-brand">.</span>
          </Link>

          {/* Điều hướng - desktop */}
          <div className="hidden md:flex items-center gap-5 text-sm text-gray-600 ml-2">
            {NAV.map((n) => (
              <Link key={n.label} to={n.to} className="hover:text-brand transition-colors">{n.label}</Link>
            ))}
            {user && <Link to="/recommendations" className="hover:text-brand transition-colors">Gợi ý cho bạn</Link>}
            {/* UC3 - lối vào Phân tích dáng người (làm nổi bật trên navbar) */}
            <Link to="/profile/body" className="inline-flex items-center gap-1 text-brand font-medium hover:text-brand-dark transition-colors">
              <span aria-hidden>✨</span> Phân tích dáng
            </Link>
          </div>

          {/* Ô tìm kiếm - desktop */}
          <div className="hidden md:block ml-auto w-72">
            <SearchBar />
          </div>

          {/* Icon phải */}
          <div className="flex items-center gap-1 sm:gap-2 ml-auto md:ml-2 text-gray-600">
            {user && (
              <Link to="/notifications" className="p-2 hover:text-brand" title="Thông báo" aria-label="Thông báo">
                <Icon path="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" badge={notifCount} />
              </Link>
            )}
            <Link to="/wishlist" className="p-2 hover:text-brand" title="Yêu thích" aria-label="Sản phẩm yêu thích">
              <Icon path="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
            </Link>
            <button
              onClick={() => (user ? nav('/profile') : nav('/login'))}
              className="p-2 hover:text-brand md:hidden" title="Tài khoản" aria-label="Tài khoản"
            >
              <Icon path="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            </button>
            <Link to="/cart" className="p-2 hover:text-brand" title="Giỏ hàng" aria-label="Giỏ hàng">
              <Icon path="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" badge={cartCount} />
            </Link>

            {/* Tài khoản - desktop (dropdown) */}
            <div className="relative hidden md:block" ref={accRef}>
              {user ? (
                <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-black/[0.04]">
                  <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-100" />
                  <span className="text-sm max-w-[8rem] truncate">{user.fullName}</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <Link to="/login" className="hover:text-brand">Đăng nhập</Link>
                  <Link to="/register" className="bg-brand text-white px-3 py-1.5 rounded-full hover:bg-brand-dark">Đăng ký</Link>
                </div>
              )}

              {user && menu && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-black/5 py-1.5 text-sm" onClick={() => setMenu(false)}>
                  <div className="px-4 py-2 border-b">
                    <p className="font-medium text-ink truncate">{user.fullName}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <MenuLink to="/profile" label="Hồ sơ của tôi" />
                  <MenuLink to="/orders" label="Đơn hàng của tôi" />
                  <MenuLink to="/support" label="Đổi/trả & Khiếu nại" />
                  <MenuLink to="/transactions" label="Lịch sử giao dịch" />
                  <MenuLink to="/profile/body" label="Phân tích dáng người" hot />
                  <MenuLink to="/profile/personalization" label="Hồ sơ cá nhân hóa" />
                  <MenuLink to="/profile/sizes" label="Thông tin size" />
                  <MenuLink to="/recommendations" label="Gợi ý cho bạn" />
                  {user.role === 'SELLER' && <MenuLink to="/manage/products" label="Quản lý gian hàng" />}
                  {user.role === 'SELLER' && <MenuLink to="/manage/orders" label="Quản lý đơn hàng" />}
                  {user.role === 'SELLER' && <MenuLink to="/manage/promotions" label="Khuyến mãi" />}
                  {user.role === 'SELLER' && <MenuLink to="/manage/support" label="Hỗ trợ sau bán" />}
                  {user.role === 'SELLER' && <MenuLink to="/manage/reviews" label="Đánh giá & Hỏi đáp" />}
                  {user.role === 'ADMIN' && <MenuLink to="/admin" label="Trang quản trị" />}
                  <button onClick={logout} className="w-full text-left px-4 py-2 text-red-500 hover:bg-cream">Đăng xuất</button>
                </div>
              )}
            </div>

            {/* Nút mở menu - điện thoại */}
            <button onClick={() => setMobile((v) => !v)} className="md:hidden p-2" aria-label="Mở menu" aria-expanded={mobile}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {mobile ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Menu điện thoại */}
        {mobile && (
          <div className="md:hidden border-t border-black/5 bg-cream px-4 py-3 space-y-3">
            <SearchBar onNavigate={() => setMobile(false)} />
            <div className="flex flex-col text-sm">
              {NAV.map((n) => (
                <Link key={n.label} to={n.to} onClick={() => setMobile(false)} className="py-2.5 hover:text-brand border-b border-black/5">{n.label}</Link>
              ))}
              {/* UC3 - Phân tích dáng người (hiển thị cho mọi người) */}
              <Link to="/profile/body" onClick={() => setMobile(false)} className="py-2.5 text-brand font-medium border-b border-black/5">✨ Phân tích dáng người</Link>
              {user ? (
                <>
                  <Link to="/profile" onClick={() => setMobile(false)} className="py-2.5 flex items-center gap-2 border-b border-black/5">
                    <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover bg-gray-100" />{user.fullName}
                  </Link>
                  <Link to="/recommendations" onClick={() => setMobile(false)} className="py-2.5 hover:text-brand border-b border-black/5">Gợi ý cho bạn</Link>
                  {user.role === 'SELLER' && <Link to="/manage/products" onClick={() => setMobile(false)} className="py-2.5 border-b border-black/5">Quản lý gian hàng</Link>}
                  {user.role === 'SELLER' && <Link to="/manage/orders" onClick={() => setMobile(false)} className="py-2.5 border-b border-black/5">Quản lý đơn hàng</Link>}
                  {user.role === 'SELLER' && <Link to="/manage/promotions" onClick={() => setMobile(false)} className="py-2.5 border-b border-black/5">Khuyến mãi</Link>}
                  {user.role === 'ADMIN' && <Link to="/admin" onClick={() => setMobile(false)} className="py-2.5 border-b border-black/5">Trang quản trị</Link>}
                  <button onClick={() => { setMobile(false); logout(); }} className="py-2.5 text-left text-red-500">Đăng xuất</button>
                </>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMobile(false)} className="py-2.5 hover:text-brand border-b border-black/5">Đăng nhập</Link>
                  <Link to="/register" onClick={() => setMobile(false)} className="py-2.5 text-brand font-medium">Đăng ký</Link>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}

function MenuLink({ to, label, hot }: { to: string; label: string; hot?: boolean }) {
  return (
    <Link to={to} className={`block px-4 py-2 hover:bg-cream ${hot ? 'text-brand font-medium' : 'text-ink'}`}>{label}</Link>
  );
}
