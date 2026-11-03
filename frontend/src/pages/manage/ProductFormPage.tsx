import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { uploadFile } from '../../lib/upload';
import { formatVND } from '../../lib/products';
import { ErrorBox, SuccessBox, PrimaryButton, SecondaryButton } from '../../components/ui';

// UC6.3 Thêm sản phẩm / UC6.4 Sửa sản phẩm (Người bán / Quản trị viên)

interface Category { id: number; name: string }
interface Variant { size: string; stock: number }
interface ProductImageItem { id?: number; url: string; isPrimary: boolean }

const FIELDS: Array<{ key: string; label: string }> = [
  { key: 'brand', label: 'Thương hiệu' }, { key: 'color', label: 'Màu sắc' },
  { key: 'material', label: 'Chất liệu' }, { key: 'style', label: 'Phong cách' },
  { key: 'garmentType', label: 'Loại trang phục' }, { key: 'occasion', label: 'Dịp dùng' },
  // Backlog B.29/C.44 - trường dữ liệu mở rộng
  { key: 'sku', label: 'Mã SKU' }, { key: 'origin', label: 'Xuất xứ' },
  { key: 'warranty', label: 'Bảo hành' },
];

export default function ProductFormPage({ basePath = '/manage/products' }: { basePath?: string }) {
  const { id } = useParams();
  const editing = !!id;
  const nav = useNavigate();
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(editing);

  // f.price giữ GIÁ CHƯA THUẾ (người bán nhập); giá cuối = chưa thuế + VAT
  const [f, setF] = useState<Record<string, string>>({ name: '', description: '', price: '', categoryId: '', status: 'ACTIVE' });
  const [variants, setVariants] = useState<Variant[]>([{ size: 'S', stock: 0 }]);
  const [images, setImages] = useState<ProductImageItem[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [vat, setVat] = useState<{ enabled: boolean; rate: number }>({ enabled: false, rate: 0 });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      const [catRes, setRes] = await Promise.all([
        api.get('/categories').catch(() => ({ data: {} })),
        api.get('/settings/public').catch(() => ({ data: { settings: {} } })),
      ]);
      setCats(catRes.data.categories ?? []);
      const s = setRes.data.settings ?? {};
      const rate = s.vatEnabled && Number(s.vatRate) > 0 ? Number(s.vatRate) : 0;
      setVat({ enabled: !!s.vatEnabled, rate });
      if (editing) {
        const r = await api.get(`/products/${id}/manage`);
        const p = r.data.product;
        // prefill giá chưa thuế: dùng priceBeforeTax nếu có, nếu không suy ngược từ giá cuối
        const preTax = p.priceBeforeTax != null ? p.priceBeforeTax : (rate > 0 ? Math.round((p.price * 100) / (100 + rate)) : p.price);
        setF({
          name: p.name ?? '', description: p.description ?? '', price: String(preTax ?? ''),
          categoryId: String(p.categoryId ?? ''), status: p.status ?? 'ACTIVE',
          brand: p.brand ?? '', color: p.color ?? '', material: p.material ?? '',
          style: p.style ?? '', garmentType: p.garmentType ?? '', occasion: p.occasion ?? '',
          sku: p.sku ?? '', origin: p.origin ?? '', warranty: p.warranty ?? '', careInstructions: p.careInstructions ?? '',
        });
        if (p.variants?.length) setVariants(p.variants.map((v: any) => ({ size: v.size, stock: v.stock })));
        if (p.images?.length) setImages(p.images.map((im: any, idx: number) => ({ id: im.id, url: im.url, isPrimary: im.isPrimary !== undefined ? !!im.isPrimary : idx === 0 })));
      }
    })().catch((e) => setError(getErrorMessage(e))).finally(() => setLoading(false));
  }, [id, editing]);

  const preTaxNum = Number(f.price) || 0;
  const finalPrice = vat.rate > 0 ? Math.round((preTaxNum * (100 + vat.rate)) / 100) : preTaxNum;


  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImages(true);
    setError('');
    try {
      const list: ProductImageItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadFile(files[i]);
        list.push({ url, isPrimary: false });
      }
      setImages((prev) => {
        const combined = [...prev, ...list];
        if (combined.length > 0 && !combined.some((x) => x.isPrimary)) {
          combined[0].isPrimary = true;
        }
        return combined;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  }

  function setPrimaryImage(index: number) {
    setImages((prev) =>
      prev.map((img, i) => ({
        ...img,
        isPrimary: i === index,
      }))
    );
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((x) => x.isPrimary)) {
        next[0].isPrimary = true;
      }
      return next;
    });
  }

  async function submit() {
    setError(''); setSuccess('');
    if (!f.name.trim() || !f.price || !f.categoryId) { setError('Vui lòng nhập tên, giá và danh mục.'); return; }
    const payload: any = {
      name: f.name.trim(), description: f.description || undefined,
      price: finalPrice, priceBeforeTax: preTaxNum, // gửi cả giá cuối & giá chưa thuế (backend tính lại)
      categoryId: Number(f.categoryId), status: f.status,
      variants: variants.filter((v) => v.size.trim()).map((v) => ({ size: v.size.trim(), stock: Number(v.stock) || 0 })),
      images: images.map((im, idx) => ({ url: im.url, isPrimary: im.isPrimary || (idx === 0 && !images.some((x) => x.isPrimary)) })),
    };
    for (const { key } of FIELDS) if (f[key]?.trim()) payload[key] = f[key].trim();
    if (f.careInstructions?.trim()) payload.careInstructions = f.careInstructions.trim(); // Backlog B.29/C.44
    setSaving(true);
    try {
      if (editing) { await api.patch(`/products/${id}`, payload); setSuccess('Đã cập nhật sản phẩm.'); }
      else { await api.post('/products', payload); setSuccess('Đã thêm sản phẩm.'); }
      setTimeout(() => nav(basePath), 600);
    } catch (e) { setError(getErrorMessage(e)); setSaving(false); } // 7E/7F
  }

  if (loading) return <p className="max-w-2xl mx-auto px-4 py-10 text-gray-400">Đang tải...</p>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to={basePath} className="text-sm text-gray-400 hover:text-gray-600">← Danh sách sản phẩm</Link>
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
            <span className="block text-xs text-gray-500 mb-1">Giá chưa thuế (₫) <span className="text-red-400">*</span></span>
            <input type="number" min={0} value={f.price} onChange={(e) => set('price', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            {vat.rate > 0 ? (
              <span className="block text-xs text-brand mt-1">Thuế VAT {vat.rate}% → Giá cuối hiển thị cho khách: <b>{formatVND(finalPrice)}</b></span>
            ) : (
              <span className="block text-xs text-gray-400 mt-1">Chưa áp dụng thuế — giá cuối = giá nhập.</span>
            )}
          </label>
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Danh mục <span className="text-red-400">*</span></span>
            <select value={f.categoryId} onChange={(e) => set('categoryId', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="">— Chọn —</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FIELDS.map(({ key, label }) => (
            <label key={key} className="block">
              <span className="block text-xs text-gray-500 mb-1">{label}</span>
              <input value={f[key] ?? ''} onChange={(e) => set(key, e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </label>
          ))}
        </div>
        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">Hướng dẫn bảo quản</span>
          <textarea value={f.careInstructions ?? ''} onChange={(e) => set('careInstructions', e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="VD: Giặt tay, không dùng chất tẩy, phơi trong bóng râm…" />
        </label>
        <label className="block">
          <span className="block text-xs text-gray-500 mb-1">Trạng thái</span>
          <select value={f.status} onChange={(e) => set('status', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="ACTIVE">Đang bán</option><option value="HIDDEN">Ẩn</option>
            <option value="DRAFT">Nháp (chưa phân tích)</option><option value="PENDING">Chờ duyệt</option>
          </select>
        </label>


        {/* Upload ảnh sản phẩm */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-700">
              Hình ảnh sản phẩm <span className="text-gray-400 font-normal">({images.length} ảnh đã chọn, ảnh có huy hiệu ★ là ảnh bìa chính)</span>
            </label>
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 mb-3">
              {images.map((im, idx) => (
                <div
                  key={idx}
                  className={`relative group rounded-xl overflow-hidden border-2 aspect-square bg-gray-50 flex items-center justify-center ${
                    im.isPrimary ? 'border-brand ring-2 ring-brand/20' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img src={im.url} alt={`Ảnh ${idx + 1}`} className="w-full h-full object-cover" />
                  
                  {/* Badge ảnh chính */}
                  {im.isPrimary ? (
                    <span className="absolute top-1.5 left-1.5 bg-brand text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                      ★ Ảnh chính
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPrimaryImage(idx)}
                      className="absolute top-1.5 left-1.5 bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Đặt làm chính
                    </button>
                  )}

                  {/* Nút xóa ảnh */}
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    title="Xóa ảnh"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <label className="border-2 border-dashed border-gray-300 hover:border-brand hover:bg-brand/5 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition text-center">
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageUpload}
              disabled={uploadingImages}
              className="hidden"
            />
            {uploadingImages ? (
              <div className="flex items-center gap-2 text-sm text-brand font-medium">
                <span className="animate-spin inline-block w-4 h-4 border-2 border-brand border-t-transparent rounded-full" />
                Đang tải ảnh lên...
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-1 text-lg">
                  📷
                </div>
                <span className="text-sm font-medium text-gray-700">Tải ảnh sản phẩm từ thiết bị</span>
                <span className="text-xs text-gray-400 mt-0.5">PNG, JPG hoặc WEBP (tối đa 10MB/ảnh) - Có thể chọn nhiều ảnh</span>
              </>
            )}
          </label>
        </div>

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
          <SecondaryButton type="button" onClick={() => nav(basePath)}>Hủy</SecondaryButton>
        </div>
      </div>
    </div>
  );
}
