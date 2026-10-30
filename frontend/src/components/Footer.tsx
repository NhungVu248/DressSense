import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-ink text-white/80 border-t border-white/10 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          {/* Cột 1: Thông tin DressSense */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="font-display text-2xl font-bold text-white inline-block">
              DressSense<span className="text-brand">.</span>
            </Link>
            <p className="text-sm text-white/70 max-w-sm leading-relaxed">
              Nền tảng thương mại điện tử thời trang tích hợp AI tiên tiến. Giúp bạn thấu hiểu vóc dáng, định hình phong cách cá nhân và khám phá những bộ trang phục tôn dáng hoàn hảo nhất.
            </p>
            <div className="flex items-center gap-3 pt-2 text-white/60">
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/5 hover:bg-brand hover:text-white grid place-items-center transition-colors" aria-label="Facebook">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/5 hover:bg-brand hover:text-white grid place-items-center transition-colors" aria-label="Instagram">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/5 hover:bg-brand hover:text-white grid place-items-center transition-colors" aria-label="TikTok">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>
              </a>
              <a href="https://pinterest.com" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-white/5 hover:bg-brand hover:text-white grid place-items-center transition-colors" aria-label="Pinterest">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="8" x2="12" y2="16"/><circle cx="12" cy="12" r="10"/></svg>
              </a>
            </div>
          </div>

          {/* Cột 2: Hỗ trợ khách hàng */}
          <div>
            <h3 className="font-medium text-white text-sm uppercase tracking-wider mb-4">Hỗ trợ khách hàng</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/support" className="hover:text-brand transition-colors">Hướng dẫn mua hàng</Link></li>
              <li><Link to="/support" className="hover:text-brand transition-colors">Chính sách giao hàng</Link></li>
              <li><Link to="/support" className="hover:text-brand transition-colors">Chính sách đổi trả</Link></li>
              <li><Link to="/support" className="hover:text-brand transition-colors">Câu hỏi thường gặp</Link></li>
              <li><Link to="/orders" className="hover:text-brand transition-colors">Tra cứu đơn hàng</Link></li>
            </ul>
          </div>

          {/* Cột 3: Về DressSense */}
          <div>
            <h3 className="font-medium text-white text-sm uppercase tracking-wider mb-4">Về DressSense</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/support" className="hover:text-brand transition-colors">Giới thiệu thương hiệu</Link></li>
              <li><Link to="/support" className="hover:text-brand transition-colors">Liên hệ hỗ trợ</Link></li>
              <li><Link to="/support" className="hover:text-brand transition-colors">Điều khoản dịch vụ</Link></li>
              <li><Link to="/support" className="hover:text-brand transition-colors">Chính sách bảo mật</Link></li>
              <li><Link to="/seller/login" className="hover:text-brand transition-colors">Kênh người bán</Link></li>
            </ul>
          </div>

          {/* Cột 4: Tính năng nổi bật */}
          <div>
            <h3 className="font-medium text-white text-sm uppercase tracking-wider mb-4">Trải nghiệm AI</h3>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/profile/body" className="text-brand font-medium hover:underline">✨ Phân tích dáng người</Link></li>
              <li><Link to="/recommendations" className="hover:text-brand transition-colors">Gợi ý trang phục cá nhân</Link></li>
              <li><Link to="/profile/personalization" className="hover:text-brand transition-colors">Thiết lập phong cách</Link></li>
              <li><Link to="/products?sort=newest" className="hover:text-brand transition-colors">Bộ sưu tập mới nhất</Link></li>
              <li><Link to="/products?sort=bestselling" className="hover:text-brand transition-colors">Sản phẩm bán chạy</Link></li>
            </ul>
          </div>
        </div>

        {/* Bản quyền */}
        <div className="border-t border-white/10 mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/50">
          <p>© 2026 DressSense. Nền tảng thương mại điện tử thời trang tích hợp AI. Bảo lưu mọi quyền.</p>
          <div className="flex items-center gap-6">
            <span>Tiếng Việt</span>
            <span>VNĐ (₫)</span>
            <span>Chất lượng được kiểm duyệt</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

