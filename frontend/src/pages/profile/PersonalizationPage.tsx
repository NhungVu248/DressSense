import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { Chip, SectionTitle, ErrorBox, SuccessBox, PrimaryButton, SecondaryButton } from '../../components/ui';

interface Option { value: string; label: string }
interface CategoryOption { id: number; name: string; slug: string }

interface Catalog {
  styles: Option[];
  colors: Option[];
  garments: Option[];
  materials: Option[];
  occasions: Option[];
  frequencies: Option[];
  categories: CategoryOption[];
}

type Frequency = 'RARELY' | 'SOMETIMES' | 'OFTEN';
type OccasionKey = 'WORK' | 'SCHOOL' | 'STREET' | 'PARTY' | 'SPORT' | 'TRAVEL' | 'CUSTOM';

interface StyleState {
  preferredStyles: string[]; // giữ đơn giản: thứ tự chọn = mức ưu tiên
  preferredColors: string[];
  avoidColors: string[];
  preferredGarments: string[];
  avoidGarments: string[];
  preferredMaterials: string[];
  preferredBrands: string[];
}
const emptyStyle: StyleState = {
  preferredStyles: [], preferredColors: [], avoidColors: [],
  preferredGarments: [], avoidGarments: [], preferredMaterials: [], preferredBrands: [],
};

interface BudgetRow { categoryId: number; min: string; max: string }
interface OccasionRow { occasion: OccasionKey; customLabel?: string; frequency: Frequency }

// 4c - Trắc nghiệm phong cách nhanh (suy luận phong cách phù hợp từ vài câu hỏi)
const QUIZ_QUESTIONS: { q: string; options: { label: string; styles: string[] }[] }[] = [
  {
    q: 'Một ngày cuối tuần lý tưởng của bạn?',
    options: [
      { label: 'Cà phê sách vở, yên tĩnh', styles: ['minimalist', 'classic'] },
      { label: 'Dạo phố, chụp ảnh cùng bạn bè', styles: ['street', 'bohemian'] },
      { label: 'Tập gym, chạy bộ', styles: ['sporty'] },
      { label: 'Dự tiệc, gặp gỡ', styles: ['elegant', 'romantic'] },
    ],
  },
  {
    q: 'Bạn thường mặc gì khi đi làm/học?',
    options: [
      { label: 'Đơn giản, gọn gàng', styles: ['minimalist', 'classic'] },
      { label: 'Cá tính, nổi bật', styles: ['street', 'vintage'] },
      { label: 'Thoải mái, năng động', styles: ['sporty'] },
      { label: 'Nữ tính, mềm mại', styles: ['romantic'] },
    ],
  },
  {
    q: 'Món phụ kiện bạn hay dùng nhất?',
    options: [
      { label: 'Đồng hồ tối giản', styles: ['minimalist'] },
      { label: 'Túi tote vải, vòng cổ', styles: ['bohemian', 'vintage'] },
      { label: 'Balo, giày sneaker', styles: ['sporty', 'street'] },
      { label: 'Trang sức tinh tế', styles: ['elegant'] },
    ],
  },
];

// UC2.1 - Thiết lập hồ sơ cá nhân hóa
export default function PersonalizationPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  const [style, setStyle] = useState<StyleState>(emptyStyle);
  const [brandInput, setBrandInput] = useState('');
  const [budgets, setBudgets] = useState<Record<number, BudgetRow>>({});
  const [occasions, setOccasions] = useState<Record<string, OccasionRow>>({});
  const [customOccasionInput, setCustomOccasionInput] = useState('');

  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string[]>>({});

  useEffect(() => {
    Promise.all([api.get('/personalization/catalog'), api.get('/personalization/profile')])
      .then(([catalogRes, profileRes]) => {
        setCatalog(catalogRes.data);
        const p = profileRes.data;
        if (p.style) {
          setStyle({
            preferredStyles: (p.style.preferredStyles ?? []).sort((a: any, b: any) => a.priority - b.priority).map((s: any) => s.style),
            preferredColors: p.style.preferredColors ?? [],
            avoidColors: p.style.avoidColors ?? [],
            preferredGarments: p.style.preferredGarments ?? [],
            avoidGarments: p.style.avoidGarments ?? [],
            preferredMaterials: p.style.preferredMaterials ?? [],
            preferredBrands: p.style.preferredBrands ?? [],
          });
        }
        const budgetMap: Record<number, BudgetRow> = {};
        for (const b of p.budgets ?? []) {
          budgetMap[b.categoryId] = { categoryId: b.categoryId, min: String(b.minPrice), max: String(b.maxPrice) };
        }
        setBudgets(budgetMap);
        const occMap: Record<string, OccasionRow> = {};
        for (const o of p.occasions ?? []) {
          const key = o.occasion === 'CUSTOM' ? `CUSTOM:${o.customLabel}` : o.occasion;
          occMap[key] = { occasion: o.occasion, customLabel: o.customLabel ?? undefined, frequency: o.frequency };
        }
        setOccasions(occMap);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  function toggleInList(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function toggleStyleField<K extends keyof StyleState>(field: K, value: string) {
    setStyle((s) => ({ ...s, [field]: toggleInList(s[field] as string[], value) }));
  }

  function addBrand() {
    const v = brandInput.trim();
    if (!v || style.preferredBrands.includes(v)) return;
    setStyle((s) => ({ ...s, preferredBrands: [...s.preferredBrands, v] }));
    setBrandInput('');
  }

  function setBudgetField(categoryId: number, field: 'min' | 'max', value: string) {
    setBudgets((b) => ({ ...b, [categoryId]: { categoryId, min: b[categoryId]?.min ?? '', max: b[categoryId]?.max ?? '', [field]: value } }));
  }
  function clearBudget(categoryId: number) {
    setBudgets((b) => {
      const next = { ...b };
      delete next[categoryId];
      return next;
    });
  }

  function toggleOccasion(occasion: OccasionKey) {
    setOccasions((o) => {
      const next = { ...o };
      if (next[occasion]) delete next[occasion];
      else next[occasion] = { occasion, frequency: 'SOMETIMES' };
      return next;
    });
  }
  function setOccasionFrequency(key: string, frequency: Frequency) {
    setOccasions((o) => ({ ...o, [key]: { ...o[key], frequency } }));
  }
  function addCustomOccasion() {
    const label = customOccasionInput.trim();
    if (!label) return;
    const key = `CUSTOM:${label}`;
    setOccasions((o) => ({ ...o, [key]: { occasion: 'CUSTOM', customLabel: label, frequency: 'SOMETIMES' } }));
    setCustomOccasionInput('');
  }
  function removeOccasionKey(key: string) {
    setOccasions((o) => {
      const next = { ...o };
      delete next[key];
      return next;
    });
  }

  // 4c - áp kết quả trắc nghiệm vào phần sở thích để khách hàng xác nhận
  function applyQuizResult() {
    const counts: Record<string, number> = {};
    Object.values(quizAnswers).forEach((styles) => styles.forEach((s) => { counts[s] = (counts[s] ?? 0) + 1; }));
    const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([s]) => s).slice(0, 3);
    if (ranked.length > 0) setStyle((s) => ({ ...s, preferredStyles: ranked }));
    setShowQuiz(false);
    setQuizAnswers({});
  }

  const budgetErrors = useMemo(() => {
    const errs: Record<number, string> = {};
    for (const b of Object.values(budgets)) {
      const min = b.min === '' ? null : Number(b.min);
      const max = b.max === '' ? null : Number(b.max);
      if (min === null && max === null) continue;
      if (min === null || max === null) errs[b.categoryId] = 'Vui lòng nhập cả mức tối thiểu và tối đa';
      else if (min < 0 || max < 0) errs[b.categoryId] = 'Mức giá phải là số không âm';
      else if (min > max) errs[b.categoryId] = 'Mức tối thiểu không được lớn hơn mức tối đa';
    }
    return errs;
  }, [budgets]);

  async function handleSave() {
    setError('');
    setSuccess('');
    if (Object.keys(budgetErrors).length > 0) {
      setError('Vui lòng kiểm tra lại phần ngân sách trước khi lưu.');
      return;
    }
    setSaving(true);
    try {
      const styleFilled = Object.values(style).some((arr) => arr.length > 0);
      const payload = {
        style: styleFilled
          ? {
              preferredStyles: style.preferredStyles.map((s, i) => ({ style: s, priority: i + 1 })),
              preferredColors: style.preferredColors,
              avoidColors: style.avoidColors,
              preferredGarments: style.preferredGarments,
              avoidGarments: style.avoidGarments,
              preferredMaterials: style.preferredMaterials,
              preferredBrands: style.preferredBrands,
            }
          : null,
        budgets: Object.values(budgets)
          .filter((b) => b.min !== '' && b.max !== '')
          .map((b) => ({ categoryId: b.categoryId, minPrice: Number(b.min), maxPrice: Number(b.max) })),
        occasions: Object.values(occasions),
      };
      await api.put('/personalization/profile', payload);
      setSuccess('Đã lưu hồ sơ cá nhân hóa của bạn.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="max-w-3xl mx-auto px-4 py-10 text-gray-400">Đang tải...</p>;
  if (!catalog) return <p className="max-w-3xl mx-auto px-4 py-10 text-red-500">{error}</p>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 pb-28">
      <Link to="/profile" className="text-sm text-gray-400 hover:text-gray-600">← Hồ sơ cá nhân</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Hồ sơ cá nhân hóa</h1>
      <p className="text-sm text-gray-500 mb-6">
        Cho chúng tôi biết gu thời trang của bạn — hồ sơ càng đầy đủ, gợi ý sản phẩm càng chính xác.
        Bạn có thể bỏ qua phần nào chưa muốn khai báo và hoàn thiện sau.
      </p>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* (a) Sở thích và phong cách */}
      <section className="bg-white rounded-xl border p-6 mb-5">
        <div className="flex items-start justify-between gap-3">
          <SectionTitle step="Phần 1/3" title="Sở thích và phong cách" hint="Chọn nhiều lựa chọn nếu phù hợp." />
          <SecondaryButton type="button" onClick={() => setShowQuiz(true)}>✦ Trắc nghiệm phong cách</SecondaryButton>
        </div>

        {showQuiz && (
          <div className="bg-gray-50 rounded-lg p-4 mb-5 space-y-4">
            {QUIZ_QUESTIONS.map((q, qi) => (
              <div key={qi}>
                <p className="text-sm font-medium mb-2">{q.q}</p>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => (
                    <Chip
                      key={opt.label}
                      active={(quizAnswers[qi] ?? []) === opt.styles}
                      onClick={() => setQuizAnswers((a) => ({ ...a, [qi]: opt.styles }))}
                    >
                      {opt.label}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <PrimaryButton style={{ width: 'auto' }} type="button" onClick={applyQuizResult}>Xem kết quả gợi ý</PrimaryButton>
              <SecondaryButton type="button" onClick={() => { setShowQuiz(false); setQuizAnswers({}); }}>Đóng</SecondaryButton>
            </div>
          </div>
        )}

        <p className="text-sm font-medium text-gray-700 mb-2">Phong cách yêu thích</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {catalog.styles.map((o) => (
            <Chip key={o.value} active={style.preferredStyles.includes(o.value)} onClick={() => toggleStyleField('preferredStyles', o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>

        <p className="text-sm font-medium text-gray-700 mb-2">Màu sắc ưa thích</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {catalog.colors.map((o) => (
            <Chip key={o.value} active={style.preferredColors.includes(o.value)} onClick={() => toggleStyleField('preferredColors', o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
        <p className="text-sm font-medium text-gray-700 mb-2">Màu sắc muốn tránh</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {catalog.colors.map((o) => (
            <Chip key={o.value} tone="danger" active={style.avoidColors.includes(o.value)} onClick={() => toggleStyleField('avoidColors', o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>

        <p className="text-sm font-medium text-gray-700 mb-2">Kiểu trang phục thường mặc</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {catalog.garments.map((o) => (
            <Chip key={o.value} active={style.preferredGarments.includes(o.value)} onClick={() => toggleStyleField('preferredGarments', o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
        <p className="text-sm font-medium text-gray-700 mb-2">Kiểu trang phục không mặc</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {catalog.garments.map((o) => (
            <Chip key={o.value} tone="danger" active={style.avoidGarments.includes(o.value)} onClick={() => toggleStyleField('avoidGarments', o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>

        <p className="text-sm font-medium text-gray-700 mb-2">Chất liệu ưu tiên</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {catalog.materials.map((o) => (
            <Chip key={o.value} active={style.preferredMaterials.includes(o.value)} onClick={() => toggleStyleField('preferredMaterials', o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>

        <p className="text-sm font-medium text-gray-700 mb-2">Thương hiệu yêu thích (tùy chọn)</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {style.preferredBrands.map((b) => (
            <Chip key={b} active onClick={() => setStyle((s) => ({ ...s, preferredBrands: s.preferredBrands.filter((x) => x !== b) }))}>
              {b} ✕
            </Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={brandInput}
            onChange={(e) => setBrandInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBrand(); } }}
            placeholder="Nhập tên thương hiệu rồi Enter"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <SecondaryButton type="button" onClick={addBrand}>Thêm</SecondaryButton>
        </div>
      </section>

      {/* (b) Ngân sách theo nhóm sản phẩm */}
      <section className="bg-white rounded-xl border p-6 mb-5">
        <SectionTitle step="Phần 2/3" title="Ngân sách theo nhóm sản phẩm" hint="Chỉ dùng để ưu tiên gợi ý — bạn vẫn có thể mua ngoài khoảng giá này." />
        <div className="space-y-3">
          {catalog.categories.map((c) => {
            const row = budgets[c.id] ?? { categoryId: c.id, min: '', max: '' };
            const err = budgetErrors[c.id];
            return (
              <div key={c.id} className="flex items-center gap-3 flex-wrap">
                <span className="w-28 text-sm font-medium text-gray-700">{c.name}</span>
                <input
                  type="number" min={0} placeholder="Tối thiểu (VND)"
                  value={row.min}
                  onChange={(e) => setBudgetField(c.id, 'min', e.target.value)}
                  className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <span className="text-gray-300">–</span>
                <input
                  type="number" min={0} placeholder="Tối đa (VND)"
                  value={row.max}
                  onChange={(e) => setBudgetField(c.id, 'max', e.target.value)}
                  className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                {(row.min !== '' || row.max !== '') && (
                  <button type="button" onClick={() => clearBudget(c.id)} className="text-xs text-gray-400 hover:text-red-500">Xóa</button>
                )}
                {err && <span className="text-xs text-red-500 w-full">{err}</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* (c) Dịp sử dụng thường xuyên */}
      <section className="bg-white rounded-xl border p-6 mb-5">
        <SectionTitle step="Phần 3/3" title="Dịp sử dụng thường xuyên" hint="Chọn dịp và mức độ thường xuyên tương ứng." />
        <div className="space-y-3">
          {catalog.occasions.map((o) => {
            const active = !!occasions[o.value];
            return (
              <div key={o.value} className="flex items-center gap-3 flex-wrap">
                <div className="w-40">
                  <Chip active={active} onClick={() => toggleOccasion(o.value as OccasionKey)}>{o.label}</Chip>
                </div>
                {active && (
                  <select
                    value={occasions[o.value]?.frequency}
                    onChange={(e) => setOccasionFrequency(o.value, e.target.value as Frequency)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  >
                    {catalog.frequencies.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                )}
              </div>
            );
          })}

          {/* 4e - dịp sử dụng tùy chỉnh */}
          {Object.entries(occasions).filter(([k]) => k.startsWith('CUSTOM:')).map(([key, row]) => (
            <div key={key} className="flex items-center gap-3 flex-wrap">
              <div className="w-40">
                <Chip active onClick={() => removeOccasionKey(key)}>{row.customLabel} ✕</Chip>
              </div>
              <select
                value={row.frequency}
                onChange={(e) => setOccasionFrequency(key, e.target.value as Frequency)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              >
                {catalog.frequencies.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <input
              value={customOccasionInput}
              onChange={(e) => setCustomOccasionInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomOccasion(); } }}
              placeholder="Dịp khác (vd: hẹn hò, chụp ảnh...)"
              className="flex-1 max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <SecondaryButton type="button" onClick={addCustomOccasion}>+ Thêm dịp khác</SecondaryButton>
          </div>
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t py-3">
        <div className="max-w-3xl mx-auto px-4 flex gap-3">
          <PrimaryButton style={{ width: 'auto' }} onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu hồ sơ cá nhân hóa'}
          </PrimaryButton>
          <Link to="/profile" className="text-sm text-gray-500 self-center hover:underline">Để sau</Link>
        </div>
      </div>
    </div>
  );
}
