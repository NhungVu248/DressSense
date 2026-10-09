import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { ErrorBox, SuccessBox, PrimaryButton, SecondaryButton } from '../../components/ui';

// UC6.3 Thêm sản phẩm / UC6.4 Sửa sản phẩm (Người bán / Quản trị viên)

interface Category { id: number; name: string }
interface Variant { size: string; stock: number }

const FIELDS: Array<{ key: string; label: string }> = [
  { key: 'brand', label: 'Thương hiệu' }, { key: 'color', label: 'Màu sắc' },
  { key: 'material', label: 'Chất liệu' }, { key: 'style', label: 'Phong cách' },
  { key: 'garmentType', label: 'Loại trang phục' }, { key: 'occasion', label: 'Dịp dùng' },
];

export default function ProductFormPage() {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(editing);

  const [f, setF] = useState<Record<string, string>>({ name: '', description: '', price: '', categoryId: '', status: 'ACTIVE' });
  const [variants, setVariants] = useState<Variant[]>([{ size: 'S', stock: 0 }]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    api.get('/categories').then((r) => setCats(r.data.categories ?? [])).catch(() => {});
    if (editing) {
      api.get(`/products/${id}/manage`).then((r) => {
        const p = r.data.product;
        setF({
          name: p.name ?? '', description: p.description ?? '', price: String(p.price ?? ''),
          categoryId: String(p.categoryId ?? ''), status: p.status ?? 'ACTIVE',
          brand: p.brand ?? '', color: p.color ?? '', material: p.material ?? '',
          style: p.style ?? '', garmentType: p.garmentType ?? '', occasion: p.occasion ?? '',
        });
        if (p.variants?.length) setVariants(p.variants.map((v: any) => ({ size: v.size, stock: v.stock })));
      }).catch((e) => setError(getErrorMessage(e))).finally(() => setLoading(false));
    }
  }, [id, editing]);

  async function submit() {
    setError(''); setSuccess('');
    if (!f.name.trim() || !f.price || !f.categoryId) { setError('Vui lòng nhập tên, giá và danh mục.'); return; }
    const payload: any = {
      name: f.name.trim(), description: f.description || undefined, price: Number(f.price),
      categoryId: Number(f.categoryId), status: f.status,
      variants: variants.filter((v) => v.size.trim()).map((v) => ({ size: v.size.trim(), stock: Number(v.stock) || 0 })),
    };
    for (const { key } of FIELDS) if (f[key]?.trim()) payload[key] = f[key].trim();
    setSaving(true);
    try {
      if (editing) { await api.patch(`/products/${id}`, payload); setSuccess('Đã cập nhật sản phẩm.'); }
      else { await api.post('/products', payload); setSuccess('Đã thêm sản phẩm.'); }
      setTimeout(() => nav('/manage/products'), 600);
    } catch (e) { setError(getErrorMessage(e)); setSaving(false); } // 7E/7F
  }

  if (loading) return <p className="max-w-2xl mx-auto px-4 py-10 text-gray-400">Đang tải...</p>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/manage/products" className="text-sm text-gray-400 hover:text-gray-600">← Danh sách sản phẩm</Link>
      <h1 className="text-2xl font-bold mt-2 mb-5">{editing ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}</h1>
      <ErrorBox message={error} />
      <SuccessBox message={success} />

      <div className="bg-white border rounded-xl p-6 space-y-4">
        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">Tên sản phẩm <span className="text-red-400">*</span></span>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">Mô tả</span>
          <textarea value={f.description} onChange={(e) => set('description', e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Giá (₫) <span className="text-red-400">*</span></span>
            <input type="number" min={0} value={f.price} onChange={(e) => set('price', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Danh mục <span className="text-red-400">*</span></span>
            <select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">— Chọn —</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map(({ key, label }) => (
            <label key={key} className="block">
              <span className="block text-xs text-gray-500 mb-1">{label}</span>
              <input value={f[key] ?? ''} onChange={(e) => set(key, e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
          ))}
        </div>
        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">Trạng thái</span>
          <select value={f.status} onChange={(e) => set('status', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="ACTIVE">Đang bán</option><option value="HIDDEN">Ẩn</option>
            <option value="DRAFT">Nháp (chưa phân tích)</option><option value="PENDING">Chờ duyệt</option>
          </select>
        </label>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">Biến thể (size + tồn kho)</span>
            <button type="button" onClick={() => setVariants((a) => [...a, { size: '', stock: 0 }])} className="text-xs text-brand hover:underline">+ Thêm biến thể</button>
          </div>
          <div className="space-y-2">
            {variants.map((v, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input placeholder="Size (S/M/L...)" value={v.size} onChange={(e) => setVariants((a) => a.map((x, j) => j === i ? { ...x, size: e.target.value } : x))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1" />
                <input type="number" min={0} placeholder="Tồn" value={v.stock} onChange={(e) => setVariants((a) => a.map((x, j) => j === i ? { ...x, stock: Number(e.target.value) } : x))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24" />
                <button type="button" onClick={() => setVariants((a) => a.filter((_, j) => j !== i))} className="text-red-400 text-sm px-2">✕</button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <PrimaryButton style={{ width: 'auto' }} onClick={submit} disabled={saving}>{saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm sản phẩm'}</PrimaryButton>
          <SecondaryButton type="button" onClick={() => nav('/manage/products')}>Hủy</SecondaryButton>
        </div>
      </div>
    </div>
  );
}
