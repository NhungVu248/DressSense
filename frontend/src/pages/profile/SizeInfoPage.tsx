import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { ErrorBox, SuccessBox, PrimaryButton, SecondaryButton, Chip } from '../../components/ui';

interface CategoryOption { id: number; name: string; slug: string }
type SizeSystem = 'STANDARD' | 'NUMERIC' | 'MEASUREMENT';

interface SizeEntry {
  categoryId: number;
  categoryName: string;
  sizeSystem: SizeSystem;
  sizeValue: string;
  measurements: { chest?: number; waist?: number; hip?: number; length?: number } | null;
  source: string;
  updatedAt: string;
}

interface Catalog {
  categories: CategoryOption[];
  standardSizes: string[];
  numericSizeRange: { min: number; max: number };
  measurementRange: { min: number; max: number };
}

const SYSTEM_LABEL: Record<SizeSystem, string> = {
  STANDARD: 'Hệ chuẩn (S/M/L...)',
  NUMERIC: 'Theo số',
  MEASUREMENT: 'Theo số đo cơ thể',
};

// UC2.2 - Quản lý thông tin size
export default function SizeInfoPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [sizes, setSizes] = useState<Record<number, SizeEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editingCategory, setEditingCategory] = useState<number | null>(null);
  const [system, setSystem] = useState<SizeSystem>('STANDARD');
  const [standardValue, setStandardValue] = useState('');
  const [numericValue, setNumericValue] = useState('');
  const [measurements, setMeasurements] = useState<{ chest: string; waist: string; hip: string; length: string }>({
    chest: '', waist: '', hip: '', length: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // UC2.2 luồng 4b - gợi ý size từ Body Profile (categoryId -> size chuẩn)
  const [suggestions, setSuggestions] = useState<Record<number, string>>({});
  const [hasBodyProfile, setHasBodyProfile] = useState(false);

  function load() {
    Promise.all([
      api.get('/personalization/catalog'),
      api.get('/personalization/sizes'),
      api.get('/personalization/body-sync'), // UC2.3 -> lấy gợi ý size từ Body Profile (4b)
    ])
      .then(([catalogRes, sizesRes, syncRes]) => {
        setCatalog(catalogRes.data);
        const map: Record<number, SizeEntry> = {};
        for (const s of sizesRes.data.sizes as SizeEntry[]) map[s.categoryId] = s;
        setSizes(map);
        const sug: Record<number, string> = {};
        for (const s of (syncRes.data.latest?.suggestedSizes ?? []) as Array<{ categoryId: number; sizeValue: string }>) {
          sug[s.categoryId] = s.sizeValue;
        }
        setSuggestions(sug);
        setHasBodyProfile(!!syncRes.data.hasBodyProfile);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  // 4b - áp dụng gợi ý từ Body Profile vào form (khách xác nhận/chỉnh trước khi lưu)
  function applySuggestion(categoryId: number, sizeValue: string) {
    setEditingCategory(categoryId);
    setFormError('');
    setSuccess('');
    setSystem('STANDARD');
    setStandardValue(sizeValue);
    setNumericValue('');
    setMeasurements({ chest: '', waist: '', hip: '', length: '' });
  }

  function openEdit(categoryId: number) {
    setEditingCategory(categoryId);
    setFormError('');
    setSuccess('');
    const existing = sizes[categoryId];
    if (existing) {
      setSystem(existing.sizeSystem);
      setStandardValue(existing.sizeSystem === 'STANDARD' ? existing.sizeValue : '');
      setNumericValue(existing.sizeSystem === 'NUMERIC' ? existing.sizeValue : '');
      setMeasurements({
        chest: existing.measurements?.chest != null ? String(existing.measurements.chest) : '',
        waist: existing.measurements?.waist != null ? String(existing.measurements.waist) : '',
        hip: existing.measurements?.hip != null ? String(existing.measurements.hip) : '',
        length: existing.measurements?.length != null ? String(existing.measurements.length) : '',
      });
    } else {
      setSystem('STANDARD');
      setStandardValue('');
      setNumericValue('');
      setMeasurements({ chest: '', waist: '', hip: '', length: '' });
    }
  }

  async function save() {
    if (editingCategory == null) return;
    setFormError('');
    setSaving(true);
    try {
      const body: any = { sizeSystem: system };
      if (system === 'STANDARD') body.sizeValue = standardValue;
      else if (system === 'NUMERIC') body.sizeValue = numericValue;
      else {
        body.measurements = Object.fromEntries(
          Object.entries(measurements).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)])
        );
      }
      const res = await api.put(`/personalization/sizes/${editingCategory}`, body);
      setSizes((s) => ({ ...s, [editingCategory]: res.data.size }));
      setSuccess(`Đã lưu size cho danh mục "${res.data.size.categoryName}"${system === 'MEASUREMENT' ? ` (gợi ý: ${res.data.size.sizeValue})` : ''}.`);
      setEditingCategory(null);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(categoryId: number) {
    const cat = catalog?.categories.find((c) => c.id === categoryId);
    if (!confirm(`Xóa thông tin size của "${cat?.name}"?`)) return;
    setError('');
    try {
      await api.delete(`/personalization/sizes/${categoryId}`);
      setSizes((s) => {
        const next = { ...s };
        delete next[categoryId];
        return next;
      });
      setSuccess('Đã xóa thông tin size.');
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (loading) return <p className="max-w-2xl mx-auto px-4 py-10 text-gray-400">Đang tải...</p>;
  if (!catalog) return <p className="max-w-2xl mx-auto px-4 py-10 text-red-500">{error}</p>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/profile" className="text-sm text-gray-400 hover:text-gray-600">← Hồ sơ cá nhân</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Thông tin size</h1>
      <p className="text-sm text-gray-500 mb-6">
        Lưu size theo từng danh mục để được gợi ý đúng kích cỡ và đặt hàng nhanh hơn.
      </p>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* 4b - có Body Profile -> hệ thống có thể gợi ý size cho từng danh mục */}
      {hasBodyProfile && (
        <div className="bg-indigo-50 text-indigo-700 text-sm rounded-lg px-4 py-3 mb-4">
          Bạn đã có Body Profile — hệ thống gợi ý size cho một số danh mục bên dưới. Bạn xác nhận hoặc chỉnh sửa trước khi lưu.
        </div>
      )}

      <div className="space-y-3">
        {catalog.categories.map((c) => {
          const entry = sizes[c.id];
          const isEditing = editingCategory === c.id;
          return (
            <div key={c.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{c.name}</p>
                  {entry ? (
                    <p className="text-sm text-gray-500 mt-0.5">
                      Size <span className="font-medium text-gray-900">{entry.sizeValue}</span>
                      {' · '}{SYSTEM_LABEL[entry.sizeSystem]}
                      {entry.source === 'BODY_PROFILE' && (
                        <span className="ml-2 text-xs bg-amber-100 text-amber-700 rounded-full px-2 py-0.5">
                          Từ Body Profile · chưa xác nhận
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 mt-0.5">Chưa khai báo</p>
                  )}
                  {/* 4b - dòng gợi ý từ Body Profile khi chưa phải size do khách tự xác nhận */}
                  {!isEditing && suggestions[c.id] &&
                    !(entry?.source === 'MANUAL' && entry.sizeValue === suggestions[c.id]) && (
                      <p className="text-xs text-indigo-600 mt-1">
                        Gợi ý từ Body Profile: <span className="font-medium">{suggestions[c.id]}</span>
                        <button onClick={() => applySuggestion(c.id, suggestions[c.id])} className="ml-2 underline hover:text-indigo-800">
                          Dùng gợi ý
                        </button>
                      </p>
                    )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {!isEditing && (
                    <button onClick={() => openEdit(c.id)} className="text-indigo-600 hover:underline">
                      {entry ? 'Sửa' : '+ Thêm size'}
                    </button>
                  )}
                  {entry && !isEditing && (
                    <button onClick={() => remove(c.id)} className="text-red-500 hover:underline">Xóa</button>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-4 pt-4 border-t">
                  <ErrorBox message={formError} />
                  <p className="text-sm font-medium text-gray-700 mb-2">Cách nhập size</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {(['STANDARD', 'NUMERIC', 'MEASUREMENT'] as SizeSystem[]).map((s) => (
                      <Chip key={s} active={system === s} onClick={() => setSystem(s)}>{SYSTEM_LABEL[s]}</Chip>
                    ))}
                  </div>

                  {system === 'STANDARD' && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {catalog.standardSizes.map((s) => (
                        <Chip key={s} active={standardValue === s} onClick={() => setStandardValue(s)}>{s}</Chip>
                      ))}
                    </div>
                  )}

                  {system === 'NUMERIC' && (
                    <input
                      type="number"
                      min={catalog.numericSizeRange.min}
                      max={catalog.numericSizeRange.max}
                      value={numericValue}
                      onChange={(e) => setNumericValue(e.target.value)}
                      placeholder={`${catalog.numericSizeRange.min}–${catalog.numericSizeRange.max}`}
                      className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4"
                    />
                  )}

                  {system === 'MEASUREMENT' && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {(['chest', 'waist', 'hip', 'length'] as const).map((k) => (
                        <label key={k} className="block">
                          <span className="block text-xs text-gray-500 mb-1">
                            {k === 'chest' ? 'Vòng ngực (cm)' : k === 'waist' ? 'Vòng eo (cm)' : k === 'hip' ? 'Vòng hông (cm)' : 'Chiều dài chân (cm)'}
                          </span>
                          <input
                            type="number"
                            value={measurements[k]}
                            onChange={(e) => setMeasurements((m) => ({ ...m, [k]: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          />
                        </label>
                      ))}
                      <p className="col-span-2 text-xs text-gray-400">
                        Hệ thống sẽ quy đổi số đo sang size chuẩn gần đúng để bạn xác nhận.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <PrimaryButton style={{ width: 'auto' }} onClick={save} disabled={saving}>
                      {saving ? 'Đang lưu...' : 'Lưu size'}
                    </PrimaryButton>
                    <SecondaryButton type="button" onClick={() => setEditingCategory(null)}>Hủy</SecondaryButton>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
