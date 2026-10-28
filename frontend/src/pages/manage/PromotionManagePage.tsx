import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import { ErrorBox, SuccessBox, PrimaryButton, SecondaryButton } from '../../components/ui';
import { money, fmtDate, toLocalInput, StatusBadge, inp, L, Modal } from '../../components/promo-ui';

// ============================================================
//  UC13.1 - Quản lý khuyến mãi (Voucher + Flash Sale).
//  Dùng chung cho Người bán (/manage/promotions) và Quản trị viên (/admin/promotions);
//  backend tự giới hạn phạm vi theo vai trò.
// ============================================================

interface Voucher {
  id: number; code: string; description: string | null; type: 'PERCENT' | 'FIXED'; value: number;
  minOrder: number; maxDiscount: number | null; startsAt: string | null; endsAt: string | null;
  usageLimit: number | null; usedCount: number; perUserLimit: number | null; status: string;
  scope: 'ALL' | 'PRODUCT' | 'CATEGORY'; scopeIds: number[]; sellerId: number | null;
}
interface FlashSale {
  id: number; productId: number; salePrice: number; quantity: number; soldCount: number;
  perUserLimit: number | null; startsAt: string; endsAt: string; status: string;
  product: { id: number; name: string; price: number; images: { url: string }[] };
}

export default function PromotionManagePage() {
  const [tab, setTab] = useState<'voucher' | 'flash'>('voucher');
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [voucherForm, setVoucherForm] = useState<Voucher | 'new' | null>(null);
  const [flashForm, setFlashForm] = useState<FlashSale | 'new' | null>(null);

  function load() {
    setLoading(true);
    Promise.all([api.get('/promotions/vouchers'), api.get('/promotions/flash-sales')])
      .then(([v, f]) => { setVouchers(v.data.vouchers); setFlashSales(f.data.flashSales); })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function act(url: string, okMsg: string) {
    setError(''); setSuccess('');
    try { await api.post(url); setSuccess(okMsg); load(); } catch (e) { setError(getErrorMessage(e)); }
  }
  async function del(kind: 'vouchers' | 'flash-sales', id: number, name: string) {
    if (!confirm(`Xóa "${name}"? Chỉ xóa được bản Nháp.`)) return;
    setError(''); setSuccess('');
    try { await api.delete(`/promotions/${kind}/${id}`); setSuccess('Đã xóa.'); load(); } catch (e) { setError(getErrorMessage(e)); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-display font-bold text-ink">Khuyến mãi</h1>
      <p className="text-sm text-gray-500 mb-4">Tạo và theo dõi mã giảm giá & chương trình Flash Sale cho gian hàng của bạn.</p>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="inline-flex rounded-lg border border-brand/20 bg-white p-1">
          {(['voucher', 'flash'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${tab === t ? 'bg-brand text-white' : 'text-gray-600 hover:text-brand'}`}>
              {t === 'voucher' ? 'Voucher' : 'Flash Sale'}
            </button>
          ))}
        </div>
        {tab === 'voucher'
          ? <PrimaryButton style={{ width: 'auto' }} onClick={() => setVoucherForm('new')}>+ Tạo voucher</PrimaryButton>
          : <PrimaryButton style={{ width: 'auto' }} onClick={() => setFlashForm('new')}>+ Tạo Flash Sale</PrimaryButton>}
      </div>

      {loading ? <p className="text-gray-400">Đang tải...</p> : tab === 'voucher' ? (
        vouchers.length === 0 ? <Empty label="Chưa có voucher nào." /> : (
          <div className="bg-white border border-brand/10 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-brand/5 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Mã</th>
                  <th className="text-left px-3 py-2">Giảm</th>
                  <th className="text-left px-3 py-2">Phạm vi</th>
                  <th className="text-left px-3 py-2">Hiệu lực</th>
                  <th className="text-center px-3 py-2">Đã dùng</th>
                  <th className="text-center px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id} className="border-t border-brand/10">
                    <td className="px-3 py-2 font-mono font-semibold">{v.code}{v.description && <div className="font-sans font-normal text-xs text-gray-400">{v.description}</div>}</td>
                    <td className="px-3 py-2">{v.type === 'PERCENT' ? `${v.value}%${v.maxDiscount ? ` (tối đa ${money(v.maxDiscount)})` : ''}` : money(v.value)}{v.minOrder > 0 && <div className="text-xs text-gray-400">đơn từ {money(v.minOrder)}</div>}</td>
                    <td className="px-3 py-2 text-gray-600">{v.scope === 'ALL' ? 'Toàn bộ' : v.scope === 'PRODUCT' ? `SP (${v.scopeIds.length})` : `Danh mục (${v.scopeIds.length})`}{v.sellerId == null && <div className="text-xs text-amber-600">Toàn hệ thống</div>}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{fmtDate(v.startsAt)}<br />→ {fmtDate(v.endsAt)}</td>
                    <td className="px-3 py-2 text-center">{v.usedCount}{v.usageLimit ? `/${v.usageLimit}` : ''}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={v.status} /></td>
                    <td className="px-3 py-2"><RowActions
                      status={v.status}
                      onEdit={() => setVoucherForm(v)}
                      onActivate={() => act(`/promotions/vouchers/${v.id}/activate`, `Đã kích hoạt ${v.code}.`)}
                      onStop={() => act(`/promotions/vouchers/${v.id}/stop`, `Đã ngừng ${v.code}.`)}
                      onDelete={() => del('vouchers', v.id, v.code)}
                    /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        flashSales.length === 0 ? <Empty label="Chưa có Flash Sale nào." /> : (
          <div className="bg-white border border-brand/10 rounded-xl overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="bg-brand/5 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Sản phẩm</th>
                  <th className="text-right px-3 py-2">Giá Flash</th>
                  <th className="text-center px-3 py-2">Suất</th>
                  <th className="text-left px-3 py-2">Hiệu lực</th>
                  <th className="text-center px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {flashSales.map((f) => (
                  <tr key={f.id} className="border-t border-brand/10">
                    <td className="px-3 py-2"><div className="flex items-center gap-2"><img src={f.product.images[0]?.url || 'https://placehold.co/40x50?text=%20'} className="w-9 h-11 object-cover rounded bg-gray-100 border" /><span className="font-medium line-clamp-2">{f.product.name}</span></div></td>
                    <td className="px-3 py-2 text-right">{money(f.salePrice)}<div className="text-xs text-gray-400 line-through">{money(f.product.price)}</div></td>
                    <td className="px-3 py-2 text-center">{f.soldCount}/{f.quantity}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{fmtDate(f.startsAt)}<br />→ {fmtDate(f.endsAt)}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge status={f.status} /></td>
                    <td className="px-3 py-2"><RowActions
                      status={f.status}
                      onEdit={() => setFlashForm(f)}
                      onActivate={() => act(`/promotions/flash-sales/${f.id}/activate`, 'Đã kích hoạt Flash Sale.')}
                      onStop={() => act(`/promotions/flash-sales/${f.id}/stop`, 'Đã ngừng Flash Sale.')}
                      onDelete={() => del('flash-sales', f.id, f.product.name)}
                    /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {voucherForm && <VoucherFormModal initial={voucherForm === 'new' ? null : voucherForm} onClose={(ok) => { setVoucherForm(null); if (ok) { setSuccess('Đã lưu voucher (trạng thái Nháp — nhớ Kích hoạt).'); load(); } }} />}
      {flashForm && <FlashFormModal initial={flashForm === 'new' ? null : flashForm} onClose={(ok) => { setFlashForm(null); if (ok) { setSuccess('Đã lưu Flash Sale (trạng thái Nháp — nhớ Kích hoạt).'); load(); } }} />}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="bg-white border border-brand/10 rounded-xl p-8 text-center text-gray-500">{label}</div>;
}

function RowActions({ status, onEdit, onActivate, onStop, onDelete }: { status: string; onEdit: () => void; onActivate: () => void; onStop: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-2 justify-end text-xs whitespace-nowrap">
      {(status === 'DRAFT' || status === 'SCHEDULED') && <button onClick={onActivate} className="text-green-600 hover:underline">Kích hoạt</button>}
      {(status === 'RUNNING' || status === 'SCHEDULED') && <button onClick={onStop} className="text-amber-600 hover:underline">Ngừng</button>}
      {status !== 'ENDED' && <button onClick={onEdit} className="text-brand hover:underline">Sửa</button>}
      {status === 'DRAFT' && <button onClick={onDelete} className="text-red-500 hover:underline">Xóa</button>}
    </div>
  );
}

// --------------------------- Modal: Voucher ---------------------------
function VoucherFormModal({ initial, onClose }: { initial: Voucher | null; onClose: (ok: boolean) => void }) {
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [f, setF] = useState({
    code: initial?.code ?? '', description: initial?.description ?? '', type: initial?.type ?? 'PERCENT',
    value: initial?.value ?? 10, minOrder: initial?.minOrder ?? 0, maxDiscount: initial?.maxDiscount ?? null as number | null,
    usageLimit: initial?.usageLimit ?? null as number | null, perUserLimit: initial?.perUserLimit ?? null as number | null,
    scope: initial?.scope ?? 'ALL', scopeIds: initial?.scopeIds ?? [] as number[],
    startsAt: toLocalInput(initial?.startsAt ?? null), endsAt: toLocalInput(initial?.endsAt ?? null),
  });
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);
  const running = initial?.status === 'RUNNING';

  useEffect(() => {
    api.get('/categories').then((r) => setCategories(r.data.categories)).catch(() => {});
    api.get('/products/manage?limit=200').then((r) => setProducts(r.data.items.map((p: any) => ({ id: p.id, name: p.name })))).catch(() => {});
  }, []);

  function toggleScopeId(id: number) {
    setF((s) => ({ ...s, scopeIds: s.scopeIds.includes(id) ? s.scopeIds.filter((x) => x !== id) : [...s.scopeIds, id] }));
  }

  async function submit() {
    setErr(''); setSaving(true);
    const payload: any = {
      code: f.code, description: f.description || undefined, type: f.type, value: Number(f.value),
      minOrder: Number(f.minOrder), maxDiscount: f.type === 'PERCENT' && f.maxDiscount ? Number(f.maxDiscount) : null,
      usageLimit: f.usageLimit ? Number(f.usageLimit) : null, perUserLimit: f.perUserLimit ? Number(f.perUserLimit) : null,
      scope: f.scope, scopeIds: f.scope === 'ALL' ? [] : f.scopeIds,
      startsAt: f.startsAt || null, endsAt: f.endsAt || null,
    };
    try {
      if (initial) await api.patch(`/promotions/vouchers/${initial.id}`, payload);
      else await api.post('/promotions/vouchers', payload);
      onClose(true);
    } catch (e) { setErr(getErrorMessage(e)); setSaving(false); }
  }

  return (
    <Modal title={initial ? `Sửa voucher ${initial.code}` : 'Tạo voucher'} onClose={() => onClose(false)}>
      <ErrorBox message={err} />
      {running && <p className="text-xs text-amber-600 mb-2">Voucher đang diễn ra: chỉ sửa được mô tả, hạn và tổng lượt.</p>}
      <div className="grid grid-cols-2 gap-3">
        <L label="Mã voucher"><input value={f.code} disabled={!!initial} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} className={inp} placeholder="VD: SALE10" /></L>
        <L label="Loại giảm"><select value={f.type} disabled={running} onChange={(e) => setF({ ...f, type: e.target.value as any })} className={inp}><option value="PERCENT">Theo %</option><option value="FIXED">Số tiền cố định</option></select></L>
        <L label={f.type === 'PERCENT' ? 'Phần trăm (%)' : 'Số tiền (₫)'}><input type="number" value={f.value} disabled={running} onChange={(e) => setF({ ...f, value: Number(e.target.value) })} className={inp} /></L>
        {f.type === 'PERCENT' && <L label="Giảm tối đa (₫)"><input type="number" value={f.maxDiscount ?? ''} disabled={running} onChange={(e) => setF({ ...f, maxDiscount: e.target.value === '' ? null : Number(e.target.value) })} className={inp} placeholder="Không giới hạn" /></L>}
        <L label="Đơn tối thiểu (₫)"><input type="number" value={f.minOrder} disabled={running} onChange={(e) => setF({ ...f, minOrder: Number(e.target.value) })} className={inp} /></L>
        <L label="Tổng lượt dùng"><input type="number" value={f.usageLimit ?? ''} onChange={(e) => setF({ ...f, usageLimit: e.target.value === '' ? null : Number(e.target.value) })} className={inp} placeholder="Không giới hạn" /></L>
        <L label="Giới hạn mỗi khách"><input type="number" value={f.perUserLimit ?? ''} disabled={running} onChange={(e) => setF({ ...f, perUserLimit: e.target.value === '' ? null : Number(e.target.value) })} className={inp} placeholder="Không giới hạn" /></L>
        <L label="Bắt đầu"><input type="datetime-local" value={f.startsAt} disabled={running} onChange={(e) => setF({ ...f, startsAt: e.target.value })} className={inp} /></L>
        <L label="Kết thúc"><input type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} className={inp} /></L>
        <L label="Mô tả" full><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={inp} placeholder="Hiển thị cho khách" /></L>
        <L label="Phạm vi áp dụng" full><select value={f.scope} disabled={running} onChange={(e) => setF({ ...f, scope: e.target.value as any, scopeIds: [] })} className={inp}><option value="ALL">Toàn bộ sản phẩm</option><option value="CATEGORY">Theo danh mục</option><option value="PRODUCT">Theo sản phẩm</option></select></L>
      </div>
      {f.scope !== 'ALL' && !running && (
        <div className="mt-2 max-h-36 overflow-y-auto border border-brand/15 rounded-lg p-2 flex flex-wrap gap-1.5">
          {(f.scope === 'CATEGORY' ? categories : products).map((o) => (
            <button key={o.id} type="button" onClick={() => toggleScopeId(o.id)}
              className={`text-xs px-2 py-1 rounded-full border ${f.scopeIds.includes(o.id) ? 'bg-brand text-white border-brand' : 'border-gray-300 text-gray-600'}`}>{o.name}</button>
          ))}
        </div>
      )}
      <div className="flex gap-2 justify-end mt-4">
        <SecondaryButton type="button" onClick={() => onClose(false)}>Hủy</SecondaryButton>
        <PrimaryButton style={{ width: 'auto' }} onClick={submit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu nháp'}</PrimaryButton>
      </div>
    </Modal>
  );
}

// --------------------------- Modal: Flash Sale ---------------------------
function FlashFormModal({ initial, onClose }: { initial: FlashSale | null; onClose: (ok: boolean) => void }) {
  const [products, setProducts] = useState<{ id: number; name: string; price: number }[]>([]);
  const [f, setF] = useState({
    productId: initial?.productId ?? 0, salePrice: initial?.salePrice ?? 0, quantity: initial?.quantity ?? 1,
    perUserLimit: initial?.perUserLimit ?? null as number | null,
    startsAt: toLocalInput(initial?.startsAt ?? new Date().toISOString()),
    endsAt: toLocalInput(initial?.endsAt ?? new Date(Date.now() + 3 * 86400_000).toISOString()),
  });
  const [err, setErr] = useState(''); const [saving, setSaving] = useState(false);
  const running = initial?.status === 'RUNNING';
  const chosen = products.find((p) => p.id === f.productId);

  useEffect(() => {
    api.get('/products/manage?limit=200').then((r) => setProducts(r.data.items.map((p: any) => ({ id: p.id, name: p.name, price: p.price })))).catch(() => {});
  }, []);

  async function submit() {
    setErr(''); setSaving(true);
    const payload: any = {
      productId: f.productId, salePrice: Number(f.salePrice), quantity: Number(f.quantity),
      perUserLimit: f.perUserLimit ? Number(f.perUserLimit) : null, startsAt: f.startsAt, endsAt: f.endsAt,
    };
    try {
      if (initial) await api.patch(`/promotions/flash-sales/${initial.id}`, payload);
      else await api.post('/promotions/flash-sales', payload);
      onClose(true);
    } catch (e) { setErr(getErrorMessage(e)); setSaving(false); }
  }

  return (
    <Modal title={initial ? 'Sửa Flash Sale' : 'Tạo Flash Sale'} onClose={() => onClose(false)}>
      <ErrorBox message={err} />
      {running && <p className="text-xs text-amber-600 mb-2">Flash Sale đang diễn ra: chỉ sửa được số suất và hạn.</p>}
      <div className="grid grid-cols-2 gap-3">
        <L label="Sản phẩm" full>
          <select value={f.productId} disabled={!!initial} onChange={(e) => setF({ ...f, productId: Number(e.target.value) })} className={inp}>
            <option value={0}>— Chọn sản phẩm —</option>
            {initial && <option value={initial.productId}>{initial.product.name}</option>}
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({money(p.price)})</option>)}
          </select>
        </L>
        <L label="Giá Flash (₫)"><input type="number" value={f.salePrice} disabled={running} onChange={(e) => setF({ ...f, salePrice: Number(e.target.value) })} className={inp} />{chosen && <span className="text-xs text-gray-400">Giá gốc {money(chosen.price)}</span>}</L>
        <L label="Số suất"><input type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} className={inp} /></L>
        <L label="Giới hạn mỗi khách"><input type="number" value={f.perUserLimit ?? ''} disabled={running} onChange={(e) => setF({ ...f, perUserLimit: e.target.value === '' ? null : Number(e.target.value) })} className={inp} placeholder="Không giới hạn" /></L>
        <L label="Bắt đầu"><input type="datetime-local" value={f.startsAt} disabled={running} onChange={(e) => setF({ ...f, startsAt: e.target.value })} className={inp} /></L>
        <L label="Kết thúc"><input type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} className={inp} /></L>
      </div>
      <div className="flex gap-2 justify-end mt-4">
        <SecondaryButton type="button" onClick={() => onClose(false)}>Hủy</SecondaryButton>
        <PrimaryButton style={{ width: 'auto' }} onClick={submit} disabled={saving || !f.productId}>{saving ? 'Đang lưu...' : 'Lưu nháp'}</PrimaryButton>
      </div>
    </Modal>
  );
}

