import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchSuggestions, formatVND, type Suggestion } from '../lib/products';
import { PRODUCT_PLACEHOLDER } from '../lib/placeholder';

interface SearchBarProps {
  className?: string;
  onNavigate?: () => void;
  onOpenVisualSearch?: () => void;
}

// UC7.1 - Ô tìm kiếm có gợi ý/tự hoàn thành + tìm kiếm bằng hình ảnh
export default function SearchBar({ className = '', onNavigate, onOpenVisualSearch }: SearchBarProps) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Gợi ý theo thời gian thực (debounce 250ms) - UC7.1 luồng 3/3a
  useEffect(() => {
    const kw = q.trim();
    if (kw.length < 1) { setItems([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try { setItems(await fetchSuggestions(kw)); } catch { setItems([]); } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  // Đóng dropdown khi bấm ra ngoài
  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function submit(keyword: string) {
    const kw = keyword.trim();
    if (!kw) return;
    setOpen(false);
    onNavigate?.();
    nav(`/products?q=${encodeURIComponent(kw)}`);
  }

  function goProduct(id: number) {
    setOpen(false);
    onNavigate?.();
    nav(`/products/${id}`);
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form
        onSubmit={(e) => { e.preventDefault(); submit(q); }}
        className="flex items-center gap-2 bg-black/[0.04] border border-black/5 rounded-full px-3.5 h-10 focus-within:border-brand/40 focus-within:bg-white transition-all shadow-2xs"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 shrink-0">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Tìm phong cách, sản phẩm..."
          className="bg-transparent outline-none text-sm w-full placeholder:text-gray-400"
          aria-label="Tìm kiếm sản phẩm"
        />
        {q && (
          <button type="button" onClick={() => { setQ(''); setItems([]); }} className="text-gray-400 hover:text-gray-600 text-sm p-1" aria-label="Xóa">✕</button>
        )}
        {onOpenVisualSearch && (
          <button
            type="button"
            onClick={onOpenVisualSearch}
            className="text-gray-400 hover:text-brand p-1 shrink-0 transition-colors"
            title="Tìm kiếm bằng hình ảnh (AI)"
            aria-label="Tìm kiếm bằng hình ảnh"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
        )}
      </form>

      {open && q.trim() && (
        <div className="absolute z-40 mt-2 w-full sm:w-96 right-0 bg-white rounded-xl shadow-xl border border-black/5 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 text-[11px] uppercase tracking-wider text-gray-400 border-b">
            <span>Gợi ý tìm kiếm</span>
            <button onClick={() => setOpen(false)} className="hover:text-gray-600">✕</button>
          </div>
          {loading && items.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-400">Đang tìm…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-400">Không có gợi ý phù hợp.</p>
          ) : (
            <ul>
              {items.map((it) => (
                <li key={it.id}>
                  <button onClick={() => goProduct(it.id)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-cream text-left">
                    <img src={it.image || PRODUCT_PLACEHOLDER} alt="" onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }} className="w-10 h-12 object-cover rounded bg-brand-light shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-ink truncate">{it.name}</span>
                      <span className="block text-xs text-brand">{formatVND(it.price)}</span>
                    </span>
                    <span className="text-gray-300">→</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => submit(q)} className="w-full text-left px-4 py-3 text-sm border-t hover:bg-cream text-ink font-medium">
            Xem tất cả kết quả cho “<span className="text-brand">{q.trim()}</span>”
          </button>
        </div>
      )}
    </div>
  );
}
