import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
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
    ])
      .then(([consentRes, profileRes, catRes]) => {
        setConsented(!!consentRes.data.consented);
        setProfile(profileRes.data.profile ?? null);
        setCategories(catRes.data.categories ?? []);
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

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
    } catch (err) {
      setFormError(getErrorMessage(err)); // 5E/5F/6E/7E - dùng thông báo từ backend
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) return <p className="max-w-2xl mx-auto px-4 py-10 text-gray-400">Đang tải...</p>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/profile" className="text-sm text-gray-400 hover:text-gray-600">← Hồ sơ cá nhân</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Phân tích dáng người</h1>
      <p className="text-sm text-gray-500 mb-6">
        AI phân tích tỷ lệ cơ thể để xác định dáng người, gợi ý trang phục và size phù hợp.
        Kết quả mang tính tham khảo — bạn giữ quyền quyết định cuối cùng.
      </p>

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
                  <p className="text-xs text-amber-600 mt-2">
                    Trích xuất số đo tự động từ ảnh sẽ khả dụng khi module AI thị giác được triển khai.
                    Hiện tại vui lòng nhập kèm số đo bên dưới để có kết quả chính xác.
                  </p>
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

      {/* b9 - Đề xuất đồng bộ Body Profile vào hồ sơ cá nhân hóa (UC2.3) */}
      <div className="mt-5 border-t pt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">Đồng bộ kết quả vào hồ sơ cá nhân hóa để nâng độ chính xác của gợi ý (UC5).</p>
        <button
          disabled
          title="Tính năng đồng bộ (UC2.3) sẽ khả dụng ở bước phát triển tiếp theo."
          className="text-sm border border-gray-200 text-gray-400 rounded-lg px-4 py-2 cursor-not-allowed whitespace-nowrap"
        >
          Đồng bộ (sắp có)
        </button>
      </div>
    </div>
  );
}
