import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage, recordBehavior } from '../../lib/api';
import { PRODUCT_PLACEHOLDER } from '../../lib/placeholder';
import { ErrorBox, SuccessBox, PrimaryButton, SecondaryButton, Chip } from '../../components/ui';

// ============================================================
//  UC3.1 - Phân tích dáng người bằng AI (điểm vào cho Khách hàng)
//  Luồng: đồng ý điều khoản (b2) -> chọn phương thức (b3) -> nhập liệu (b4)
//         -> phân tích (b5-7, include UC3.2/UC3.3) -> hiển thị Body Profile (b8)
//         -> gợi ý đồng bộ hồ sơ cá nhân hóa UC2.3 (b9)
// ============================================================

type BodyShape = 'HOURGLASS' | 'RECTANGLE' | 'PEAR' | 'APPLE' | 'INVERTED_TRIANGLE';
type Source = 'MANUAL' | 'PHOTO';

interface StyleRecommendation {
  description: string;
  should: string[];
  avoid: string[];
}
interface SuggestedSize {
  categoryId: number;
  sizeValue: string;
}
interface BodyProfile {
  id: number;
  version: number;
  bodyShape: BodyShape;
  source: Source;
  height: number | null;
  weight: number | null;
  bust: number | null;
  waist: number | null;
  hip: number | null;
  confidence: number;
  isPreliminary: boolean;
  photoUrl: string | null;
  recommendations: StyleRecommendation | null;
  suggestedSizes: SuggestedSize[] | null;
  createdAt: string;
}
interface Category { id: number; name: string; slug: string }

// UC5.1/UC5.2 - gợi ý sản phẩm & phối đồ hiện ngay sau khi có Body Profile
interface RecProduct { id: number; name: string; price: number; category: { name: string }; images: { url: string; isPrimary: boolean }[] }
interface RecItem { product: RecProduct; score: number; why: string }
interface OutfitPiece { id: number; name: string; slot: string; color: string | null; style: string | null; price: number; image: string | null }
interface OutfitItem { items: OutfitPiece[]; score: number; why: string }
const SLOT_LABEL: Record<string, string> = { DRESS: 'Đầm', TOP: 'Áo', BOTTOM: 'Quần/Váy', OUTER: 'Khoác', SHOES: 'Giày', ACCESSORY: 'Phụ kiện' };

// UC2.3 - trạng thái đồng bộ Body Profile vào hồ sơ cá nhân hóa
interface SyncStatus {
  hasBodyProfile: boolean;
  autoSync: boolean;
  synced: { bodyProfileId: number; syncedAt: string | null } | null;
  needsSync: boolean;
  latest: { id: number; version: number } | null;
}

const SHAPE_LABEL: Record<BodyShape, string> = {
  HOURGLASS: 'Đồng hồ cát',
  RECTANGLE: 'Chữ nhật',
  PEAR: 'Quả lê',
  APPLE: 'Quả táo',
  INVERTED_TRIANGLE: 'Tam giác ngược',
};

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace('/api', '');

// Các trường số đo dùng chung cho cả hai phương thức
const MEASUREMENT_FIELDS = [
  { key: 'height', label: 'Chiều cao (cm)', required: true },
  { key: 'weight', label: 'Cân nặng (kg)', required: false },
  { key: 'bust', label: 'Vòng ngực (cm)', required: true },
  { key: 'waist', label: 'Vòng eo (cm)', required: true },
  { key: 'hip', label: 'Vòng hông (cm)', required: true },
] as const;
type MeasurementKey = (typeof MEASUREMENT_FIELDS)[number]['key'];

export default function BodyAnalysisPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // b2 - trạng thái đồng ý điều khoản xử lý dữ liệu cơ thể (informed consent)
  const [consented, setConsented] = useState(false);
  const [consenting, setConsenting] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [profile, setProfile] = useState<BodyProfile | null>(null);

  // Biểu mẫu nhập liệu (b3-b4)
  const [showForm, setShowForm] = useState(false);
  const [source, setSource] = useState<Source>('MANUAL');
  const [values, setValues] = useState<Record<MeasurementKey, string>>({
    height: '', weight: '', bust: '', waist: '', hip: '',
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [formError, setFormError] = useState('');

  // UC3.4 - xóa dữ liệu cơ thể
  const [confirmScope, setConfirmScope] = useState<'PHOTO_ONLY' | 'ALL' | null>(null);
  const [deleting, setDeleting] = useState(false);

  // UC2.3 - đồng bộ Body Profile
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);

  // UC5 - gợi ý phối đồ + sản phẩm hợp dáng (hiện ngay sau phân tích)
  const [recItems, setRecItems] = useState<RecItem[]>([]);
  const [outfits, setOutfits] = useState<OutfitItem[]>([]);
  const [recLoading, setRecLoading] = useState(false);

  async function fetchRecs() {
    setRecLoading(true);
    try {
      const [r, o] = await Promise.all([
        api.get('/recommendations?limit=6'),
        api.get('/recommendations/outfits?limit=3'),
      ]);
      setRecItems(r.data.items ?? []);
      setOutfits(o.data.items ?? []);
    } catch {
      /* gợi ý là phần bổ trợ - lỗi không chặn luồng phân tích */
    } finally {
      setRecLoading(false);
    }
  }

  const categoryName = useMemo(() => {
    const map: Record<number, string> = {};
    for (const c of categories) map[c.id] = c.name;
    return map;
  }, [categories]);

  function load() {
    setLoading(true);
    Promise.all([
      api.get('/body/consent'),
      api.get('/body/profile'),
      api.get('/categories'),
      api.get('/personalization/body-sync'),
    ])
      .then(([consentRes, profileRes, catRes, syncRes]) => {
        setConsented(!!consentRes.data.consented);
        setProfile(profileRes.data.profile ?? null);
        setCategories(catRes.data.categories ?? []);
        setSyncStatus(syncRes.data);
        if (profileRes.data.profile) fetchRecs(); // đã có dáng -> nạp gợi ý ngay
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  // UC2.3 - làm mới trạng thái đồng bộ
  async function refreshSync() {
    try {
      const r = await api.get('/personalization/body-sync');
      setSyncStatus(r.data);
    } catch {
      /* không chặn luồng chính */
    }
  }

  // UC2.3 bước 5-8 - đồng bộ thủ công
  async function doSync() {
    setError('');
    setSuccess('');
    setSyncing(true);
    try {
      const res = await api.post('/personalization/body-sync');
      setSuccess(
        `${res.data.message}${res.data.appliedSizes ? ` Đã cập nhật ${res.data.appliedSizes} gợi ý size theo danh mục.` : ''}`
      );
      await refreshSync();
    } catch (err) {
      setError(getErrorMessage(err)); // 2F / 6E
    } finally {
      setSyncing(false);
    }
  }

  // UC2.3 - 2a: bật/tắt tự đồng bộ
  async function toggleAutoSync(enabled: boolean) {
    try {
      const res = await api.put('/personalization/body-sync/auto', { enabled });
      setSyncStatus((s) => (s ? { ...s, autoSync: res.data.autoSync } : s));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  // b2 - khách hàng đồng ý điều khoản
  async function giveConsent() {
    setError('');
    setConsenting(true);
    try {
      await api.post('/body/consent');
      setConsented(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setConsenting(false);
    }
  }

  function pickPhoto(file: File | null) {
    setPhotoFile(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function openForm() {
    setFormError('');
    setSuccess('');
    setShowForm(true);
    // Điền sẵn số đo từ Body Profile hiện hành để hỗ trợ phân tích lại (7a)
    if (profile) {
      setValues({
        height: profile.height != null ? String(profile.height) : '',
        weight: profile.weight != null ? String(profile.weight) : '',
        bust: profile.bust != null ? String(profile.bust) : '',
        waist: profile.waist != null ? String(profile.waist) : '',
        hip: profile.hip != null ? String(profile.hip) : '',
      });
    }
  }

  // b5-b7 - gửi dữ liệu để phân tích (backend include UC3.2 xử lý + UC3.3 sinh hồ sơ)
  async function analyze() {
    setFormError('');
    // 5F - kiểm tra sơ bộ phía client các trường bắt buộc
    for (const f of MEASUREMENT_FIELDS) {
      if (f.required && !values[f.key].trim()) {
        setFormError('Vui lòng nhập đầy đủ số đo bắt buộc (chiều cao, ngực, eo, hông).');
        return;
      }
    }
    setAnalyzing(true);
    try {
      const form = new FormData();
      form.append('source', source);
      for (const f of MEASUREMENT_FIELDS) {
        if (values[f.key].trim()) form.append(f.key, values[f.key].trim());
      }
      if (source === 'PHOTO' && photoFile) form.append('photo', photoFile);

      const res = await api.post('/body/analyze', form);
      setProfile(res.data.profile);
      setShowForm(false);
      pickPhoto(null);
      setSuccess(res.data.profile.isPreliminary
        ? 'Đã phân tích xong. Độ tin cậy thấp nên kết quả chỉ mang tính sơ bộ — bạn nên hiệu chỉnh số đo.'
        : 'Phân tích dáng người thành công.');
      refreshSync(); // UC2.3 - có bản mới -> cập nhật trạng thái đồng bộ (2a nếu bật tự đồng bộ)
      fetchRecs(); // UC5 - phân tích xong -> hiện ngay gợi ý phối đồ + sản phẩm hợp dáng
    } catch (err) {
      setFormError(getErrorMessage(err)); // 5E/5F/6E/7E - dùng thông báo từ backend
    } finally {
      setAnalyzing(false);
    }
  }

  // UC3.4 bước 6-9 - xác nhận cuối và xóa dữ liệu cơ thể theo phạm vi
  async function confirmDelete() {
    if (!confirmScope) return;
    setError('');
    setSuccess('');
    setDeleting(true);
    try {
      const res = await api.delete('/body/data', { params: { scope: confirmScope } });
      if (confirmScope === 'ALL') {
        setProfile(null); // đã xóa toàn bộ -> quay về trạng thái chưa phân tích
      } else {
        // 3a - chỉ xóa ảnh: tải lại hồ sơ để phản ánh ảnh đã bị gỡ
        const p = await api.get('/body/profile');
        setProfile(p.data.profile ?? null);
      }
      setSuccess(res.data.message);
      setConfirmScope(null);
      refreshSync(); // UC2.3 - liên kết đồng bộ đã tự hủy khi xóa Body Profile
    } catch (err) {
      setError(getErrorMessage(err)); // 2F (không có dữ liệu) / 7E (lỗi hệ thống)
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="max-w-2xl mx-auto px-4 py-10 text-gray-400">Đang tải...</p>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/profile" className="text-sm text-gray-400 hover:text-gray-600">← Hồ sơ cá nhân</Link>
      <h1 className="text-2xl font-bold mt-2 mb-6">Phân tích dáng người</h1>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {/* b2 - Cổng đồng ý điều khoản (informed consent). Chưa đồng ý -> không thu thập dữ liệu (2F) */}
      {!consented ? (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold mb-2">Đồng ý xử lý dữ liệu cơ thể</h2>
          <ul className="text-sm text-gray-600 space-y-1.5 list-disc pl-5 mb-4">
            <li>Ảnh và số đo cơ thể là dữ liệu cá nhân nhạy cảm, chỉ dùng cho mục đích phân tích dáng người và cá nhân hóa gợi ý.</li>
            <li>Dữ liệu được bảo vệ theo chính sách quyền riêng tư; chỉ bạn mới xem được kết quả của chính mình.</li>
            <li>Bạn có thể xóa ảnh và dữ liệu cơ thể bất kỳ lúc nào trong mục quản lý dữ liệu.</li>
            <li>Phân tích dáng người là tùy chọn — không bắt buộc để sử dụng hệ thống.</li>
          </ul>
          <PrimaryButton style={{ width: 'auto' }} onClick={giveConsent} disabled={consenting}>
            {consenting ? 'Đang xử lý...' : 'Tôi đồng ý'}
          </PrimaryButton>
        </div>
      ) : (
        <>
          {/* b8 - Bản tóm tắt Body Profile hiện hành */}
          {profile && !showForm && <ProfileSummary profile={profile} categoryName={categoryName} />}

          {/* UC2.3 - Đồng bộ Body Profile vào hồ sơ cá nhân hóa (b9 của UC3.1) */}
          {profile && !showForm && syncStatus && (
            <div className="bg-white rounded-xl border p-6 mb-5">
              <h3 className="font-medium mb-1">Đồng bộ vào hồ sơ cá nhân hóa</h3>
              <p className="text-sm text-gray-500 mb-3">
                Đưa Body Profile mới nhất vào hồ sơ để hệ thống đề xuất size (UC2.2) và gợi ý sản phẩm,
                tư vấn phong cách (UC5) theo dữ liệu cơ thể của bạn.
              </p>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm">
                  {syncStatus.synced ? (
                    syncStatus.needsSync ? (
                      <span className="text-amber-600">● Có bản phân tích mới chưa đồng bộ.</span>
                    ) : (
                      <span className="text-green-600">● Đã đồng bộ (bản v{profile.version}).</span>
                    )
                  ) : (
                    <span className="text-gray-500">○ Chưa đồng bộ vào hồ sơ.</span>
                  )}
                </p>
                {(syncStatus.needsSync || !syncStatus.synced) && (
                  <PrimaryButton style={{ width: 'auto' }} onClick={doSync} disabled={syncing}>
                    {syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
                  </PrimaryButton>
                )}
              </div>
              <label className="flex items-center gap-2 mt-3 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={syncStatus.autoSync}
                  onChange={(e) => toggleAutoSync(e.target.checked)}
                />
                Tự động đồng bộ khi có bản phân tích mới
              </label>
              {syncStatus.synced && !syncStatus.needsSync && (
                <p className="text-xs text-gray-400 mt-2">
                  {/* 7a - số đo mới có thể ảnh hưởng size */}
                  Số đo có thể ảnh hưởng size — xem lại trong{' '}
                  <Link to="/profile/sizes" className="underline">Thông tin size</Link> (UC2.2).
                </p>
              )}
            </div>
          )}

          {/* UC5.1/UC5.2 - Gợi ý phối đồ + sản phẩm hợp dáng NGAY sau khi phân tích */}
          {profile && !showForm && (
            <SuggestedForShape loading={recLoading} recItems={recItems} outfits={outfits} shapeLabel={SHAPE_LABEL[profile.bodyShape]} />
          )}

          {/* b3-b4 - Biểu mẫu chọn phương thức và nhập liệu */}
          {showForm ? (
            <div className="bg-white rounded-xl border p-6">
              <ErrorBox message={formError} />
              <p className="text-sm font-medium text-gray-700 mb-2">Phương thức cung cấp dữ liệu</p>
              <div className="flex flex-wrap gap-2 mb-5">
                <Chip active={source === 'MANUAL'} onClick={() => setSource('MANUAL')}>Nhập số đo thủ công</Chip>
                <Chip active={source === 'PHOTO'} onClick={() => setSource('PHOTO')}>Tải/chụp ảnh toàn thân</Chip>
              </div>

              {source === 'PHOTO' && (
                <div className="mb-5">
                  <label className="block">
                    <span className="block text-xs text-gray-500 mb-1">Ảnh toàn thân (JPG/PNG/WEBP, tối đa 5MB)</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border file:border-gray-300 file:bg-gray-50 file:px-3 file:py-2 file:text-sm"
                    />
                  </label>
                  {photoPreview && (
                    <img src={photoPreview} alt="Xem trước" className="mt-3 h-40 rounded-lg object-cover border" />
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-5">
                {MEASUREMENT_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="block text-xs text-gray-500 mb-1">
                      {f.label}{f.required && <span className="text-red-400"> *</span>}
                    </span>
                    <input
                      type="number"
                      value={values[f.key]}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                <PrimaryButton style={{ width: 'auto' }} onClick={analyze} disabled={analyzing}>
                  {analyzing ? 'Đang phân tích...' : 'Phân tích'}
                </PrimaryButton>
                <SecondaryButton type="button" onClick={() => { setShowForm(false); pickPhoto(null); }}>Hủy</SecondaryButton>
              </div>
            </div>
          ) : (
            <button
              onClick={openForm}
              className="w-full bg-white rounded-xl border border-dashed border-gray-300 p-5 text-sm font-medium text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors"
            >
              {profile ? '+ Phân tích lại (tạo bản cập nhật)' : '+ Bắt đầu phân tích dáng người'}
            </button>
          )}

          {/* UC3.4 - Xóa dữ liệu cơ thể (quyền được xóa - right to erasure) */}
          {profile && !showForm && (
            <div className="bg-white rounded-xl border border-red-100 p-6 mt-5">
              <h3 className="font-medium text-red-600 mb-1">Xóa dữ liệu cơ thể</h3>
              <p className="text-sm text-gray-500 mb-4">
                Bạn có thể xóa ảnh hoặc toàn bộ dữ liệu cơ thể bất kỳ lúc nào. Thao tác không thể
                hoàn tác và sẽ ảnh hưởng tới đề xuất size (UC2.2) và gợi ý sản phẩm (UC5).
              </p>

              {confirmScope ? (
                // bước 5-6 - xác nhận lần cuối, nêu rõ không thể hoàn tác
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-red-700 mb-3">
                    {confirmScope === 'ALL'
                      ? 'Xóa toàn bộ dữ liệu cơ thể (ảnh, số đo và Body Profile). Thao tác KHÔNG THỂ hoàn tác. Bạn chắc chắn?'
                      : 'Chỉ xóa ảnh đã tải lên, giữ lại Body Profile. Bạn chắc chắn?'}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={confirmDelete}
                      disabled={deleting}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
                    >
                      {deleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
                    </button>
                    {/* 4a - hủy thao tác trước khi xác nhận */}
                    <SecondaryButton type="button" onClick={() => setConfirmScope(null)}>Hủy</SecondaryButton>
                  </div>
                </div>
              ) : (
                // bước 3-4 - chọn phạm vi xóa
                <div className="flex flex-wrap gap-2">
                  {profile.photoUrl && (
                    <SecondaryButton danger type="button" onClick={() => setConfirmScope('PHOTO_ONLY')}>
                      Xóa ảnh (giữ hồ sơ)
                    </SecondaryButton>
                  )}
                  <SecondaryButton danger type="button" onClick={() => setConfirmScope('ALL')}>
                    Xóa toàn bộ dữ liệu cơ thể
                  </SecondaryButton>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// b8 - Hiển thị tóm tắt Body Profile + b9 gợi ý đồng bộ UC2.3
function ProfileSummary({ profile, categoryName }: { profile: BodyProfile; categoryName: Record<number, string> }) {
  return (
    <div className="bg-white rounded-xl border p-6 mb-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400">Dáng người của bạn</p>
          <h2 className="text-xl font-bold">{SHAPE_LABEL[profile.bodyShape]}</h2>
          <p className="text-xs text-gray-400 mt-1">
            Bản v{profile.version} ·{' '}
            Độ tin cậy {Math.round(profile.confidence * 100)}% ·{' '}
            {profile.source === 'PHOTO' ? 'Từ ảnh + số đo' : 'Từ số đo thủ công'} ·{' '}
            {new Date(profile.createdAt).toLocaleDateString('vi-VN')}
          </p>
        </div>
        {profile.photoUrl && (
          <img src={API_ORIGIN + profile.photoUrl} alt="Ảnh phân tích" className="h-20 w-20 rounded-lg object-cover border" />
        )}
      </div>

      {/* 4a/6a - cảnh báo kết quả sơ bộ khi độ tin cậy dưới ngưỡng */}
      {profile.isPreliminary && (
        <div className="bg-amber-50 text-amber-700 text-sm rounded-lg px-3 py-2 mt-3">
          Kết quả là ước lượng sơ bộ do độ tin cậy thấp. Bạn nên hiệu chỉnh hoặc bổ sung số đo để tăng độ chính xác.
        </div>
      )}

      <dl className="grid grid-cols-3 gap-3 mt-4 text-sm">
        {([['Chiều cao', profile.height, 'cm'], ['Cân nặng', profile.weight, 'kg'], ['Vòng ngực', profile.bust, 'cm'],
           ['Vòng eo', profile.waist, 'cm'], ['Vòng hông', profile.hip, 'cm']] as const)
          .filter(([, v]) => v != null)
          .map(([label, v, unit]) => (
            <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
              <dt className="text-xs text-gray-400">{label}</dt>
              <dd className="font-medium">{v} {unit}</dd>
            </div>
          ))}
      </dl>

      {profile.recommendations && (
        <div className="mt-5 border-t pt-4">
          <h3 className="font-medium mb-1">Khuyến nghị trang phục</h3>
          <p className="text-sm text-gray-500 mb-3">{profile.recommendations.description}</p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="bg-green-50 rounded-lg p-3">
              <p className="font-medium text-green-700 mb-1">Nên mặc</p>
              <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
                {profile.recommendations.should.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <p className="font-medium text-red-600 mb-1">Nên tránh</p>
              <ul className="list-disc pl-4 space-y-0.5 text-gray-600">
                {profile.recommendations.avoid.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {profile.suggestedSizes && profile.suggestedSizes.length > 0 && (
        <div className="mt-5 border-t pt-4">
          <h3 className="font-medium mb-2">Gợi ý size sơ bộ theo danh mục</h3>
          <div className="flex flex-wrap gap-2">
            {profile.suggestedSizes.map((s) => (
              <span key={s.categoryId} className="text-sm bg-gray-100 rounded-full px-3 py-1">
                {categoryName[s.categoryId] ?? `Danh mục #${s.categoryId}`}: <span className="font-medium">{s.sizeValue}</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">Đồng bộ với bảng quy đổi size chuẩn (UC2.2). Bạn có thể chỉnh sửa trong mục Thông tin size.</p>
        </div>
      )}
    </div>
  );
}

const imgOf = (url?: string | null) => url || PRODUCT_PLACEHOLDER;

// UC5.1 + UC5.2 - khối gợi ý hiện ngay dưới kết quả phân tích: bộ phối + sản phẩm hợp dáng
function SuggestedForShape(
  { loading, recItems, outfits, shapeLabel }:
  { loading: boolean; recItems: RecItem[]; outfits: OutfitItem[]; shapeLabel: string },
) {
  if (loading) return <div className="bg-white rounded-xl border p-6 mb-5 text-sm text-gray-400">Đang tạo gợi ý phối đồ cho dáng của bạn...</div>;
  if (!recItems.length && !outfits.length) return null;

  return (
    <div className="bg-white rounded-xl border p-6 mb-5">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="font-semibold">Gợi ý cho dáng {shapeLabel}</h3>
        <Link to="/recommendations" className="text-sm text-indigo-600 hover:underline">Xem tất cả →</Link>
      </div>
      <p className="text-sm text-gray-500 mb-4">Bộ phối và sản phẩm hợp dáng, chọn từ kho theo luật phối đồ (UC4.2).</p>

      {/* UC5.2 - Bộ đồ phối sẵn */}
      {outfits.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-2">Phối đồ cho bạn</p>
          <div className="space-y-3">
            {outfits.map((o, idx) => {
              const total = o.items.reduce((a, p) => a + p.price, 0);
              return (
                <div key={idx} className="border rounded-lg p-3">
                  <div className="flex gap-2 overflow-x-auto">
                    {o.items.map((p) => (
                      <div key={p.id} className="shrink-0 w-20 text-center">
                        <img src={imgOf(p.image)} alt={p.name} onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }}
                          className="w-20 h-24 object-cover rounded-md bg-gray-100 border" />
                        <p className="text-[10px] text-gray-400 mt-1">{SLOT_LABEL[p.slot] ?? p.slot}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <p className="text-xs text-gray-600">{o.why}</p>
                    <p className="text-sm font-semibold text-brand whitespace-nowrap">{total.toLocaleString('vi-VN')}₫</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* UC5.1 - Sản phẩm hợp dáng đơn lẻ */}
      {recItems.length > 0 && (
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Sản phẩm hợp dáng</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recItems.map((it) => {
              const img = it.product.images.find((x) => x.isPrimary)?.url || it.product.images[0]?.url || PRODUCT_PLACEHOLDER;
              return (
                <div key={it.product.id} className="border rounded-lg overflow-hidden flex flex-col">
                  <img src={img} alt={it.product.name} onError={(e) => { e.currentTarget.src = PRODUCT_PLACEHOLDER; }}
                    className="w-full aspect-[4/5] object-cover bg-gray-100" />
                  <div className="p-2 flex flex-col gap-1 flex-1">
                    <p className="text-xs font-medium line-clamp-2">{it.product.name}</p>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-brand font-semibold text-sm">{it.product.price.toLocaleString('vi-VN')}₫</p>
                      <button onClick={() => recordBehavior(it.product.id, 'WISHLIST')}
                        className="text-xs rounded-full border border-gray-300 text-gray-500 px-2 py-0.5 hover:border-red-300 hover:text-red-500" title="Thêm yêu thích">♡</button>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-2">{it.why}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
