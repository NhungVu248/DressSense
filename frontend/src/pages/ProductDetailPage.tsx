import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { recordBehavior } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PRODUCT_PLACEHOLDER } from '../lib/placeholder';
import {
  fetchProduct, fetchRelated, formatVND, primaryImage, colorHex,
  type ProductVariant,
} from '../lib/products';
import { addToCart as apiAddToCart, addWishlist } from '../lib/cart';
import { getProductReviews, getProductQuestions, createQuestion } from '../lib/interact';
import ProductCard from '../components/ProductCard';

type Tab = 'desc' | 'detail' | 'reviews' | 'qa';

export default function ProductDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [img, setImg] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('desc');
  const [modal, setModal] = useState<null | 'chart' | 'guide'>(null);
  const [adding, setAdding] = useState(false);

  const { data: p, isLoading, error } = useQuery({ queryKey: ['product', id], queryFn: () => fetchProduct(id!), enabled: !!id });
  const { data: related } = useQuery({ queryKey: ['related', id], queryFn: () => fetchRelated(id!), enabled: !!id });

  // UC5/GĐ6 - ghi nhận lượt xem
  useEffect(() => { if (id) recordBehavior(Number(id), 'VIEW'); }, [id]);
  // Reset lựa chọn khi đổi sản phẩm
  useEffect(() => { setImg(0); setSize(null); setTab('desc'); }, [id]);

  const avail = (v: ProductVariant) => v.stock - (v.reserved ?? 0);
  const selectedVariant = useMemo(() => p?.variants.find((v) => v.size === size) ?? null, [p, size]);
  const ratingCount = p?.reviews.length ?? 0;
  const ratingAvg = ratingCount && p ? p.reviews.reduce((a, r) => a + r.rating, 0) / ratingCount : 0;

  if (isLoading) return <p className="text-center py-24 text-gray-400">Đang tải sản phẩm…</p>;
  // 2E - sản phẩm không tồn tại / bị ẩn / không còn được phép hiển thị
  if (error || !p) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <p className="font-display text-2xl text-ink">Sản phẩm không khả dụng</p>
        <p className="text-sm text-gray-500 mt-2">Sản phẩm có thể đã bị ẩn hoặc không còn được bán.</p>
        <Link to="/" className="inline-block mt-5 bg-brand text-white rounded-full px-5 py-2.5 text-sm">← Về danh sách sản phẩm</Link>
      </div>
    );
  }

  const images = p.images.length ? p.images : [{ url: primaryImage(p.images) || PRODUCT_PLACEHOLDER, isPrimary: true }];

  async function addToCart() {
    if (!user) { alert('Vui lòng đăng nhập để thêm vào giỏ hàng.'); nav('/login'); return; } // 17E.1
    if (p!.variants.length > 0 && !size) { alert('Vui lòng chọn size.'); return; } // 4E
    if (selectedVariant && avail(selectedVariant) <= 0) return; // 8a - hết hàng
    setAdding(true);
    try {
      await apiAddToCart(p!.id, selectedVariant?.id ?? null, 1);
      recordBehavior(p!.id, 'ADD_TO_CART');
      qc.invalidateQueries({ queryKey: ['cart-count'] });
      alert('Đã thêm vào giỏ hàng.');
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Không thêm được vào giỏ.'); // 4E.1 hết hàng
    } finally { setAdding(false); }
  }

  async function toggleWishlist() {
    if (!user) { alert('Vui lòng đăng nhập để lưu sản phẩm yêu thích.'); nav('/login'); return; } // 3E
    try {
      await addWishlist(p!.id);
      recordBehavior(p!.id, 'WISHLIST');
      qc.invalidateQueries({ queryKey: ['wishlist-ids'] });
      alert('Đã lưu vào yêu thích.');
    } catch { alert('Không lưu được, vui lòng thử lại.'); }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-400 mb-5 flex items-center gap-1.5 flex-wrap">
        <Link to="/" className="hover:text-brand">Trang chủ</Link><span>/</span>
        <Link to={`/?categoryId=${p.category.id}`} className="hover:text-brand">{p.category.name}</Link><span>/</span>
        <span className="text-gray-500 truncate">{p.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* Gallery */}
        <div className="flex gap-3">
          <div className="flex flex-col gap-3 shrink-0">
            {images.map((im, i) => (
              <button key={i} onClick={() => setImg(i)} className={`w-16 h-20 rounded-md overflow-hidden border-2 ${img === i ? 'border-brand' : 'border-transparent'}`}>
                <img src={im.url} alt="" onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }} className="w-full h-full object-cover bg-brand-light" />
              </button>
            ))}
          </div>
          <div className="flex-1 aspect-[4/5] rounded-xl overflow-hidden bg-brand-light">
            <img src={images[img]?.url} alt={p.name} onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }} className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Thông tin */}
        <div>
          {p.brand && <p className="text-[11px] uppercase tracking-widest text-gray-400">{p.brand}</p>}
          <h1 className="font-display text-3xl text-ink mt-1">{p.name}</h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
            <span className="text-amber-500">{'★'.repeat(Math.round(ratingAvg)) || '☆'}</span>
            {ratingCount > 0 ? <span>{ratingAvg.toFixed(1)} ({ratingCount} đánh giá)</span> : <span className="text-gray-400">Chưa có đánh giá</span>}
          </div>

          {/* UC13.1 - giá Flash Sale (nếu đang có) */}
          {p.flashSale ? (
            <div className="mt-4">
              <div className="flex items-baseline gap-3">
                <span className="font-display text-3xl text-red-600">{formatVND(p.flashSale.salePrice)}</span>
                <span className="text-lg text-gray-400 line-through">{formatVND(p.price)}</span>
                <span className="bg-red-600 text-white text-xs font-semibold px-2 py-0.5 rounded">FLASH SALE</span>
              </div>
              <p className="text-sm text-red-600 mt-1">
                ⚡ Chỉ còn {p.flashSale.remaining} suất
                {p.flashSale.perUserLimit != null && ` · tối đa ${p.flashSale.perUserLimit}/khách`}
                {` · kết thúc ${new Date(p.flashSale.endsAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
          ) : (
            <p className="font-display text-3xl text-ink mt-4">{formatVND(p.price)}</p>
          )}
          {p.description && <p className="text-sm text-gray-600 leading-relaxed mt-3">{p.description}</p>}

          {/* Màu sắc (dữ liệu: 1 màu/sản phẩm) */}
          {p.color && (
            <div className="mt-6">
              <p className="text-sm text-ink mb-2">Màu sắc: <span className="text-gray-500">{p.color}</span></p>
              <span className="w-9 h-9 rounded-full border-2 border-brand ring-2 ring-brand/20 inline-block" style={{ background: colorHex(p.color) }} />
            </div>
          )}

          {/* Kích cỡ + bảng size / hướng dẫn */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-ink">Kích cỡ:</p>
              <button onClick={() => setModal('chart')} className="text-xs text-brand hover:underline">Xem bảng size</button>
            </div>
            {p.variants.length === 0 ? (
              <p className="text-xs text-gray-400">Chưa có thông tin size.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {p.variants.map((v) => {
                  const out = avail(v) <= 0; // 8a - biến thể hết hàng
                  const active = size === v.size;
                  return (
                    <button key={v.size} disabled={out} onClick={() => setSize(v.size)}
                      className={`min-w-12 h-11 px-3 rounded-md border text-sm transition-colors relative ${
                        out ? 'border-black/10 text-gray-300 line-through cursor-not-allowed'
                        : active ? 'border-brand bg-brand text-white' : 'border-black/15 text-ink hover:border-brand'}`}>
                      {v.size}
                    </button>
                  );
                })}
              </div>
            )}
            <button onClick={() => setModal('guide')} className="inline-flex items-center gap-1 text-xs text-brand hover:underline mt-3">Hướng dẫn chọn size →</button>

            {/* Tồn kho biến thể đã chọn (7a/8a) */}
            <p className="text-xs mt-3 text-gray-500">
              {!size ? '• Chọn size để xem tồn kho'
                : selectedVariant && avail(selectedVariant) > 0
                  ? <span className="text-green-700">• Còn hàng — size {size}</span>
                  : <span className="text-red-500">• Hết hàng — size {size}</span>}
            </p>
          </div>

          {/* Hành động */}
          <div className="flex items-center gap-3 mt-6">
            <button onClick={addToCart} disabled={adding || (!!selectedVariant && avail(selectedVariant) <= 0)}
              className="flex-1 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg py-3 font-medium inline-flex items-center justify-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" /></svg>
              {adding ? 'Đang thêm…' : 'Thêm vào giỏ hàng'}
            </button>
            <button onClick={toggleWishlist} className="w-12 h-12 grid place-items-center border border-black/15 rounded-lg hover:text-red-500" title="Yêu thích">♡</button>
          </div>
          <button onClick={() => nav('/recommendations')} className="w-full mt-3 border border-black/15 rounded-lg py-3 text-ink hover:border-brand">Xem gợi ý hợp với bạn</button>

          <div className="mt-5 space-y-1.5 text-xs text-gray-500">
            <p>• Miễn phí vận chuyển cho đơn từ 699.000₫</p>
            <p>• Đổi trả dễ dàng trong 30 ngày</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-12 border-b border-black/10 flex gap-6 text-sm">
        {([['desc', 'Mô tả sản phẩm'], ['detail', 'Thông tin chi tiết'], ['reviews', `Đánh giá (${ratingCount})`], ['qa', 'Hỏi đáp']] as [Tab, string][]).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`py-3 -mb-px border-b-2 transition-colors ${tab === k ? 'border-brand text-ink' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>{label}</button>
        ))}
      </div>
      <div className="py-6 text-sm text-gray-600 leading-relaxed max-w-3xl">
        {tab === 'desc' && <p className="whitespace-pre-line">{p.description || 'Chưa có mô tả cho sản phẩm này.'}</p>}
        {tab === 'detail' && (
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
            {([['Danh mục', p.category.name], ['Chất liệu', p.material], ['Màu sắc', p.color], ['Họa tiết', p.pattern], ['Kiểu dáng', p.garmentType], ['Thương hiệu', p.brand]] as [string, string | null | undefined][])
              .filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between border-b border-black/5 py-1.5"><dt className="text-gray-400">{k}</dt><dd className="text-ink">{v}</dd></div>
              ))}
          </dl>
        )}
        {tab === 'reviews' && <ReviewsTab productId={p.id} />}
        {tab === 'qa' && <QaTab productId={p.id} loggedIn={!!user} onLogin={() => nav('/login')} />}
      </div>

      {/* Sản phẩm liên quan */}
      {related && related.length > 0 && (
        <section className="mt-12">
          <h2 className="font-display text-2xl text-ink mb-5">Có thể bạn cũng thích</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-8">
            {related.map((r) => <ProductCard key={r.id} p={{ ...r, sizes: [], soldCount: 0, inStock: true } as any} />)}
          </div>
        </section>
      )}

      {modal && <SizeModal kind={modal} category={p.category.name} onClose={() => setModal(null)} />}
    </div>
  );
}

/* UC7.4 - Bảng size & Hướng dẫn chọn size (R7.6) */
function SizeModal({ kind, category, onClose }: { kind: 'chart' | 'guide'; category: string; onClose: () => void }) {
  const rows = [
    { size: 'S', bust: '82–86', waist: '62–66', hip: '86–90' },
    { size: 'M', bust: '86–90', waist: '66–70', hip: '90–94' },
    { size: 'L', bust: '90–94', waist: '70–74', hip: '94–98' },
    { size: 'XL', bust: '94–98', waist: '74–78', hip: '98–102' },
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl text-ink">{kind === 'chart' ? 'Bảng size' : 'Hướng dẫn chọn size'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {kind === 'chart' ? (
          <>
            <p className="text-xs text-gray-500 mb-3">Đơn vị: cm · Áp dụng cho nhóm {category.toLowerCase()}.</p>
            <table className="w-full text-sm text-center border border-black/10 rounded-lg overflow-hidden">
              <thead className="bg-brand-light text-ink"><tr><th className="py-2">Size</th><th>Ngực</th><th>Eo</th><th>Hông</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.size} className="border-t border-black/5"><td className="py-2 font-medium">{r.size}</td><td>{r.bust}</td><td>{r.waist}</td><td>{r.hip}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div className="text-sm text-gray-600 space-y-3">
            <p>Để chọn size chính xác, hãy đo 3 vòng cơ thể rồi đối chiếu với bảng size:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><b>Vòng ngực:</b> đo quanh phần đầy nhất của ngực.</li>
              <li><b>Vòng eo:</b> đo quanh phần nhỏ nhất của eo.</li>
              <li><b>Vòng hông:</b> đo quanh phần đầy nhất của hông.</li>
            </ul>
            <p>Nếu số đo nằm giữa hai size, hãy chọn size lớn hơn để thoải mái hơn.</p>
            <div className="bg-brand-light rounded-lg p-3 text-ink">
              Chưa chắc dáng của mình? <Link to="/profile/body" onClick={onClose} className="text-brand font-medium underline underline-offset-2">Phân tích dáng người bằng AI</Link> để được gợi ý size và kiểu dáng phù hợp.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Ảnh tải lên có URL tương đối /uploads/... -> thêm origin của API để hiển thị
const MEDIA_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');
const mediaUrl = (u: string) => (u.startsWith('http') ? u : MEDIA_ORIGIN + u);

// UC12.1 - tab Đánh giá sản phẩm
function Stars({ n }: { n: number }) {
  return <span className="text-amber-500">{'★'.repeat(n)}<span className="text-gray-200">{'★'.repeat(5 - n)}</span></span>;
}
function ReviewsTab({ productId }: { productId: number }) {
  const { data } = useQuery({ queryKey: ['reviews', productId], queryFn: () => getProductReviews(productId) });
  if (!data) return <p className="text-gray-400">Đang tải…</p>;
  if (data.count === 0) return <p className="text-gray-400">Chưa có đánh giá nào. Mua và nhận hàng để đánh giá sản phẩm.</p>;
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="font-display text-2xl text-ink">{data.average.toFixed(1)}</span>
        <Stars n={Math.round(data.average)} />
        <span className="text-gray-400">({data.count} đánh giá)</span>
      </div>
      <ul className="space-y-4">
        {data.reviews.map((r) => (
          <li key={r.id} className="border-b border-black/5 pb-3">
            <div className="flex items-center gap-2"><Stars n={r.rating} /><span className="text-xs text-gray-400">{r.userName} · {new Date(r.createdAt).toLocaleDateString('vi-VN')}</span></div>
            {r.comment && <p className="text-ink mt-1">{r.comment}</p>}
            {r.images.length > 0 && <div className="flex gap-2 mt-2">{r.images.map((u, i) => <img key={i} src={mediaUrl(u)} alt="" className="w-16 h-16 object-cover rounded-lg bg-brand-light" onError={(e) => { e.currentTarget.style.display = 'none'; }} />)}</div>}
            {r.sellerReply && <div className="bg-brand-light/50 rounded-lg p-3 mt-2 text-sm"><span className="text-gray-500">Phản hồi của người bán:</span> <span className="text-ink">{r.sellerReply}</span></div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// UC12.3 - tab Hỏi đáp sản phẩm
function QaTab({ productId, loggedIn, onLogin }: { productId: number; loggedIn: boolean; onLogin: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['questions', productId], queryFn: () => getProductQuestions(productId) });
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  async function ask() {
    if (!loggedIn) { onLogin(); return; }
    if (!q.trim()) return;
    setBusy(true);
    try { await createQuestion(productId, q.trim()); setQ(''); qc.invalidateQueries({ queryKey: ['questions', productId] }); alert('Đã gửi câu hỏi. Người bán sẽ trả lời sớm.'); }
    catch (e: any) { alert(e?.response?.data?.message ?? 'Không gửi được câu hỏi.'); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <div className="flex gap-2 mb-5">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Đặt câu hỏi về sản phẩm này…" className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm" />
        <button onClick={ask} disabled={busy} className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg px-4 text-sm">Gửi</button>
      </div>
      {!data || data.length === 0 ? <p className="text-gray-400">Chưa có câu hỏi nào cho sản phẩm này.</p> : (
        <ul className="space-y-4">
          {data.map((item) => (
            <li key={item.id} className="border-b border-black/5 pb-3">
              <p className="text-ink"><span className="text-gray-400 text-xs">{item.askedBy} hỏi:</span> {item.question}</p>
              {item.answer ? <p className="text-sm text-brand mt-1 pl-3 border-l-2 border-brand/30">Người bán: {item.answer}</p> : <p className="text-xs text-amber-600 mt-1">Chờ người bán trả lời</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
