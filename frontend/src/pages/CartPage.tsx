import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PRODUCT_PLACEHOLDER } from '../lib/placeholder';
import { formatVND } from '../lib/products';
import {
  getCart, updateCartItem, removeCartItem, listVouchers, applyVoucher,
  type CartItem, type Voucher,
} from '../lib/cart';

export default function CartPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: cart, isLoading } = useQuery({ queryKey: ['cart'], queryFn: getCart });
  const { data: vouchers } = useQuery({ queryKey: ['vouchers'], queryFn: listVouchers, staleTime: 5 * 60 * 1000 });

  const [code, setCode] = useState('');
  const [applied, setApplied] = useState<{ voucher: Voucher; discount: number } | null>(null);
  const [voucherMsg, setVoucherMsg] = useState('');

  const refresh = () => { qc.invalidateQueries({ queryKey: ['cart'] }); qc.invalidateQueries({ queryKey: ['cart-count'] }); };

  async function patch(id: number, p: { quantity?: number; selected?: boolean; variantId?: number }) {
    try { await updateCartItem(id, p); refresh(); } catch (e: any) { alert(e?.response?.data?.message ?? 'Không cập nhật được.'); }
  }
  async function remove(id: number) { await removeCartItem(id); refresh(); }

  const subtotal = cart?.selectedSubtotal ?? 0;

  // UC8.3 - khi giỏ (tổng tiền) đổi, kiểm tra lại voucher đã áp
  useEffect(() => {
    if (!applied) return;
    (async () => {
      const r = await applyVoucher(applied.voucher.code, subtotal);
      if (r.valid) setApplied({ voucher: r.voucher!, discount: r.discount });
      else { setApplied(null); setVoucherMsg(r.message); } // 7a - voucher hết hiệu lực khi giỏ đổi
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  async function doApply(c: string) {
    setVoucherMsg('');
    if (!c.trim()) return;
    if (subtotal <= 0) { setVoucherMsg('Hãy chọn sản phẩm trước khi áp mã.'); return; }
    const r = await applyVoucher(c.trim(), subtotal);
    if (r.valid && r.voucher) { setApplied({ voucher: r.voucher, discount: r.discount }); setCode(''); setVoucherMsg(''); }
    else { setApplied(null); setVoucherMsg(r.message); }
  }

  function goCheckout() {
    if (!cart || cart.selectedCount === 0) { alert('Hãy chọn ít nhất một sản phẩm để thanh toán.'); return; }
    nav('/checkout'); // UC9.1 - sang trang đặt hàng
  }

  if (isLoading) return <p className="text-center py-24 text-gray-400">Đang tải giỏ hàng…</p>;

  const empty = !cart || cart.totalCount === 0;
  const discount = applied?.discount ?? 0;
  const total = Math.max(0, subtotal - discount);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-6">Giỏ hàng</h1>

      {empty ? (
        <div className="text-center py-20 border border-dashed border-black/10 rounded-xl">
          <p className="font-display text-xl text-ink">Giỏ hàng của bạn đang trống</p>
          <p className="text-sm text-gray-500 mt-2">Khám phá bộ sưu tập và thêm vài thiết kế bạn yêu.</p>
          <Link to="/" className="inline-block mt-4 bg-brand text-white rounded-full px-5 py-2.5 text-sm">Mua sắm ngay</Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_20rem] gap-8 items-start">
          {/* Danh sách theo gian hàng */}
          <div className="space-y-6">
            {cart!.shops.map((shop) => (
              <div key={shop.seller.id} className="bg-white rounded-xl border border-black/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-black/5 flex items-center gap-2 text-sm">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="text-gray-400"><path d="M3 9l1-5h16l1 5M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16" /></svg>
                  <span className="font-medium text-ink">{shop.seller.name}</span>
                </div>
                <ul>
                  {shop.items.map((it) => <CartRow key={it.id} it={it} onPatch={patch} onRemove={remove} />)}
                </ul>
              </div>
            ))}
          </div>

          {/* Tóm tắt + voucher */}
          <aside className="bg-white rounded-xl border border-black/5 p-5 lg:sticky lg:top-28 space-y-4">
            <h2 className="font-medium text-ink">Tóm tắt đơn hàng</h2>

            {/* Voucher */}
            <div>
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Nhập mã giảm giá"
                  className="flex-1 border border-black/10 rounded-lg px-3 py-2 text-sm uppercase" />
                <button onClick={() => doApply(code)} className="bg-ink text-white rounded-lg px-3 text-sm">Áp dụng</button>
              </div>
              {voucherMsg && <p className="text-xs text-red-500 mt-1.5">{voucherMsg}</p>}
              {applied && (
                <div className="flex items-center justify-between mt-2 text-sm bg-brand-light rounded-lg px-3 py-2">
                  <span className="text-brand font-medium">{applied.voucher.code}</span>
                  <button onClick={() => { setApplied(null); setVoucherMsg(''); }} className="text-xs text-gray-500 hover:text-red-500">Bỏ</button>
                </div>
              )}
              {vouchers && vouchers.length > 0 && !applied && (
                <div className="mt-2 space-y-1">
                  {vouchers.slice(0, 3).map((v) => (
                    <button key={v.code} onClick={() => doApply(v.code)} className="w-full text-left text-xs border border-dashed border-black/15 rounded-lg px-2.5 py-1.5 hover:border-brand">
                      <span className="font-medium text-ink">{v.code}</span> — <span className="text-gray-500">{v.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-black/5 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Tạm tính ({cart!.selectedCount} mục)</span><span>{formatVND(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-brand"><span>Giảm giá</span><span>−{formatVND(discount)}</span></div>}
              <div className="flex justify-between font-semibold text-ink text-base pt-1"><span>Tổng cộng</span><span>{formatVND(total)}</span></div>
            </div>

            {cart!.hasInvalid && <p className="text-xs text-amber-600">Một số mục đang chọn đã hết hàng/ngừng bán và sẽ bị loại khi thanh toán.</p>}

            <button onClick={goCheckout} disabled={cart!.selectedCount === 0}
              className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg py-3 font-medium">
              Thanh toán ({cart!.selectedCount})
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}

function CartRow({ it, onPatch, onRemove }:
  { it: CartItem; onPatch: (id: number, p: { quantity?: number; selected?: boolean; variantId?: number }) => void; onRemove: (id: number) => void }) {
  return (
    <li className={`flex gap-3 p-4 border-b border-black/5 last:border-0 ${!it.valid ? 'opacity-70' : ''}`}>
      <input type="checkbox" checked={it.selected} disabled={!it.valid} onChange={(e) => onPatch(it.id, { selected: e.target.checked })} className="mt-1 accent-brand" />
      <Link to={`/products/${it.product.id}`} className="shrink-0">
        <img src={it.product.image || PRODUCT_PLACEHOLDER} alt="" onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }} className="w-20 h-24 object-cover rounded-lg bg-brand-light" />
      </Link>
      <div className="flex-1 min-w-0">
        <Link to={`/products/${it.product.id}`} className="text-sm text-ink hover:text-brand line-clamp-1">{it.product.name}</Link>
        {/* Đổi size (5a) */}
        {it.product.sizes.length > 0 && (
          <select value={it.variant?.id ?? ''} onChange={(e) => onPatch(it.id, { variantId: Number(e.target.value) })}
            className="mt-1 text-xs border border-black/10 rounded-md px-2 py-1 bg-white">
            {it.product.sizes.map((s) => <option key={s.id} value={s.id} disabled={s.available <= 0}>Size {s.size}{s.available <= 0 ? ' (hết)' : ''}</option>)}
          </select>
        )}
        {!it.sellable && <p className="text-xs text-red-500 mt-1">Sản phẩm đã ngừng bán</p>}
        {it.sellable && !it.inStock && <p className="text-xs text-red-500 mt-1">Biến thể đã hết hàng</p>}
        <div className="flex items-center justify-between gap-2 mt-2">
          {/* Bộ đếm số lượng (13E) */}
          <div className="inline-flex items-center border border-black/10 rounded-lg">
            <button onClick={() => it.quantity > 1 && onPatch(it.id, { quantity: it.quantity - 1 })} disabled={it.quantity <= 1} className="w-8 h-8 disabled:opacity-30">−</button>
            <span className="w-8 text-center text-sm">{it.quantity}</span>
            <button onClick={() => it.quantity < it.maxQty && onPatch(it.id, { quantity: it.quantity + 1 })} disabled={it.quantity >= it.maxQty} className="w-8 h-8 disabled:opacity-30">+</button>
          </div>
          <span className="font-semibold text-ink text-sm">{formatVND(it.lineTotal)}</span>
        </div>
      </div>
      <button onClick={() => onRemove(it.id)} className="text-gray-300 hover:text-red-500 self-start" title="Xóa">✕</button>
    </li>
  );
}
