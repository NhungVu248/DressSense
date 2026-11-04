import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatVND } from '../lib/products';
import VoucherPicker, { type AppliedVoucher } from '../components/VoucherPicker';
import {
  getCheckoutInfo, placeOrder, createAddress,
  PAYMENT_METHOD_LABEL, type PaymentMethod, type Address,
} from '../lib/order';

export default function CheckoutPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({ queryKey: ['checkout'], queryFn: getCheckoutInfo });

  const [addressId, setAddressId] = useState<number | null>(null);
  const [shipping, setShipping] = useState('STANDARD');
  const [payment, setPayment] = useState<PaymentMethod>('COD');
  const [applied, setApplied] = useState<AppliedVoucher | null>(null); // mã giảm giá
  const [appliedShip, setAppliedShip] = useState<AppliedVoucher | null>(null); // mã vận chuyển
  const [showVoucher, setShowVoucher] = useState(false);
  const [note, setNote] = useState('');
  const [showAddr, setShowAddr] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');

  const subtotal = data?.subtotal ?? 0;
  const method = data?.shippingMethods.find((m) => m.code === shipping);
  const methodFee = method?.fee ?? 0;
  const cfg = data?.shippingConfig;

  // chọn địa chỉ mặc định khi tải xong
  const defaultAddr = data?.addresses.find((a) => a.isDefault) ?? data?.addresses[0];
  const selectedAddr = addressId ?? defaultAddr?.id ?? null;
  const destProvince = data?.addresses.find((a) => a.id === selectedAddr)?.province ?? '';
  const isRemote = !!cfg && cfg.remoteProvinces.some((r) => destProvince.toLowerCase().includes(r.toLowerCase()));

  // Multi-shop: nhóm theo gian hàng; phí vận chuyển tính riêng mỗi gian hàng (khớp logic backend)
  const shops = useMemo(() => {
    const valid = (data?.items ?? []).filter((i) => i.valid);
    const map = new Map<number, { seller: string; items: typeof valid; subtotal: number; selfDelivery: boolean; selfDeliveryFee: number }>();
    for (const it of valid) {
      if (!map.has(it.sellerId)) map.set(it.sellerId, { seller: it.seller, items: [], subtotal: 0, selfDelivery: !!it.selfDelivery, selfDeliveryFee: it.selfDeliveryFee ?? 0 });
      const g = map.get(it.sellerId)!; g.items.push(it); g.subtotal += it.lineTotal;
    }
    const threshold = cfg?.threshold ?? 699000;
    const surcharge = isRemote ? (cfg?.surcharge ?? 0) : 0;
    return [...map.values()].map((g) => {
      let shipFee: number;
      if (g.selfDelivery) shipFee = Math.max(0, g.selfDeliveryFee); // người bán tự giao
      else if (method?.intl) shipFee = methodFee; // quốc tế: phí cố định
      else shipFee = (g.subtotal >= threshold ? 0 : methodFee) + surcharge;
      return { ...g, shipFee };
    });
  }, [data, methodFee, method?.intl, cfg, isRemote]);
  const shipFee = shops.reduce((a, s) => a + s.shipFee, 0);
  const discount = applied?.discount ?? 0;
  const shippingDiscount = Math.min(appliedShip?.discount ?? 0, shipFee); // không vượt phí ship hiện tại
  const total = Math.max(0, subtotal - discount - shippingDiscount + shipFee);

  // Backlog C.37 - lọc theo phương thức Admin cho phép (online còn cần VNPAY đã cấu hình)
  const pm = data?.paymentMethods;
  const paymentOptions: PaymentMethod[] = ([
    ['COD', pm ? pm.COD : true],
    ['VNPAY', (pm ? pm.VNPAY : true) && !!data?.vnpayEnabled],
    ['VISA', (pm ? pm.VISA : true) && !!data?.vnpayEnabled],
  ] as [PaymentMethod, boolean][]).filter(([, ok]) => ok).map(([m]) => m);

  // nếu phương thức đang chọn bị tắt, chuyển về phương thức khả dụng đầu tiên
  useEffect(() => {
    if (paymentOptions.length && !paymentOptions.includes(payment)) setPayment(paymentOptions[0]);
  }, [paymentOptions.join(','), payment]);

  function applyPicked(v: AppliedVoucher) {
    if (v.kind === 'SHIPPING') setAppliedShip(v);
    else setApplied(v);
  }
  function clearVoucher(kind: 'DISCOUNT' | 'SHIPPING') {
    if (kind === 'SHIPPING') setAppliedShip(null);
    else setApplied(null);
  }

  async function submit() {
    setError('');
    if (!selectedAddr) { setError('Vui lòng chọn địa chỉ giao hàng.'); return; }
    setPlacing(true);
    try {
      const res = await placeOrder({ addressId: selectedAddr, shippingMethod: shipping, paymentMethod: payment, voucherCode: applied?.code, shippingVoucherCode: appliedShip?.code, note: note || undefined });
      qc.invalidateQueries({ queryKey: ['cart-count'] });
      if (res.payUrl) { window.location.href = res.payUrl; return; } // chuyển sang cổng VNPAY (thanh toán gộp)
      // COD: một checkout có thể tạo nhiều đơn (theo gian hàng) -> về danh sách đơn
      if (res.orders.length === 1) nav(`/checkout/result?orderId=${res.orders[0].id}&status=success&cod=1`);
      else nav('/orders');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Không đặt được hàng, vui lòng thử lại.');
    } finally { setPlacing(false); }
  }

  if (isLoading) return <p className="text-center py-24 text-gray-400">Đang tải…</p>;
  const validItems = data?.items.filter((i) => i.valid) ?? [];
  if (validItems.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <p className="font-display text-2xl text-ink">Không có sản phẩm để đặt</p>
        <p className="text-sm text-gray-500 mt-2">Hãy chọn sản phẩm trong giỏ hàng trước khi thanh toán.</p>
        <button onClick={() => nav('/cart')} className="mt-5 bg-brand text-white rounded-full px-5 py-2.5 text-sm">Về giỏ hàng</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-6">Thanh toán</h1>
      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2.5 mb-4">{error}</div>}

      <div className="grid lg:grid-cols-[1fr_20rem] gap-8 items-start">
        <div className="space-y-5">
          {/* Địa chỉ giao hàng */}
          <section className="bg-white rounded-xl border border-black/5 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-ink">Địa chỉ giao hàng</h2>
              <button onClick={() => setShowAddr((v) => !v)} className="text-xs text-brand hover:underline">+ Thêm địa chỉ</button>
            </div>
            {data!.addresses.length === 0 && !showAddr && <p className="text-sm text-gray-400">Chưa có địa chỉ. Hãy thêm địa chỉ giao hàng.</p>}
            <div className="space-y-2">
              {data!.addresses.map((a) => (
                <label key={a.id} className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${selectedAddr === a.id ? 'border-brand bg-brand-light/40' : 'border-black/10'}`}>
                  <input type="radio" name="addr" checked={selectedAddr === a.id} onChange={() => setAddressId(a.id)} className="mt-1 accent-brand" />
                  <span className="text-sm">
                    <span className="font-medium text-ink">{a.recipientName}</span> · {a.phone}
                    {a.isDefault && <span className="ml-2 text-[10px] bg-brand text-white px-1.5 py-0.5 rounded">Mặc định</span>}
                    <span className="block text-gray-500">{a.detail}, {a.ward}, {a.district}, {a.province}</span>
                  </span>
                </label>
              ))}
            </div>
            {showAddr && <AddressForm onDone={async () => { setShowAddr(false); await refetch(); }} />}
          </section>

          {/* Vận chuyển */}
          <section className="bg-white rounded-xl border border-black/5 p-5">
            <h2 className="font-medium text-ink mb-3">Phương thức vận chuyển</h2>
            <div className="space-y-2">
              {data!.shippingMethods.map((m) => (
                <label key={m.code} className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer ${shipping === m.code ? 'border-brand bg-brand-light/40' : 'border-black/10'}`}>
                  <span className="flex items-center gap-2 text-sm">
                    <input type="radio" name="ship" checked={shipping === m.code} onChange={() => setShipping(m.code)} className="accent-brand" />
                    <span><span className="text-ink">{m.label}</span> <span className="text-gray-400">· {m.eta}</span></span>
                  </span>
                  <span className="text-sm text-gray-500">{formatVND(m.fee)}/gian hàng</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Miễn phí vận chuyển cho mỗi gian hàng có đơn từ {formatVND(cfg?.threshold ?? 699000)} (không áp dụng cho giao quốc tế).</p>
            {isRemote && <p className="text-xs text-amber-600 mt-1">Địa chỉ thuộc khu vực xa — phụ phí {formatVND(cfg?.surcharge ?? 0)}/gian hàng.</p>}
          </section>

          {/* Thanh toán */}
          <section className="bg-white rounded-xl border border-black/5 p-5">
            <h2 className="font-medium text-ink mb-3">Phương thức thanh toán</h2>
            <div className="space-y-2">
              {paymentOptions.map((m) => (
                <label key={m} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer text-sm ${payment === m ? 'border-brand bg-brand-light/40' : 'border-black/10'}`}>
                  <input type="radio" name="pay" checked={payment === m} onChange={() => setPayment(m)} className="accent-brand" />
                  <span className="text-ink">{PAYMENT_METHOD_LABEL[m]}</span>
                </label>
              ))}
              {!data!.vnpayEnabled && <p className="text-xs text-gray-400">Thanh toán online (VNPAY/Visa) chưa được cấu hình trên máy chủ — hiện dùng COD.</p>}
            </div>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú cho đơn hàng (tuỳ chọn)" rows={2}
              className="w-full mt-3 border border-black/10 rounded-lg px-3 py-2 text-sm" />
          </section>

          {/* Sản phẩm - nhóm theo gian hàng (multi-shop: mỗi gian hàng tạo 1 đơn riêng) */}
          <section className="bg-white rounded-xl border border-black/5 p-5">
            <h2 className="font-medium text-ink mb-3">Sản phẩm {shops.length > 1 && <span className="text-sm text-gray-400">· {shops.length} gian hàng → {shops.length} đơn</span>}</h2>
            <div className="space-y-4">
              {shops.map((shop) => (
                <div key={shop.seller} className="border border-black/5 rounded-lg p-3">
                  <p className="text-sm font-medium text-ink mb-1.5 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="text-gray-400"><path d="M3 9l1-5h16l1 5M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16" /></svg>
                    {shop.seller}
                  </p>
                  <ul className="divide-y divide-black/5">
                    {shop.items.map((it) => (
                      <li key={it.cartItemId} className="flex items-center justify-between py-1.5 text-sm">
                        <span className="text-ink">{it.name} {it.size && <span className="text-gray-400">· Size {it.size}</span>} <span className="text-gray-400">× {it.quantity}</span></span>
                        <span>{formatVND(it.lineTotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-between text-xs text-gray-500 mt-1.5 pt-1.5 border-t border-black/5">
                    <span>Vận chuyển{shop.selfDelivery && <span className="text-brand"> · Người bán tự giao</span>}</span><span>{shop.shipFee === 0 ? 'Miễn phí' : formatVND(shop.shipFee)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Tóm tắt */}
        <aside className="bg-white rounded-xl border border-black/5 p-5 lg:sticky lg:top-28 space-y-4">
          <h2 className="font-medium text-ink">Tóm tắt</h2>

          {/* Voucher kiểu Shopee: 1 mã giảm giá + 1 mã vận chuyển */}
          <button onClick={() => setShowVoucher(true)} className="w-full flex items-center justify-between gap-2 border border-black/10 rounded-lg px-3 py-2.5 text-sm hover:border-brand transition-colors">
            <span className="flex items-center gap-2 text-ink">🎟️ Mã khuyến mãi</span>
            <span className="text-brand">{applied || appliedShip ? `${(applied ? 1 : 0) + (appliedShip ? 1 : 0)} mã đã chọn` : 'Chọn / nhập mã'} ›</span>
          </button>
          {applied && (
            <div className="flex items-center justify-between text-sm bg-brand-light rounded-lg px-3 py-2">
              <span className="text-brand font-medium">🏷️ {applied.code}</span><button onClick={() => setApplied(null)} className="text-xs text-gray-500">Bỏ</button>
            </div>
          )}
          {appliedShip && (
            <div className="flex items-center justify-between text-sm bg-emerald-50 rounded-lg px-3 py-2">
              <span className="text-emerald-700 font-medium">🚚 {appliedShip.code}</span><button onClick={() => setAppliedShip(null)} className="text-xs text-gray-500">Bỏ</button>
            </div>
          )}

          <div className="border-t border-black/5 pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Tạm tính</span><span>{formatVND(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-brand"><span>Giảm giá</span><span>−{formatVND(discount)}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500">Vận chuyển</span><span>{shipFee === 0 ? 'Miễn phí' : formatVND(shipFee)}</span></div>
            {shippingDiscount > 0 && <div className="flex justify-between text-emerald-600"><span>Giảm phí vận chuyển</span><span>−{formatVND(shippingDiscount)}</span></div>}
            <div className="flex justify-between font-semibold text-ink text-base pt-1"><span>Tổng cộng</span><span>{formatVND(total)}</span></div>
          </div>

          <button onClick={submit} disabled={placing || !selectedAddr}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-white rounded-lg py-3 font-medium">
            {placing ? 'Đang đặt hàng…' : payment === 'COD' ? 'Đặt hàng' : 'Đặt hàng & thanh toán'}
          </button>
          <p className="text-[11px] text-gray-400 text-center">Nhấn Đặt hàng nghĩa là bạn đồng ý với điều khoản mua hàng của DressSense.</p>
        </aside>
      </div>

      {showVoucher && (
        <VoucherPicker
          subtotal={subtotal} shipFee={shipFee}
          applied={applied} appliedShip={appliedShip}
          onApply={applyPicked} onClear={clearVoucher} onClose={() => setShowVoucher(false)}
        />
      )}
    </div>
  );
}

function AddressForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ recipientName: '', phone: '', province: '', district: '', ward: '', detail: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  async function save() {
    if (!f.recipientName || !f.phone || !f.province || !f.district || !f.ward || !f.detail) { alert('Vui lòng điền đầy đủ thông tin địa chỉ.'); return; }
    setBusy(true);
    try { await createAddress({ ...f, isDefault: true }); onDone(); }
    catch { alert('Không lưu được địa chỉ.'); }
    finally { setBusy(false); }
  }
  return (
    <div className="mt-3 border-t border-black/5 pt-3 grid grid-cols-2 gap-2">
      <input value={f.recipientName} onChange={set('recipientName')} placeholder="Họ tên người nhận" className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
      <input value={f.phone} onChange={set('phone')} placeholder="Số điện thoại" className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
      <input value={f.province} onChange={set('province')} placeholder="Tỉnh/Thành phố" className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
      <input value={f.district} onChange={set('district')} placeholder="Quận/Huyện" className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
      <input value={f.ward} onChange={set('ward')} placeholder="Phường/Xã" className="border border-black/10 rounded-lg px-3 py-2 text-sm" />
      <input value={f.detail} onChange={set('detail')} placeholder="Địa chỉ chi tiết" className="border border-black/10 rounded-lg px-3 py-2 text-sm col-span-2" />
      <button onClick={save} disabled={busy} className="col-span-2 bg-brand text-white rounded-lg py-2 text-sm disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu địa chỉ'}</button>
    </div>
  );
}
