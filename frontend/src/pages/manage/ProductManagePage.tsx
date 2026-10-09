import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { getToken } from '../../lib/token';
import { ErrorBox, SuccessBox, PrimaryButton, SecondaryButton } from '../../components/ui';
import { PRODUCT_PLACEHOLDER } from '../../lib/placeholder';

// UC6.1 - Danh sách QUẢN LÝ sản phẩm (Người bán: SP của mình; Quản trị viên: toàn sàn)
// + UC6.4 đổi trạng thái · UC6.5 xóa · UC6.6 tồn kho · UC6.7 nhập/xuất.

interface ManagedProduct {
  id: number; name: string; price: number; category: string;
  image: string | null; status: string; stock: number; outOfStock: boolean; analysisStatus: string | null;
}
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp', PENDING: 'Chờ duyệt', ACTIVE: 'Đang bán', HIDDEN: 'Đã ẩn', ARCHIVED: 'Lưu trữ',
};
const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700', HIDDEN: 'bg-gray-200 text-gray-600',
  DRAFT: 'bg-amber-100 text-amber-700', PENDING: 'bg-blue-100 text-blue-700', ARCHIVED: 'bg-red-100 text-red-600',
};
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');
const imgUrl = (u: string | null) => (!u ? PRODUCT_PLACEHOLDER : u.startsWith('/uploads') ? API_ORIGIN + u : u);

export default function ProductManagePage() {
  const [items, setItems] = useState<ManagedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [invFor, setInvFor] = useState<ManagedProduct | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (search) qs.set('search', search);
    if (status) qs.set('status', status);
    qs.set('limit', '100');
    api.get('/products/manage?' + qs.toString())
      .then((res) => setItems(res.data.items))
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function setProductStatus(p: ManagedProduct, newStatus: string) {
    setError(''); setSuccess('');
    try {
      await api.patch(`/products/${p.id}`, { status: newStatus });
      setSuccess(`Đã chuyển "${p.name}" sang ${STATUS_LABEL[newStatus]}.`);
      load();
    } catch (e) { setError(getErrorMessage(e)); }
  }

  async function remove(p: ManagedProduct) {
    if (!confirm(`Xóa sản phẩm "${p.name}"? Nếu đã có đơn hàng, sản phẩm sẽ được lưu trữ (xóa mềm).`)) return;
    setError(''); setSuccess('');
    try {
      const res = await api.delete(`/products/${p.id}`);
      setSuccess(res.data.archived ? 'Đã lưu trữ sản phẩm (có lịch sử đơn hàng).' : 'Đã xóa sản phẩm.');
      load();
    } catch (e) { setError(getErrorMessage(e)); } // 2G - có đơn chưa hoàn tất
  }

  async function doExport() {
    try {
      const res = await api.get('/products/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = 'products-export.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(getErrorMessage(e)); }
  }

  async function doImport(file: File) {
    setError(''); setSuccess('');
    const form = new FormData(); form.append('file', file);
    try {
      const res = await api.post('/products/import', form);
      const d = res.data;
      setSuccess(`Nhập xong: tạo ${d.created}, cập nhật ${d.updated}, bỏ qua ${d.skipped}.` + (d.errors?.length ? ` (${d.errors.length} dòng lỗi)` : ''));
      load();
    } catch (e) { setError(getErrorMessage(e)); }
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h1 className="text-2xl font-bold">Quản lý sản phẩm</h1>
        <div className="flex gap-2">
          <SecondaryButton type="button" onClick={doExport}>Xuất CSV</SecondaryButton>
          <SecondaryButton type="button" onClick={() => fileRef.current?.click()}>Nhập CSV</SecondaryButton>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])} />
          <Link to="/manage/products/new"><PrimaryButton style={{ width: 'auto' }}>+ Thêm sản phẩm</PrimaryButton></Link>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">Tồn kho, trạng thái bán và trạng thái gán nhãn (AI) của từng sản phẩm.</p>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="Tìm theo tên/thương hiệu..." className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Tất cả trạng thái</option>
          {['ACTIVE', 'HIDDEN', 'DRAFT', 'PENDING', 'ARCHIVED'].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <SecondaryButton type="button" onClick={load}>Lọc</SecondaryButton>
      </div>

      {loading ? <p className="text-gray-400">Đang tải...</p> : items.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
          Chưa có sản phẩm. <Link to="/manage/products/new" className="text-brand underline">Thêm sản phẩm</Link> hoặc nhập CSV.
        </div>
      ) : (
        <div className="bg-white border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Sản phẩm</th>
                <th className="text-left px-3 py-2">Danh mục</th>
                <th className="text-right px-3 py-2">Giá</th>
                <th className="text-center px-3 py-2">Tồn</th>
                <th className="text-center px-3 py-2">Trạng thái</th>
                <th className="text-center px-3 py-2">Nhãn AI</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <img src={imgUrl(p.image)} onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }} className="w-10 h-12 object-cover rounded bg-gray-100 border" />
                      <span className="font-medium line-clamp-2">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-500">{p.category}</td>
                  <td className="px-3 py-2 text-right">{p.price.toLocaleString('vi-VN')}₫</td>
                  <td className={`px-3 py-2 text-center ${p.outOfStock ? 'text-red-500 font-medium' : ''}`}>{p.outOfStock ? 'Hết' : p.stock}</td>
                  <td className="px-3 py-2 text-center"><span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_COLOR[p.status]}`}>{STATUS_LABEL[p.status]}</span></td>
                  <td className="px-3 py-2 text-center text-xs text-gray-500">{p.analysisStatus === 'CONFIRMED' ? '✓ Đã xác nhận' : p.analysisStatus === 'UNCONFIRMED' ? 'Chờ xác nhận' : p.analysisStatus ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5 justify-end text-xs whitespace-nowrap">
                      <Link to={`/manage/products/${p.id}/edit`} className="text-indigo-600 hover:underline">Sửa</Link>
                      <button onClick={() => setInvFor(p)} className="text-gray-600 hover:underline">Tồn kho</button>
                      {p.status !== 'ARCHIVED' && (p.status === 'ACTIVE'
                        ? <button onClick={() => setProductStatus(p, 'HIDDEN')} className="text-amber-600 hover:underline">Ẩn</button>
                        : <button onClick={() => setProductStatus(p, 'ACTIVE')} className="text-green-600 hover:underline">Bán</button>)}
                      <button onClick={() => remove(p)} className="text-red-500 hover:underline">Xóa</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invFor && <InventoryModal product={invFor} onClose={(changed) => { setInvFor(null); if (changed) load(); }} />}
    </div>
  );
}

// UC6.6 - sửa tồn kho theo biến thể
function InventoryModal({ product, onClose }: { product: ManagedProduct; onClose: (changed: boolean) => void }) {
  const [variants, setVariants] = useState<Array<{ size: string; stock: number; lowStockThreshold: number | null; state: string }>>([]);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/products/${product.id}/inventory`).then((r) => setVariants(r.data.variants)).catch((e) => setErr(getErrorMessage(e)));
  }, [product.id]);

  async function save() {
    setErr(''); setSaving(true);
    try {
      const res = await api.patch(`/products/${product.id}/inventory`, {
        updates: variants.map((v) => ({ size: v.size, stock: v.stock, lowStockThreshold: v.lowStockThreshold })),
      });
      if (res.data.errors?.length) { setErr(res.data.errors.map((e: any) => `${e.size}: ${e.message}`).join('; ')); setSaving(false); return; }
      onClose(true);
    } catch (e) { setErr(getErrorMessage(e)); setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => onClose(false)}>
      <div className="bg-white rounded-xl p-5 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-1">Tồn kho — {product.name}</h3>
        <p className="text-xs text-gray-400 mb-3">Không đặt tồn thấp hơn số đang giữ chỗ (chống bán vượt).</p>
        <ErrorBox message={err} />
        {variants.length === 0 ? <p className="text-sm text-gray-400">Sản phẩm chưa có biến thể.</p> : (
          <table className="w-full text-sm mb-3">
            <thead><tr className="text-xs text-gray-400"><th className="text-left">Size</th><th>Tồn</th><th>Ngưỡng cảnh báo</th><th>TT</th></tr></thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={v.size}>
                  <td className="py-1 font-medium">{v.size}</td>
                  <td><input type="number" value={v.stock} min={0} onChange={(e) => setVariants((a) => a.map((x, j) => j === i ? { ...x, stock: Number(e.target.value) } : x))} className="w-16 border rounded px-2 py-1 text-center" /></td>
                  <td className="text-center"><input type="number" value={v.lowStockThreshold ?? ''} min={0} placeholder="—" onChange={(e) => setVariants((a) => a.map((x, j) => j === i ? { ...x, lowStockThreshold: e.target.value === '' ? null : Number(e.target.value) } : x))} className="w-16 border rounded px-2 py-1 text-center" /></td>
                  <td className="text-center text-xs">{v.state === 'out' ? '🔴' : v.state === 'low' ? '🟡' : '🟢'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex gap-2 justify-end">
          <SecondaryButton type="button" onClick={() => onClose(false)}>Đóng</SecondaryButton>
          {variants.length > 0 && <PrimaryButton style={{ width: 'auto' }} onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu tồn kho'}</PrimaryButton>}
        </div>
      </div>
    </div>
  );
}
