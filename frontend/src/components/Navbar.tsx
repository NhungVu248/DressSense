import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { getCartCount } from '../lib/cart';
import { notificationCount } from '../lib/interact';
import { DEFAULT_AVATAR } from '../lib/placeholder';
import SearchBar from './SearchBar';
import VisualSearchModal from './VisualSearchModal';

const CATEGORY_ITEMS = [
  { label: 'Thời trang nữ', to: '/products?q=Nữ' },
  { label: 'Thời trang nam', to: '/products?q=Nam' },
  { label: 'Áo', to: '/products?q=Áo' },
  { label: 'Quần', to: '/products?q=Quần' },
  { label: 'Váy & Đầm', to: '/products?q=Váy' },
  { label: 'Giày dép', to: '/products?q=Giày' },
  { label: 'Túi xách', to: '/products?q=Túi' },
  { label: 'Phụ kiện', to: '/products?q=Phụ kiện' },
];

function Icon({ path, badge }: { path: string; badge?: number }) {
  return (
    <span className="relative">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
      {badge != null && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-brand text-white text-[9px] leading-none w-4 h-4 grid place-items-center rounded-full font-semibold">{badge}</span>
      )}
    </span>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [menu, setMenu] = useState(false);             // dropdown tài khoản (desktop)
  const [catMenu, setCatMenu] = useState(false);       // dropdown danh mục
  const [mobile, setMobile] = useState(false);         // menu điện thoại
  const [visualSearch, setVisualSearch] = useState(false); // modal tìm kiếm bằng hình ảnh
  const accRef = useRef<HTMLDivElement>(null);
  const catRef = useRef<HTMLDivElement>(null);

  const avatar = user?.avatarUrl
    ? ((import.meta.env.VITE_API_URL || '/api').replace('/api', '') + user.avatarUrl)
    : DEFAULT_AVATAR;

  // UC8.1 - số mục trong giỏ (badge)
  const { data: cartCount } = useQuery({ queryKey: ['cart-count'], queryFn: getCartCount, enabled: !!user, staleTime: 30_000 });
  // UC12.4 - số thông báo chưa đọc (badge)
  const { data: notifCount } = useQuery({ queryKey: ['notif-count'], queryFn: notificationCount, enabled: !!user, staleTime: 30_000 });

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (accRef.current && !accRef.current.contains(e.target as Node)) setMenu(false);
      if (catRef.current && !catRef.current.contains(e.target as Node)) setCatMenu(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const curPath = location.pathname;
  const curSearch = location.search;

  function isActive(to: string) {
    if (to === '/') return curPath === '/' && !curSearch;
    if (to === '/products') return curPath === '/products' && !curSearch.includes('sort=');
    if (to.includes('sort=newest')) return curPath === '/products' && curSearch.includes('sort=newest');
    if (to.includes('sort=bestselling')) return curPath === '/products' && curSearch.includes('sort=bestselling');
    if (to === '/profile/body') return curPath === '/profile/body';
    if (to === '/recommendations') return curPath === '/recommendations';
    return curPath === to;
  }

  return (
    <>
      <header className="sticky top-0 z-30 shadow-2xs">
        {/* A. ANNOUNCEMENT BAR (giữ nguyên dải thông báo hiện tại) */}
        <div className="bg-brand-dark text-white/90 text-xs">
          <div className="max-w-6xl mx-auto px-4 h-9 flex items-center justify-center gap-3 text-center">
            <span className="hidden sm:inline tracking-wide">Một chút phong cách. Một chút riêng bạn.</span>
            <Link to="/products?sort=newest" className="font-medium hover:text-white underline-offset-2 hover:underline">
              Khám phá bộ sưu tập mới →
            </Link>
          </div>
        </div>

        {/* B. HEADER VÀ NAVBAR */}
        <nav className="bg-cream/95 backdrop-blur-md border-b border-black/5">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-4">
            {/* Logo DressSense */}
            <Link to="/" className="font-display text-2xl font-bold text-ink shrink-0 tracking-tight" onClick={() => setMobile(false)}>
              DressSense<span className="text-brand">.</span>
            </Link>

            {/* Thanh điều hướng chính - Desktop */}
            <div className="hidden lg:flex items-center gap-5 text-sm text-gray-600 ml-1">
              <Link
                to="/"
                className={`transition-colors py-1 ${isActive('/') ? 'text-brand font-semibold border-b-2 border-brand' : 'hover:text-brand'}`}
              >
                Trang chủ
              </Link>
              <Link
                to="/products"
                className={`transition-colors py-1 ${isActive('/products') ? 'text-brand font-semibold border-b-2 border-brand' : 'hover:text-brand'}`}
              >
                Sản phẩm
              </Link>

              {/* Danh mục (Dropdown) */}
              <div className="relative" ref={catRef}>
                <button
                  type="button"
                  onClick={() => setCatMenu((v) => !v)}
                  className="flex items-center gap-1 hover:text-brand transition-colors py-1"
                >
                  <span>Danh mục</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`transition-transform duration-200 ${catMenu ? 'rotate-180' : ''}`}>
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </button>
                {catMenu && (
                  <div className="absolute left-0 mt-2 w-52 bg-white rounded-xl shadow-xl border border-black/5 py-2 z-40 text-sm">
                    {CATEGORY_ITEMS.map((cat) => (
                      <Link
                        key={cat.label}
                        to={cat.to}
                        onClick={() => setCatMenu(false)}
                        className="block px-4 py-2 text-ink hover:bg-cream hover:text-brand transition-colors"
                      >
                        {cat.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <Link
                to="/products"
                className="hover:text-brand transition-colors py-1"
              >
                Bộ sưu tập
              </Link>

              <Link
                to="/recommendations"
                className={`transition-colors py-1 ${isActive('/recommendations') ? 'text-brand font-semibold border-b-2 border-brand' : 'hover:text-brand'}`}
              >
                Gợi ý cho bạn
              </Link>

              {/* BẮT BUỘC: Mục Phân tích dáng trên Navbar dẫn đến đúng /profile/body */}
              <Link
                to="/profile/body"
                className={`inline-flex items-center gap-1 font-medium transition-colors py-1 ${
                  isActive('/profile/body')
                    ? 'text-brand-dark font-bold border-b-2 border-brand'
                    : 'text-brand hover:text-brand-dark'
                }`}
                title="Phân tích dáng người bằng AI"
              >
                <span aria-hidden>✨</span> Phân tích dáng
              </Link>

              <Link
                to="/products?sort=newest"
                className={`transition-colors py-1 ${isActive('/products?sort=newest') ? 'text-brand font-semibold border-b-2 border-brand' : 'hover:text-brand'}`}
              >
                Hàng mới
              </Link>
              <Link
                to="/products?sort=bestselling"
                className={`transition-colors py-1 ${isActive('/products?sort=bestselling') ? 'text-brand font-semibold border-b-2 border-brand' : 'hover:text-brand'}`}
              >
                Bán chạy
              </Link>
            </div>

            {/* Ô tìm kiếm + Tìm kiếm bằng hình ảnh */}
            <div className="hidden md:block ml-auto w-64 lg:w-72">
              <SearchBar onOpenVisualSearch={() => setVisualSearch(true)} />
            </div>

            {/* Các icon công cụ phía phải */}
            <div className="flex items-center gap-1 sm:gap-2 ml-auto md:ml-2 text-gray-600">
              {/* Nút tìm kiếm bằng hình ảnh (mobile & shortcut) */}
              <button
                type="button"
                onClick={() => setVisualSearch(true)}
                className="p-2 hover:text-brand md:hidden"
                title="Tìm kiếm bằng hình ảnh (AI)"
                aria-label="Tìm kiếm bằng hình ảnh"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </button>

              {user && (
                <Link to="/notifications" className="p-2 hover:text-brand transition-colors" title="Thông báo" aria-label="Thông báo">
                  <Icon path="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" badge={notifCount} />
                </Link>
              )}

              <Link to="/wishlist" className="p-2 hover:text-brand transition-colors" title="Yêu thích" aria-label="Sản phẩm yêu thích">
                <Icon path="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
              </Link>

              <button
                onClick={() => (user ? nav('/profile') : nav('/login'))}
                className="p-2 hover:text-brand md:hidden" title="Tài khoản" aria-label="Tài khoản"
              >
                <Icon path="M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              </button>

              <Link to="/cart" className="p-2 hover:text-brand transition-colors" title="Giỏ hàng" aria-label="Giỏ hàng">
                <Icon path="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" badge={cartCount} />
              </Link>

              {/* Tài khoản - Desktop dropdown */}
              <div className="relative hidden md:block" ref={accRef}>
                {user ? (
                  <button onClick={() => setMenu((v) => !v)} className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-black/[0.04]">
                    <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover bg-gray-100 ring-1 ring-black/5" />
                    <span className="text-sm max-w-[7.5rem] truncate font-medium">{user.fullName}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-sm ml-1">
                    <Link to="/login" className="hover:text-brand px-2 py-1 font-medium">Đăng nhập</Link>
                    <Link to="/register" className="bg-brand text-white px-3.5 py-1.5 rounded-full hover:bg-brand-dark transition-colors font-medium text-xs">Đăng ký</Link>
                  </div>
                )}

                {user && menu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-black/5 py-2 text-sm z-40 animate-fadeIn" onClick={() => setMenu(false)}>
                    <div className="px-4 py-2.5 border-b">
                      <p className="font-medium text-ink truncate">{user.fullName}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    <MenuLink to="/profile" label="Hồ sơ của tôi" />
                    <MenuLink to="/orders" label="Đơn hàng của tôi" />
                    <MenuLink to="/support" label="Đổi/trả & Khiếu nại" />
                    <MenuLink to="/transactions" label="Lịch sử giao dịch" />
                    {/* Giữ nguyên mục Phân tích dáng trong menu */}
                    <MenuLink to="/profile/body" label="✨ Phân tích dáng người" hot />
                    <MenuLink to="/profile/personalization" label="Hồ sơ cá nhân hóa" />
                    <MenuLink to="/profile/sizes" label="Thông tin size" />
                    <MenuLink to="/recommendations" label="Gợi ý cho bạn" />
                    {user.role === 'ADMIN' && <MenuLink to="/admin" label="Trang quản trị" />}
                    <div className="border-t my-1"></div>
                    <button onClick={logout} className="w-full text-left px-4 py-2 text-red-500 hover:bg-cream transition-colors">Đăng xuất</button>
                  </div>
                )}
              </div>

              {/* Nút mở Hamburger trên Mobile */}
              <button
                onClick={() => setMobile((v) => !v)}
                className="lg:hidden p-2 text-ink hover:text-brand"
                aria-label="Mở menu"
                aria-expanded={mobile}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {mobile ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                </svg>
              </button>
            </div>
          </div>

          {/* Menu điện thoại */}
          {mobile && (
            <div className="lg:hidden border-t border-black/5 bg-cream px-4 py-4 space-y-4 animate-fadeIn">
              <SearchBar onNavigate={() => setMobile(false)} onOpenVisualSearch={() => { setMobile(false); setVisualSearch(true); }} />

              <div className="flex flex-col text-sm divide-y divide-black/5">
                <Link to="/" onClick={() => setMobile(false)} className={`py-2.5 hover:text-brand ${isActive('/') ? 'text-brand font-semibold' : ''}`}>
                  Trang chủ
                </Link>
                <Link to="/products" onClick={() => setMobile(false)} className={`py-2.5 hover:text-brand ${isActive('/products') ? 'text-brand font-semibold' : ''}`}>
                  Sản phẩm
                </Link>
                <Link to="/products" onClick={() => setMobile(false)} className="py-2.5 hover:text-brand">
                  Bộ sưu tập
                </Link>
                <Link to="/recommendations" onClick={() => setMobile(false)} className="py-2.5 hover:text-brand">
                  Gợi ý cho bạn
                </Link>

                {/* TUYỆT ĐỐI KHÔNG XÓA HOẶC ẨN MỤC PHÂN TÍCH DÁNG TRÊN MOBILE */}
                <Link
                  to="/profile/body"
                  onClick={() => setMobile(false)}
                  className="py-2.5 text-brand font-semibold flex items-center gap-1.5"
                >
                  <span>✨</span> Phân tích dáng
                </Link>

                <Link to="/products?sort=newest" onClick={() => setMobile(false)} className="py-2.5 hover:text-brand">
                  Hàng mới
                </Link>
                <Link to="/products?sort=bestselling" onClick={() => setMobile(false)} className="py-2.5 hover:text-brand">
                  Bán chạy
                </Link>

                {/* Danh mục nhanh trên mobile */}
                <div className="py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Danh mục nổi bật</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {CATEGORY_ITEMS.map((c) => (
                      <Link
                        key={c.label}
                        to={c.to}
                        onClick={() => setMobile(false)}
                        className="p-2 rounded bg-white/70 hover:bg-white text-ink hover:text-brand border border-black/5"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
<<<<<<< HEAD
=======
                  <MenuLink to="/profile" label="Hồ sơ của tôi" />
                  <MenuLink to="/orders" label="Đơn hàng của tôi" />
                  <MenuLink to="/messages" label="Tin nhắn" />
                  <MenuLink to="/support" label="Đổi/trả & Khiếu nại" />
                  <MenuLink to="/transactions" label="Lịch sử giao dịch" />
                  <MenuLink to="/profile/body" label="Phân tích dáng người" hot />
                  <MenuLink to="/profile/personalization" label="Hồ sơ cá nhân hóa" />
                  <MenuLink to="/profile/sizes" label="Thông tin size" />
                  <MenuLink to="/recommendations" label="Gợi ý cho bạn" />
                  {user.role === 'ADMIN' && <MenuLink to="/admin" label="Trang quản trị" />}
                  <button onClick={logout} className="w-full text-left px-4 py-2 text-red-500 hover:bg-cream">Đăng xuất</button>
>>>>>>> 99022a13f5b85621be386f87823c2ee9982d9b4d
                </div>

                {user ? (
                  <div className="pt-2 space-y-1">
                    <Link to="/profile" onClick={() => setMobile(false)} className="py-2 flex items-center gap-2">
                      <img src={avatar} alt="" className="w-7 h-7 rounded-full object-cover bg-gray-100" />
                      <span className="font-medium text-ink">{user.fullName}</span>
                    </Link>
                    <Link to="/orders" onClick={() => setMobile(false)} className="block py-2 text-gray-600 hover:text-brand">
                      Đơn hàng của tôi
                    </Link>
                    {user.role === 'ADMIN' && (
                      <Link to="/admin" onClick={() => setMobile(false)} className="block py-2 text-brand font-medium">
                        Trang quản trị
                      </Link>
                    )}
                    <button onClick={() => { setMobile(false); logout(); }} className="py-2 text-left text-red-500 font-medium">
                      Đăng xuất
                    </button>
                  </div>
                ) : (
                  <div className="pt-3 flex gap-3">
                    <Link to="/login" onClick={() => setMobile(false)} className="flex-1 py-2 text-center rounded-lg border border-gray-300 font-medium">
                      Đăng nhập
                    </Link>
                    <Link to="/register" onClick={() => setMobile(false)} className="flex-1 py-2 text-center rounded-lg bg-brand text-white font-medium">
                      Đăng ký
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Modal tìm kiếm bằng hình ảnh */}
      <VisualSearchModal isOpen={visualSearch} onClose={() => setVisualSearch(false)} />
    </>
  );
}

function MenuLink({ to, label, hot }: { to: string; label: string; hot?: boolean }) {
  return (
    <Link to={to} className={`block px-4 py-2 hover:bg-cream transition-colors ${hot ? 'text-brand font-medium' : 'text-ink'}`}>
      {label}
    </Link>
  );
}
