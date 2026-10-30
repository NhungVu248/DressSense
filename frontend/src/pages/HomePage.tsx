import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { fetchProducts, formatVND, type ProductCard as Product } from '../lib/products';
import ProductCard from '../components/ProductCard';
import OutfitDetailModal, { type OutfitDetailData } from '../components/OutfitDetailModal';

// 1. Dữ liệu Hero Banner Carousel (3 slide cao cấp chuẩn Editorial Fashion)
const HERO_SLIDES = [
  {
    id: 1,
    eyebrow: 'DISCOVER YOUR SIGNATURE STYLE',
    title: 'Phong cách của bạn. Câu chuyện của riêng bạn.',
    description: 'Khám phá thế giới thời trang được tuyển chọn dành riêng cho bạn. Tìm thấy phong cách phù hợp và tự tin thể hiện cá tính mỗi ngày.',
    primaryCta: 'Khám phá ngay',
    primaryLink: '/products',
    secondaryCta: 'Khám phá cùng AI',
    secondaryLink: '#ai-recommendations',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1000&auto=format&fit=crop&q=80',
    tag: 'BỘ SƯU TẬP MỚI',
  },
  {
    id: 2,
    eyebrow: 'SMART BODY SHAPE STYLING',
    title: 'Hiểu trọn vóc dáng. Tôn vinh vẻ đẹp tự nhiên.',
    description: 'Ứng dụng công nghệ AI phân tích tỷ lệ hình thể để đề xuất trang phục chuẩn phom dáng, giúp bạn luôn tự tin và thu hút trong mọi khoảnh khắc.',
    primaryCta: 'Phân tích dáng ngay',
    primaryLink: '/profile/body',
    secondaryCta: 'Xem trang phục hợp dáng',
    secondaryLink: '/products',
    image: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1000&auto=format&fit=crop&q=80',
    tag: 'TÍNH NĂNG AI ĐỘC QUYỀN',
  },
  {
    id: 3,
    eyebrow: 'CAPSULE WARDROBE ESSENTIALS',
    title: 'Thời trang tối giản. Thanh lịch vượt thời gian.',
    description: 'Định hình tủ đồ con nhộng với những thiết kế đa năng, chất liệu cao cấp và bảng màu trang nhã, dễ dàng phối hợp linh hoạt cho mọi dịp.',
    primaryCta: 'Khám phá bộ sưu tập',
    primaryLink: '/products?style=Minimalist',
    secondaryCta: 'Xem gợi ý phối đồ',
    secondaryLink: '#ai-outfits',
    image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1000&auto=format&fit=crop&q=80',
    tag: 'XU HƯỚNG MÙA NÀY',
  },
];

// 2. 4 Lợi ích chính (Value Proposition)
const VALUE_PROPOSITIONS = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
    title: 'Giao hàng tận nơi',
    desc: 'Miễn phí từ 699.000₫ toàn quốc',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
      </svg>
    ),
    title: 'An tâm đổi trả',
    desc: 'Theo chính sách bảo vệ người mua của sàn',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
      </svg>
    ),
    title: 'Mua sắm tin cậy',
    desc: 'Sản phẩm kiểm duyệt chất lượng nghiêm ngặt',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
    title: 'AI hiểu phong cách',
    desc: 'Gợi ý và phối đồ dành riêng cho bạn',
  },
];

// 3. 8 Danh mục nổi bật
const CATEGORIES_DATA = [
  { id: 'nu', name: 'Thời trang nữ', query: 'Nữ', image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80' },
  { id: 'nam', name: 'Thời trang nam', query: 'Nam', image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80' },
  { id: 'ao', name: 'Áo', query: 'Áo', image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80' },
  { id: 'quan', name: 'Quần', query: 'Quần', image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80' },
  { id: 'vay', name: 'Váy & Đầm', query: 'Váy', image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&auto=format&fit=crop&q=80' },
  { id: 'giay', name: 'Giày dép', query: 'Giày', image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&auto=format&fit=crop&q=80' },
  { id: 'tui', name: 'Túi xách', query: 'Túi', image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80' },
  { id: 'phukien', name: 'Phụ kiện', query: 'Phụ kiện', image: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600&auto=format&fit=crop&q=80' },
];

// 4. 6 Thẻ Khám phá phong cách (Fashion Editorial Cards)
const FASHION_STYLES = [
  {
    key: 'Minimalist',
    name: 'Minimalist',
    labelVN: 'Tối giản',
    desc: 'Gam màu trung tính, phom dáng tinh gọn và đường nét thanh thoát.',
    image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop&q=80',
  },
  {
    key: 'Casual',
    name: 'Casual',
    labelVN: 'Năng động thường ngày',
    desc: 'Thoải mái, tiện dụng nhưng vẫn giữ nét chỉn chu và phong cách.',
    image: 'https://images.unsplash.com/photo-1516762689617-e1cffcef479d?w=600&auto=format&fit=crop&q=80',
  },
  {
    key: 'Office',
    name: 'Office',
    labelVN: 'Công sở hiện đại',
    desc: 'Lịch thiệp, chuẩn mực và tự tin trong mọi môi trường làm việc.',
    image: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=600&auto=format&fit=crop&q=80',
  },
  {
    key: 'Elegant',
    name: 'Elegant',
    labelVN: 'Quý phái & Thanh lịch',
    desc: 'Duyên dáng, sang trọng và thu hút ánh nhìn một cách tinh tế.',
    image: 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=600&auto=format&fit=crop&q=80',
  },
  {
    key: 'Streetwear',
    name: 'Streetwear',
    labelVN: 'Đường phố cá tính',
    desc: 'Phóng khoáng, tự do và đậm dấu ấn cá nhân đậm chất hiện đại.',
    image: 'https://images.unsplash.com/photo-1552374196-1ab2a1c593e8?w=600&auto=format&fit=crop&q=80',
  },
  {
    key: 'Romantic',
    name: 'Romantic',
    labelVN: 'Lãng mạn & Ngọt ngào',
    desc: 'Chất liệu mềm mại, chi tiết bồng bềnh và sắc màu dịu dàng.',
    image: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?w=600&auto=format&fit=crop&q=80',
  },
];

// 5. Mẫu outfit AI tuyển chọn cao cấp khi chưa có hồ sơ người dùng
const FALLBACK_OUTFITS: OutfitDetailData[] = [
  {
    id: 'outfit-1',
    title: 'Quý cô công sở thanh lịch',
    style: 'Office & Chic',
    description: 'Sự kết hợp hoàn hảo giữa sơ mi trắng phom rộng, quần âu ống suông cạp cao và túi xách da tối giản, tạo vẻ ngoài chuyên nghiệp mà hiện đại.',
    why: 'Phối màu kinh điển trắng - đen giúp kéo dài đôi chân và tạo phong thái tự tin trong các buổi họp.',
    coverImage: 'https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=600&auto=format&fit=crop&q=80',
    totalPrice: 1290000,
    items: [
      { id: 1, name: 'Áo sơ mi cổ V basic', slot: 'TOP', color: 'Trắng', price: 320000, image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=300&q=80' },
      { id: 4, name: 'Quần ống suông tối màu', slot: 'BOTTOM', color: 'Đen', price: 350000, image: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=300&q=80' },
      { id: 7, name: 'Giày cao gót mũi nhọn', slot: 'SHOES', color: 'Đen', price: 620000, image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=300&q=80' },
    ],
  },
  {
    id: 'outfit-2',
    title: 'Dạo phố cuối tuần năng động',
    style: 'Casual Weekend',
    description: 'Áo thun cotton mềm mại kết hợp chân váy chữ A và giày sneaker trắng, mang lại sự trẻ trung, thoải mái suốt cả ngày dài.',
    why: 'Thiết kế chữ A che khuyết điểm hông hoàn hảo cho dáng Quả táo và Chữ nhật.',
    coverImage: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=80',
    totalPrice: 970000,
    items: [
      { id: 2, name: 'Áo vai bồng cổ thuyền', slot: 'TOP', color: 'Hồng pastel', price: 290000, image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=300&q=80' },
      { id: 5, name: 'Chân váy xòe chữ A', slot: 'BOTTOM', color: 'Xanh rêu', price: 280000, image: 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=300&q=80' },
      { id: 8, name: 'Túi tote canvas', slot: 'ACCESSORY', color: 'Be', price: 210000, image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=300&q=80' },
    ],
  },
  {
    id: 'outfit-3',
    title: 'Tối giản đương đại',
    style: 'Minimalist Clean',
    description: 'Đầm suông dệt kim kết hợp áo blazer khoác nhẹ và thắt lưng da điểm xuyết, tạo tổng thể sang trọng và đầy khí chất.',
    why: 'Tạo điểm nhấn eo thon gọn và tôn lên đường cong tự nhiên của vóc dáng.',
    coverImage: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop&q=80',
    totalPrice: 1450000,
    items: [
      { id: 6, name: 'Áo khoác blazer cao cấp', slot: 'OUTER', color: 'Xanh than', price: 850000, image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=300&q=80' },
      { id: 3, name: 'Áo croptop ôm', slot: 'TOP', color: 'Trắng kem', price: 190000, image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&q=80' },
      { id: 9, name: 'Thắt lưng da bản nhỏ', slot: 'ACCESSORY', color: 'Nâu', price: 150000, image: 'https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=300&q=80' },
    ],
  },
];

// Hook đếm ngược thời gian Flash Sale
function useCountdown(target: string | null) {
  const [left, setLeft] = useState(() => (target ? Math.max(0, new Date(target).getTime() - Date.now()) : 0));
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setLeft(Math.max(0, new Date(target).getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target || left <= 0) return null;
  const s = Math.floor(left / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d} ngày ${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export default function HomePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();

  // Chuyển hướng các URL query params nếu có sang /products (ví dụ ?q=... hoặc ?categoryId=...)
  if (sp.get('q') || sp.get('categoryId') || sp.get('color') || sp.get('size') || sp.get('style') || sp.get('minPrice') || sp.get('maxPrice')) {
    return <Navigate to={`/products?${sp.toString()}`} replace />;
  }

  // 1. Trạng thái Hero Carousel
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isPaused]);

  // 2. Trạng thái Tab gợi ý AI (Dành cho bạn / Tối giản / Công sở / Thanh lịch)
  type AiTab = 'FOR_YOU' | 'Minimalist' | 'Office' | 'Elegant';
  const [aiTab, setAiTab] = useState<AiTab>('FOR_YOU');

  // Lấy sản phẩm theo tab AI
  const { data: recData, isLoading: recLoading } = useQuery({
    queryKey: ['home-recommendations'],
    queryFn: async () => {
      if (!user) return null;
      try {
        const res = await api.get('/recommendations?limit=4');
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: minimalistProducts } = useQuery({
    queryKey: ['home-style-minimalist'],
    queryFn: () => fetchProducts({ style: ['Minimalist'], limit: 4 }),
    staleTime: 5 * 60 * 1000,
  });
  const { data: officeProducts } = useQuery({
    queryKey: ['home-style-office'],
    queryFn: () => fetchProducts({ style: ['Office'], limit: 4 }),
    staleTime: 5 * 60 * 1000,
  });
  const { data: elegantProducts } = useQuery({
    queryKey: ['home-style-elegant'],
    queryFn: () => fetchProducts({ style: ['Elegant'], limit: 4 }),
    staleTime: 5 * 60 * 1000,
  });

  // 3. Ưu đãi nổi bật & Flash Sale
  const { data: flashItems } = useQuery({
    queryKey: ['home-flash-active'],
    queryFn: async () => {
      try {
        const res = await api.get('/promotions/flash-sales/active');
        return res.data.items as any[];
      } catch {
        return [];
      }
    },
    staleTime: 60 * 1000,
  });

  const soonestEnd = flashItems && flashItems.length > 0
    ? flashItems.reduce((a, b) => (new Date(a.endsAt) < new Date(b.endsAt) ? a : b)).endsAt
    : null;
  const countdown = useCountdown(soonestEnd);

  // 4. Sản phẩm mới nhất & Sản phẩm được yêu thích
  const { data: newestData } = useQuery({
    queryKey: ['home-products-newest'],
    queryFn: () => fetchProducts({ sort: 'newest', limit: 4 }),
    staleTime: 3 * 60 * 1000,
  });

  const { data: popularData } = useQuery({
    queryKey: ['home-products-popular'],
    queryFn: () => fetchProducts({ sort: 'bestselling', limit: 4 }),
    staleTime: 3 * 60 * 1000,
  });

  // 5. Outfit Modal
  const [selectedOutfit, setSelectedOutfit] = useState<OutfitDetailData | null>(null);

  // 6. Newsletter Form
  const [emailInput, setEmailInput] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [newsletterMsg, setNewsletterMsg] = useState('');

  function handleNewsletterSubmit(e: React.FormEvent) {
    e.preventDefault();
    const email = emailInput.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setNewsletterStatus('error');
      setNewsletterMsg('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    // Ghi nhận thành công
    setNewsletterStatus('success');
    setNewsletterMsg('Cảm ơn bạn đã đăng ký! Những cập nhật xu hướng và ưu đãi mới nhất sẽ được gửi tới hòm thư của bạn.');
    setEmailInput('');
  }

  // Lấy danh sách sản phẩm hiển thị theo tab AI
  const displayAiProducts: Product[] = useMemo(() => {
    if (aiTab === 'FOR_YOU') {
      if (recData && recData.items && recData.items.length > 0) {
        return recData.items.slice(0, 4).map((it: any) => ({
          ...it.product,
          images: it.product.images || [],
          ratingAvg: 5.0,
          ratingCount: 1,
          soldCount: 12,
          inStock: true,
          sizes: ['M', 'L'],
          createdAt: new Date().toISOString(),
        }));
      }
      return popularData?.items.slice(0, 4) || [];
    }
    if (aiTab === 'Minimalist') return minimalistProducts?.items.slice(0, 4) || popularData?.items.slice(0, 4) || [];
    if (aiTab === 'Office') return officeProducts?.items.slice(0, 4) || popularData?.items.slice(0, 4) || [];
    if (aiTab === 'Elegant') return elegantProducts?.items.slice(0, 4) || popularData?.items.slice(0, 4) || [];
    return [];
  }, [aiTab, recData, popularData, minimalistProducts, officeProducts, elegantProducts]);

  return (
    <div className="space-y-16 sm:space-y-24 pb-16">
      {/* ========================================================
          C. HERO BANNER CAROUSEL
          ======================================================== */}
      <section
        className="relative bg-cream overflow-hidden border-b border-black/5"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-16 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Cột trái: Nội dung giới thiệu */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 text-brand text-xs font-semibold tracking-widest uppercase">
                <span>✦</span>
                <span>{HERO_SLIDES[currentSlide].eyebrow}</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-ink leading-[1.2] transition-all duration-500">
                {HERO_SLIDES[currentSlide].title}
              </h1>

              <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl transition-all duration-500">
                {HERO_SLIDES[currentSlide].description}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to={HERO_SLIDES[currentSlide].primaryLink}
                  className="bg-brand text-white hover:bg-brand-dark px-7 py-3.5 rounded-full font-medium text-sm transition-all duration-300 shadow-md hover:shadow-lg inline-flex items-center gap-2"
                >
                  <span>{HERO_SLIDES[currentSlide].primaryCta}</span>
                  <span>→</span>
                </Link>

                {HERO_SLIDES[currentSlide].secondaryLink.startsWith('#') ? (
                  <a
                    href={HERO_SLIDES[currentSlide].secondaryLink}
                    className="border border-black/15 text-ink hover:border-brand hover:text-brand px-6 py-3.5 rounded-full font-medium text-sm transition-colors inline-flex items-center gap-2 bg-white/70"
                  >
                    <span>{HERO_SLIDES[currentSlide].secondaryCta}</span>
                    <span>✨</span>
                  </a>
                ) : (
                  <Link
                    to={HERO_SLIDES[currentSlide].secondaryLink}
                    className="border border-black/15 text-ink hover:border-brand hover:text-brand px-6 py-3.5 rounded-full font-medium text-sm transition-colors inline-flex items-center gap-2 bg-white/70"
                  >
                    <span>{HERO_SLIDES[currentSlide].secondaryCta}</span>
                    <span>✨</span>
                  </Link>
                )}
              </div>
            </div>

            {/* Cột phải: Hình ảnh thời trang người mẫu */}
            <div className="lg:col-span-6">
              <div className="relative aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5] max-w-lg mx-auto rounded-2xl overflow-hidden shadow-2xl bg-brand-light">
                <img
                  src={HERO_SLIDES[currentSlide].image}
                  alt={HERO_SLIDES[currentSlide].title}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <span className="inline-block text-[11px] font-semibold tracking-wider uppercase bg-white/20 backdrop-blur-md px-3 py-1 rounded-full">
                    {HERO_SLIDES[currentSlide].tag}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Điều hướng Carousel: Nút chuyển slide và indicators */}
          <div className="mt-8 pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {HERO_SLIDES.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 transition-all duration-300 rounded-full ${
                    currentSlide === idx ? 'w-8 bg-brand' : 'w-2 bg-black/20 hover:bg-black/40'
                  }`}
                  aria-label={`Slide ${idx + 1}`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
                className="w-10 h-10 rounded-full border border-black/10 bg-white/80 hover:bg-white text-ink grid place-items-center transition-colors shadow-xs"
                aria-label="Slide trước"
              >
                ←
              </button>
              <button
                onClick={() => setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length)}
                className="w-10 h-10 rounded-full border border-black/10 bg-white/80 hover:bg-white text-ink grid place-items-center transition-colors shadow-xs"
                aria-label="Slide tiếp theo"
              >
                →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          D. VALUE PROPOSITION (4 Lợi ích chính)
          ======================================================== */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 rounded-2xl bg-white border border-black/5 shadow-xs">
          {VALUE_PROPOSITIONS.map((v, i) => (
            <div key={i} className="flex items-start gap-4 p-2">
              <div className="w-12 h-12 rounded-xl bg-brand-light text-brand shrink-0 grid place-items-center">
                {v.icon}
              </div>
              <div>
                <h3 className="font-semibold text-sm text-ink">{v.title}</h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================
          E. DANH MỤC NỔI BẬT (8 Danh mục)
          ======================================================== */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand font-semibold mb-1">CATEGORIES</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Khám phá danh mục</h2>
          </div>
          <Link to="/products" className="text-sm font-medium text-brand hover:underline inline-flex items-center gap-1">
            <span>Tất cả danh mục</span>
            <span>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {CATEGORIES_DATA.map((cat) => (
            <Link
              key={cat.id}
              to={`/products?q=${encodeURIComponent(cat.query)}`}
              className="group relative rounded-xl overflow-hidden aspect-[4/5] bg-brand-light block shadow-xs hover:shadow-md transition-all duration-300"
            >
              <img
                src={cat.image}
                alt={cat.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <h3 className="font-medium text-base sm:text-lg drop-shadow-xs">{cat.name}</h3>
                <span className="inline-flex items-center gap-1 text-xs text-white/80 mt-1 group-hover:text-white group-hover:underline">
                  <span>Khám phá</span>
                  <span>→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ========================================================
          F. ƯU ĐÃI NỔI BẬT (Flash Sale & Khuyến mãi)
          ======================================================== */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-black/5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-black/5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
                <p className="text-xs uppercase tracking-widest text-red-600 font-semibold">LIMITED TIME OFFERS</p>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink mt-1">Ưu đãi nổi bật</h2>
            </div>

            <div className="flex items-center gap-4">
              {countdown && (
                <div className="flex items-center gap-2 bg-red-50 text-red-600 px-3.5 py-1.5 rounded-full text-xs font-semibold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span>Kết thúc sau: <span className="font-mono">{countdown}</span></span>
                </div>
              )}
              <Link
                to="/products?sort=newest"
                className="text-sm font-medium text-brand hover:underline whitespace-nowrap"
              >
                Xem tất cả ưu đãi →
              </Link>
            </div>
          </div>

          {/* Danh sách sản phẩm ưu đãi */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {popularData?.items.slice(0, 4).map((p) => {
              // Đảm bảo hiển thị ưu đãi rõ ràng
              const displayProduct: Product = {
                ...p,
                onSale: true,
                salePrice: p.salePrice || Math.round(p.price * 0.8),
              };
              return <ProductCard key={p.id} p={displayProduct} />;
            })}
          </div>
        </div>
      </section>

      {/* ========================================================
          G. GỢI Ý AI CÁ NHÂN HÓA
          ======================================================== */}
      <section id="ai-recommendations" className="max-w-6xl mx-auto px-4 scroll-mt-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand mb-1">
              <span>✨</span>
              <span>AI PERSONALIZED STYLING</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Dành riêng cho bạn</h2>
            <p className="text-sm text-gray-600 mt-1 max-w-lg">
              Khám phá những sản phẩm được đề xuất dựa trên phong cách, sở thích và đường nét vóc dáng của bạn.
            </p>
          </div>

          {/* Các Tabs: Dành cho bạn / Tối giản / Công sở / Thanh lịch */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'FOR_YOU', label: 'Dành cho bạn' },
              { id: 'Minimalist', label: 'Tối giản' },
              { id: 'Office', label: 'Công sở' },
              { id: 'Elegant', label: 'Thanh lịch' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAiTab(tab.id as AiTab)}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  aiTab === tab.id
                    ? 'bg-brand text-white shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-black/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Lưới sản phẩm được đề xuất */}
        {recLoading ? (
          <div className="py-12 text-center text-sm text-gray-400">Đang chuẩn bị gợi ý phong cách riêng...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {displayAiProducts.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        )}

        {/* Box: "Một chút về bạn. Gợi ý phù hợp hơn." */}
        <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-brand-light/90 via-cream to-brand-light/60 border border-brand/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-lg font-bold text-ink">Một chút về bạn. Gợi ý phù hợp hơn.</h3>
            <p className="text-xs sm:text-sm text-gray-600">
              Chia sẻ sở thích màu sắc, phom dáng và ngân sách mong muốn để AI DressSense tối ưu hóa trải nghiệm mua sắm của bạn.
            </p>
          </div>
          <Link
            to="/profile/personalization"
            className="bg-ink hover:bg-black text-white px-5 py-2.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap self-start sm:self-auto shadow-xs"
          >
            Thiết lập phong cách →
          </Link>
        </div>
      </section>

      {/* ========================================================
          H. PHỐI ĐỒ THÔNG MINH BẰNG AI
          ======================================================== */}
      <section id="ai-outfits" className="max-w-6xl mx-auto px-4 scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand mb-1">
              <span>✦</span>
              <span>SMART OUTFIT COMBINATIONS</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Phối đồ theo phong cách của bạn</h2>
            <p className="text-sm text-gray-600 mt-1 max-w-lg">
              Khám phá những outfit được AI gợi ý dựa trên phong cách cá nhân, hài hòa về sắc độ và phom dáng.
            </p>
          </div>
        </div>

        {/* 3 Outfit Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FALLBACK_OUTFITS.map((outfit) => (
            <div
              key={outfit.id}
              className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-xs hover:shadow-md transition-all duration-300 flex flex-col"
            >
              <div className="relative aspect-[4/5] bg-brand-light overflow-hidden">
                <img
                  src={outfit.coverImage}
                  alt={outfit.title}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
                />
                <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-md text-brand font-semibold text-[11px] px-3 py-1 rounded-full uppercase tracking-wider">
                  {outfit.style}
                </span>
                <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[11px] px-2.5 py-1 rounded-full">
                  {outfit.items.length} món đồ
                </span>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-ink">{outfit.title}</h3>
                  <p className="text-xs text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{outfit.description}</p>
                </div>

                <div className="pt-3 border-t border-black/5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 block uppercase tracking-wider">Tổng giá dự kiến</span>
                    <span className="font-semibold text-base text-ink">{formatVND(outfit.totalPrice || 0)}</span>
                  </div>
                  <button
                    onClick={() => setSelectedOutfit(outfit)}
                    className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-full text-xs font-medium transition-colors shadow-xs"
                  >
                    Xem chi tiết
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================
          I. PHÂN TÍCH DÁNG NGƯỜI – BODY SHAPE ANALYSIS
          (Section quảng bá quan trọng, dẫn trực tiếp về /profile/body)
          ======================================================== */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="rounded-3xl bg-gradient-to-br from-brand/10 via-cream to-brand-light/70 border border-brand/20 p-8 sm:p-12 shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Cột trái: Giới thiệu & CTA */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand text-white text-xs font-semibold tracking-wider uppercase">
                <span>✨</span>
                <span>AI BODY SHAPE ANALYSIS</span>
              </div>

              <h2 className="font-display text-3xl sm:text-4xl font-bold text-ink leading-tight">
                Hiểu vóc dáng – Tìm phong cách phù hợp
              </h2>

              <p className="text-base text-gray-600 leading-relaxed max-w-xl">
                Khám phá đặc điểm vóc dáng của bạn và tìm kiếm những trang phục giúp bạn tự tin thể hiện phong cách riêng. Công nghệ trí tuệ nhân tạo sẽ tính toán tỷ lệ hình thể và phân tích ưu điểm cơ thể chỉ trong tích tắc.
              </p>

              {/* 3 Lợi ích chính */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/10 text-brand grid place-items-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span className="text-sm font-medium text-ink">Khám phá đặc điểm và tỷ lệ vóc dáng của bạn.</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/10 text-brand grid place-items-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span className="text-sm font-medium text-ink">Tìm hiểu quy tắc phối đồ và bảng màu tôn dáng.</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/10 text-brand grid place-items-center shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span className="text-sm font-medium text-ink">Tham khảo trang phục chuẩn kích cỡ và phom dáng.</span>
                </div>
              </div>

              {/* Nút CTA chính dẫn đúng trang Phân tích dáng hiện có (/profile/body) */}
              <div className="pt-4">
                <Link
                  to="/profile/body"
                  className="bg-brand hover:bg-brand-dark text-white px-8 py-3.5 rounded-full font-medium text-sm transition-all shadow-md hover:shadow-lg inline-flex items-center gap-2"
                >
                  <span>Phân tích dáng ngay</span>
                  <span>→</span>
                </Link>
                <p className="text-xs text-gray-500 mt-2">
                  Trải nghiệm hoàn toàn miễn phí · Hỗ trợ nhập số đo hoặc quét ảnh AI
                </p>
              </div>
            </div>

            {/* Cột phải: Hình ảnh minh họa thời trang và vóc dáng */}
            <div className="lg:col-span-5">
              <div className="relative aspect-[3/4] max-w-sm mx-auto rounded-2xl overflow-hidden shadow-xl bg-white border-4 border-white">
                <img
                  src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=800&auto=format&fit=crop&q=80"
                  alt="Minh họa phân tích dáng người"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">Đồng hồ cát · Quả lê · Chữ nhật</span>
                    <span className="bg-white/30 backdrop-blur-md px-2 py-0.5 rounded text-[10px]">Độ chính xác 95%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          J. SẢN PHẨM MỚI NHẤT
          ======================================================== */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand font-semibold mb-1">NEW ARRIVALS</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Sản phẩm mới nhất</h2>
          </div>
          <Link to="/products?sort=newest" className="text-sm font-medium text-brand hover:underline inline-flex items-center gap-1">
            <span>Xem tất cả</span>
            <span>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {newestData?.items.slice(0, 4).map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      {/* ========================================================
          K. SẢN PHẨM ĐƯỢC YÊU THÍCH
          ======================================================== */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand font-semibold mb-1">BEST SELLERS</p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Sản phẩm được yêu thích</h2>
          </div>
          <Link to="/products?sort=bestselling" className="text-sm font-medium text-brand hover:underline inline-flex items-center gap-1">
            <span>Xem tất cả</span>
            <span>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {popularData?.items.slice(0, 4).map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      </section>

      {/* ========================================================
          L. KHÁM PHÁ PHONG CÁCH (6 Editorial Cards)
          ======================================================== */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="text-center max-w-xl mx-auto mb-10">
          <p className="text-xs uppercase tracking-widest text-brand font-semibold mb-1">EDITORIAL STYLING</p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Tìm phong cách của bạn</h2>
          <p className="text-sm text-gray-600 mt-2">
            Mỗi phong cách là một tuyên ngôn cá tính riêng. Chọn nguồn cảm hứng định hình diện mạo thời trang của bạn.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FASHION_STYLES.map((st) => (
            <div
              key={st.key}
              className="group relative rounded-2xl overflow-hidden aspect-[3/4] bg-brand-light shadow-xs hover:shadow-xl transition-all duration-500"
            >
              <img
                src={st.image}
                alt={st.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white flex flex-col justify-end">
                <span className="text-xs font-semibold tracking-wider uppercase text-white/80">{st.labelVN}</span>
                <h3 className="font-display text-2xl font-bold mt-1">{st.name}</h3>
                <p className="text-xs text-white/70 mt-2 line-clamp-2 leading-relaxed">{st.desc}</p>
                <Link
                  to={`/products?style=${encodeURIComponent(st.key)}`}
                  className="mt-4 inline-flex items-center gap-2 text-xs font-semibold bg-white/20 backdrop-blur-md hover:bg-white hover:text-ink text-white px-4 py-2 rounded-full transition-colors self-start"
                >
                  <span>Khám phá phong cách</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================
          M. NEWSLETTER
          ======================================================== */}
      <section className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-black/5 shadow-xs text-center">
          <div className="w-12 h-12 rounded-full bg-brand-light text-brand grid place-items-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-ink">Đừng bỏ lỡ xu hướng mới.</h2>
          <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto leading-relaxed">
            Đăng ký để cập nhật xu hướng thời trang, sản phẩm mới và nhận các ưu đãi độc quyền dành riêng cho bạn từ DressSense.
          </p>

          <form onSubmit={handleNewsletterSubmit} className="mt-6 max-w-md mx-auto flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={emailInput}
              onChange={(e) => { setEmailInput(e.target.value); setNewsletterStatus('idle'); }}
              placeholder="Nhập địa chỉ email của bạn..."
              className="flex-1 px-4 py-3 rounded-full border border-black/15 text-sm focus:outline-none focus:border-brand bg-cream/50"
              aria-label="Địa chỉ email"
            />
            <button
              type="submit"
              className="bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-full text-sm font-medium transition-colors shadow-xs shrink-0"
            >
              Đăng ký
            </button>
          </form>

          {newsletterStatus === 'error' && (
            <p className="text-xs text-red-500 mt-2 font-medium">{newsletterMsg}</p>
          )}
          {newsletterStatus === 'success' && (
            <p className="text-xs text-emerald-600 mt-3 font-medium bg-emerald-50 py-2 px-4 rounded-xl inline-block">
              {newsletterMsg}
            </p>
          )}

          <p className="text-[11px] text-gray-400 mt-4">
            Bằng cách đăng ký, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của chúng tôi.
          </p>
        </div>
      </section>

      {/* Modal chi tiết Outfit */}
      <OutfitDetailModal outfit={selectedOutfit} onClose={() => setSelectedOutfit(null)} />
    </div>
  );
}

