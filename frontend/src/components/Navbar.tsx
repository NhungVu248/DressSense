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
    <span className="relative inline-block">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
      {badge != null && badge > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] leading-none w-4 h-4 grid place-items-center rounded-full font-semibold">
          {badge}
        </span>
      )}
    </span>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  // State dropdowns
  const [productMenu, setProductMenu] = useState(false); // Menu 2 cột "Sản phẩm" theo hình minh họa
  const [showCategoriesSub, setShowCategoriesSub] = useState(false); // Danh sách danh mục con
  const [searchOpen, setSearchOpen] = useState(false);   // Mở thanh tìm kiếm khi bấm icon kính lúp
  const [accountMenu, setAccountMenu] = useState(false); // Dropdown tài khoản
  const [mobileMenu, setMobileMenu] = useState(false);   // Menu mobile hamburger
  const [visualSearch, setVisualSearch] = useState(false); // Modal tìm kiếm bằng hình ảnh

  const prodRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const accRef = useRef<HTMLDivElement>(null);

  const avatar = user?.avatarUrl
    ? ((import.meta.env.VITE_API_URL || '/api').replace('/api', '') + user.avatarUrl)
    : DEFAULT_AVATAR;

  // Badge giỏ hàng & thông báo
  const { data: cartCount } = useQuery({ queryKey: ['cart-count'], queryFn: getCartCount, enabled: !!user, staleTime: 30_000 });
  const { data: notifCount } = useQuery({ queryKey: ['notif-count'], queryFn: notificationCount, enabled: !!user, staleTime: 30_000 });

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (prodRef.current && !prodRef.current.contains(target)) {
        setProductMenu(false);
        setShowCategoriesSub(false);
      }
      if (searchRef.current && !searchRef.current.contains(target)) setSearchOpen(false);
      if (accRef.current && !accRef.current.contains(target)) setAccountMenu(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const curPath = location.pathname;
  const isProductsActive = curPath.startsWith('/products');

  return (
    <>
      <header className="sticky top-0 z-40 shadow-sm">
        {/* A. ANNOUNCEMENT BAR */}
        <div className="bg-black text-white/85 text-xs border-b border-white/10">
          <div className="max-w-6xl mx-auto px-4 h-8 flex items-center justify-center gap-3 text-center">
            <span className="hidden sm:inline tracking-wide text-white/70">Một chút phong cách. Một chút riêng bạn.</span>
            <Link to="/products?sort=newest" className="font-medium hover:text-white underline-offset-2 hover:underline text-emerald-400">
              Khám phá bộ sưu tập mới →
            </Link>
          </div>
        </div>

        {/* B. NAVBAR THEO HÌNH MINH HỌA */}
        <nav className="bg-ink text-white border-b border-white/10 transition-colors">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
            {/* 1. Logo DressSense */}
            <Link
              to="/"
              className="font-display text-2xl font-bold tracking-tight text-white shrink-0 hover:opacity-90 transition-opacity"
              onClick={() => { setMobileMenu(false); setProductMenu(false); }}
            >
              DressSense<span className="text-emerald-400">.</span>
            </Link>

            {/* 2. Thanh điều hướng trung tâm Desktop */}
            <div className="hidden md:flex items-center gap-8 text-sm">
              {/* Trang chủ */}
              <Link
                to="/"
                className={`transition-colors font-medium ${
                  curPath === '/' && !location.search
                    ? 'text-emerald-400 font-semibold'
                    : 'text-white/90 hover:text-white'
                }`}
              >
                Trang chủ
              </Link>

              {/* Sản phẩm ⌄ (Dropdown 2 cột: Khám phá & Xu hướng) */}
              <div className="relative" ref={prodRef}>
                <button
                  type="button"
                  onClick={() => setProductMenu((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 font-medium transition-colors py-1 ${
                    productMenu || isProductsActive
                      ? 'text-emerald-400 font-semibold'
                      : 'text-white/90 hover:text-white'
                  }`}
                  aria-expanded={productMenu}
                  aria-haspopup="true"
                >
                  <span>Sản phẩm</span>
                  <span className={`text-xs transition-transform duration-200 ${productMenu ? 'rotate-180' : ''}`}>
                    ⌄
                  </span>
                </button>

                {/* Dropdown Menu theo đúng hình minh họa khi người dùng chọn Sản phẩm */}
                {productMenu && (
                  <div className="absolute left-0 mt-3 w-80 bg-ink/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/15 p-5 z-50 text-white animate-fadeIn">
                    <div className="text-[11px] uppercase tracking-wider text-white/50 mb-3 pb-2 border-b border-white/10">
                      Menu sản phẩm
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Cột 1: Khám phá */}
                      <div className="space-y-2.5">
                        <h4 className="font-semibold text-white text-sm tracking-wide">
                          Khám phá
                        </h4>
                        <ul className="space-y-2 text-sm text-white/80">
                          <li>
                            <Link
                              to="/products"
                              onClick={() => setProductMenu(false)}
                              className="hover:text-emerald-400 transition-colors flex items-center gap-2"
                            >
                              <span className="text-white/40">•</span>
                              <span>Tất cả sản phẩm</span>
                            </Link>
                          </li>
                          <li>
                            <button
                              type="button"
                              onClick={() => setShowCategoriesSub((v) => !v)}
                              className="hover:text-emerald-400 transition-colors flex items-center justify-between w-full text-left"
                            >
                              <span className="flex items-center gap-2">
                                <span className="text-white/40">•</span>
                                <span>Danh mục</span>
                              </span>
                              <span className="text-xs text-white/40">{showCategoriesSub ? '▲' : '▼'}</span>
                            </button>
                            {/* Danh sách danh mục con mở rộng */}
                            {showCategoriesSub && (
                              <div className="pl-4 pt-2 space-y-1.5 border-l border-white/10 mt-1.5">
                                {CATEGORY_ITEMS.map((cat) => (
                                  <Link
                                    key={cat.label}
                                    to={cat.to}
                                    onClick={() => setProductMenu(false)}
                                    className="block text-xs text-white/70 hover:text-emerald-400 transition-colors"
                                  >
                                    {cat.label}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </li>
                          <li>
                            <Link
                              to="/products"
                              onClick={() => setProductMenu(false)}
                              className="hover:text-emerald-400 transition-colors flex items-center gap-2"
                            >
                              <span className="text-white/40">•</span>
                              <span>Bộ sưu tập</span>
                            </Link>
                          </li>
                        </ul>
                      </div>

                      {/* Cột 2: Xu hướng */}
                      <div className="space-y-2.5">
                        <h4 className="font-semibold text-white text-sm tracking-wide">
                          Xu hướng
                        </h4>
                        <ul className="space-y-2 text-sm text-white/80">
                          <li>
                            <Link
                              to="/products?sort=newest"
                              onClick={() => setProductMenu(false)}
                              className="hover:text-emerald-400 transition-colors flex items-center gap-2"
                            >
                              <span className="text-white/40">•</span>
                              <span>Hàng mới</span>
                            </Link>
                          </li>
                          <li>
                            <Link
                              to="/products?sort=bestselling"
                              onClick={() => setProductMenu(false)}
                              className="hover:text-emerald-400 transition-colors flex items-center gap-2"
                            >
                              <span className="text-white/40">•</span>
                              <span>Bán chạy</span>
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Nhóm Gợi ý cho bạn & Phân tích dáng (Xếp 2 dòng theo đúng hình minh họa) */}
              <div className="flex flex-col justify-center text-sm leading-tight text-left">
                <Link
                  to="/recommendations"
                  className={`transition-colors font-medium py-0.5 ${
                    curPath === '/recommendations' ? 'text-emerald-400 font-semibold' : 'text-white/90 hover:text-white'
                  }`}
                >
                  Gợi ý cho bạn
                </Link>
                <Link
                  to="/profile/body"
                  className={`inline-flex items-center gap-1 font-medium py-0.5 transition-colors ${
                    curPath === '/profile/body' ? 'text-emerald-400 font-semibold' : 'text-white/90 hover:text-white'
                  }`}
                  title="Phân tích dáng người bằng AI"
                >
                  <span>Phân tích dáng</span>
                  <span className="text-amber-400 animate-pulse">✨</span>
                </Link>
              </div>
            </div>

            {/* 3. Nhóm Icon công cụ bên phải (🔍 ♡ 🛒 👤) */}
            <div className="flex items-center gap-2 sm:gap-3 text-white/90">
              {/* Icon 🔍: Tìm kiếm */}
              <div className="relative" ref={searchRef}>
                <button
                  type="button"
                  onClick={() => setSearchOpen((prev) => !prev)}
                  className="p-2 hover:text-emerald-400 hover:bg-white/10 rounded-full transition-colors"
                  title="Tìm kiếm sản phẩm"
                  aria-label="Tìm kiếm"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </button>

                {/* Dropdown hộp tìm kiếm khi nhấn icon 🔍 */}
                {searchOpen && (
                  <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white text-ink rounded-2xl shadow-2xl border border-black/10 p-3 z-50 animate-fadeIn">
                    <SearchBar
                      onNavigate={() => setSearchOpen(false)}
                      onOpenVisualSearch={() => {
                        setSearchOpen(false);
                        setVisualSearch(true);
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Icon ♡: Yêu thích */}
              <Link
                to="/wishlist"
                className="p-2 hover:text-emerald-400 hover:bg-white/10 rounded-full transition-colors"
                title="Sản phẩm yêu thích"
                aria-label="Yêu thích"
              >
                <Icon path="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
              </Link>

              {/* Icon 🛒: Giỏ hàng */}
              <Link
                to="/cart"
                className="p-2 hover:text-emerald-400 hover:bg-white/10 rounded-full transition-colors"
                title="Giỏ hàng"
                aria-label="Giỏ hàng"
              >
                <Icon path="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" badge={cartCount} />
              </Link>

              {/* Icon 👤: Tài khoản người dùng */}
              <div className="relative" ref={accRef}>
                <button
                  type="button"
                  onClick={() => setAccountMenu((prev) => !prev)}
                  className="p-2 hover:text-emerald-400 hover:bg-white/10 rounded-full transition-colors flex items-center gap-1.5"
                  title="Tài khoản"
                  aria-label="Tài khoản"
                >
                  {user ? (
                    <img src={avatar} alt="" className="w-6 h-6 rounded-full object-cover ring-1 ring-white/20" />
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </button>

                {/* Dropdown tài khoản */}
                {accountMenu && (
                  <div className="absolute right-0 mt-3 w-64 bg-white text-ink rounded-2xl shadow-2xl border border-black/10 py-2.5 text-sm z-50 animate-fadeIn" onClick={() => setAccountMenu(false)}>
                    {user ? (
                      <>
                        <div className="px-4 py-2 border-b">
                          <p className="font-semibold text-ink truncate">{user.fullName}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <MenuLink to="/profile" label="Hồ sơ của tôi" />
                        <MenuLink to="/orders" label="Đơn hàng của tôi" />
                        <MenuLink to="/support" label="Đổi/trả & Khiếu nại" />
                        <MenuLink to="/transactions" label="Lịch sử giao dịch" />
                        <MenuLink to="/profile/body" label="✨ Phân tích dáng người" hot />
                        <MenuLink to="/profile/personalization" label="Hồ sơ cá nhân hóa" />
                        <MenuLink to="/recommendations" label="Gợi ý cho bạn" />
                        {user.role === 'ADMIN' && <MenuLink to="/admin" label="Trang quản trị" />}
                        <div className="border-t my-1"></div>
                        <button onClick={logout} className="w-full text-left px-4 py-2 text-red-500 hover:bg-red-50 font-medium">
                          Đăng xuất
                        </button>
                      </>
                    ) : (
                      <div className="p-3 space-y-2">
                        <Link
                          to="/login"
                          className="block w-full py-2 text-center rounded-xl bg-ink text-white font-medium hover:bg-black transition-colors"
                        >
                          Đăng nhập
                        </Link>
                        <Link
                          to="/register"
                          className="block w-full py-2 text-center rounded-xl border border-black/15 text-ink font-medium hover:bg-gray-50 transition-colors"
                        >
                          Đăng ký tài khoản
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Nút Hamburger menu trên Mobile */}
              <button
                type="button"
                onClick={() => setMobileMenu((prev) => !prev)}
                className="md:hidden p-2 text-white hover:text-emerald-400"
                aria-label="Menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {mobileMenu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
                </svg>
              </button>
            </div>
          </div>

          {/* Menu điện thoại */}
          {mobileMenu && (
            <div className="md:hidden bg-ink/98 border-t border-white/10 px-4 py-4 space-y-4 animate-fadeIn text-sm">
              <div className="pb-2">
                <SearchBar
                  onNavigate={() => setMobileMenu(false)}
                  onOpenVisualSearch={() => { setMobileMenu(false); setVisualSearch(true); }}
                />
              </div>

              <div className="flex flex-col space-y-2 divide-y divide-white/10">
                <Link to="/" onClick={() => setMobileMenu(false)} className="py-2 text-white hover:text-emerald-400 font-medium">
                  Trang chủ
                </Link>

                <div className="py-2 space-y-2">
                  <p className="font-semibold text-emerald-400 text-xs uppercase tracking-wider">Sản phẩm - Khám phá</p>
                  <Link to="/products" onClick={() => setMobileMenu(false)} className="block pl-3 text-white/80 hover:text-white">
                    • Tất cả sản phẩm
                  </Link>
                  <Link to="/products" onClick={() => setMobileMenu(false)} className="block pl-3 text-white/80 hover:text-white">
                    • Danh mục
                  </Link>
                  <Link to="/products" onClick={() => setMobileMenu(false)} className="block pl-3 text-white/80 hover:text-white">
                    • Bộ sưu tập
                  </Link>

                  <p className="font-semibold text-emerald-400 text-xs uppercase tracking-wider pt-2">Sản phẩm - Xu hướng</p>
                  <Link to="/products?sort=newest" onClick={() => setMobileMenu(false)} className="block pl-3 text-white/80 hover:text-white">
                    • Hàng mới
                  </Link>
                  <Link to="/products?sort=bestselling" onClick={() => setMobileMenu(false)} className="block pl-3 text-white/80 hover:text-white">
                    • Bán chạy
                  </Link>
                </div>

                <Link to="/recommendations" onClick={() => setMobileMenu(false)} className="py-2 text-white hover:text-emerald-400 font-medium">
                  Gợi ý cho bạn
                </Link>

                <Link to="/profile/body" onClick={() => setMobileMenu(false)} className="py-2 text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span>Phân tích dáng</span>
                  <span className="text-amber-400">✨</span>
                </Link>

                <Link to="/wishlist" onClick={() => setMobileMenu(false)} className="py-2 text-white/80 hover:text-white">
                  Danh sách yêu thích
                </Link>

                <Link to="/cart" onClick={() => setMobileMenu(false)} className="py-2 text-white/80 hover:text-white flex items-center justify-between">
                  <span>Giỏ hàng</span>
                  {cartCount != null && cartCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{cartCount}</span>
                  )}
                </Link>

                {user ? (
                  <div className="pt-2 space-y-2">
                    <Link to="/profile" onClick={() => setMobileMenu(false)} className="flex items-center gap-2 text-white font-medium">
                      <img src={avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                      <span>{user.fullName}</span>
                    </Link>
                    <button onClick={() => { setMobileMenu(false); logout(); }} className="text-left text-red-400 font-medium">
                      Đăng xuất
                    </button>
                  </div>
                ) : (
                  <div className="pt-3 flex gap-2">
                    <Link to="/login" onClick={() => setMobileMenu(false)} className="flex-1 py-2 text-center rounded-xl border border-white/20 text-white font-medium">
                      Đăng nhập
                    </Link>
                    <Link to="/register" onClick={() => setMobileMenu(false)} className="flex-1 py-2 text-center rounded-xl bg-emerald-500 text-ink font-semibold">
                      Đăng ký
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </nav>
      </header>

      {/* Modal tìm kiếm bằng hình ảnh (khi nhấn camera từ thanh tìm kiếm) */}
      <VisualSearchModal isOpen={visualSearch} onClose={() => setVisualSearch(false)} />
    </>
  );
}

function MenuLink({ to, label, hot }: { to: string; label: string; hot?: boolean }) {
  return (
    <Link to={to} className={`block px-4 py-2 hover:bg-gray-50 transition-colors ${hot ? 'text-brand font-medium' : 'text-ink'}`}>
      {label}
    </Link>
  );
}
