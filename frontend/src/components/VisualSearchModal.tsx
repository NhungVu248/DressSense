import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatVND } from '../lib/products';
import { PRODUCT_PLACEHOLDER } from '../lib/placeholder';

interface MatchedProduct {
  id: number;
  name: string;
  price: number;
  category: { name: string };
  images: { url: string; isPrimary: boolean }[];
}

interface MatchResult {
  confidence?: number;
  garment?: string;
  items: { product: MatchedProduct; score?: number; matchReason?: string }[];
}

interface VisualSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SAMPLE_INSPIRATIONS = [
  { label: 'Áo sơ mi trắng', garment: 'shirt', color: 'Trắng', img: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=300&q=80' },
  { label: 'Đầm hoa nữ tính', garment: 'dress', color: 'Hồng pastel', img: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=300&q=80' },
  { label: 'Blazer công sở', garment: 'jacket', color: 'Xanh than', img: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=300&q=80' },
];

export default function VisualSearchModal({ isOpen, onClose }: VisualSearchModalProps) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  function handleFile(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Định dạng ảnh không hỗ trợ. Vui lòng chọn ảnh JPG, PNG hoặc WEBP.');
      return;
    }
    setSelectedFile(file);
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSearch() {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    try {
      if (!user) {
        // Khách chưa đăng nhập: nhắc đăng nhập hoặc tìm kiếm theo từ khóa liên quan
        setError('Vui lòng đăng nhập để sử dụng tính năng tìm kiếm bằng AI.');
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('image', selectedFile);
      const res = await api.post('/recommendations/search-by-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      if (err.response?.status === 503) {
        setError('Dịch vụ AI trích xuất hình ảnh hiện đang cập nhật. Bạn có thể tìm nhanh theo gợi ý bên dưới.');
      } else {
        setError(msg || 'Không thể nhận diện hình ảnh. Vui lòng thử lại với ảnh rõ nét hơn.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSelectSample(sample: typeof SAMPLE_INSPIRATIONS[0]) {
    onClose();
    nav(`/products?q=${encodeURIComponent(sample.label)}`);
  }

  function handleGoProduct(id: number) {
    onClose();
    nav(`/products/${id}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-black/10 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-ink grid place-items-center transition-colors"
          aria-label="Đóng"
        >
          ✕
        </button>

        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-brand/10 text-brand grid place-items-center mx-auto mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-ink">Tìm kiếm bằng hình ảnh</h2>
          <p className="text-sm text-gray-500 mt-1">Tải lên hình ảnh trang phục để AI DressSense tìm các sản phẩm tương đồng về kiểu dáng và màu sắc.</p>
        </div>

        {/* Khung tải ảnh */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
          }}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            previewUrl ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-brand/50 hover:bg-cream'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
          />
          {previewUrl ? (
            <div className="flex flex-col items-center gap-3">
              <img src={previewUrl} alt="Ảnh đã chọn" className="max-h-48 rounded-lg object-contain shadow-sm" />
              <p className="text-xs text-brand font-medium">Nhấn để chọn ảnh khác</p>
            </div>
          ) : (
            <div className="space-y-2 py-4">
              <p className="text-sm font-medium text-gray-700">Kéo thả ảnh vào đây hoặc nhấp để tải lên</p>
              <p className="text-xs text-gray-400">Hỗ trợ JPG, PNG, WEBP (Tối đa 5MB)</p>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm flex items-center justify-between">
            <span>{error}</span>
            {!user && (
              <button
                onClick={() => { onClose(); nav('/login'); }}
                className="underline font-semibold ml-2 text-xs"
              >
                Đăng nhập ngay
              </button>
            )}
          </div>
        )}

        {/* Nút hành động */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={handleSearch}
            disabled={!selectedFile || loading}
            className="flex-1 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors shadow-sm"
          >
            {loading ? 'Đang phân tích hình ảnh...' : 'Tìm sản phẩm tương tự'}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Hủy
          </button>
        </div>

        {/* Kết quả tìm kiếm */}
        {result && result.items && (
          <div className="mt-6 border-t pt-4">
            <h3 className="font-medium text-sm text-ink mb-3">
              Kết quả phù hợp {result.confidence ? `(Độ chính xác: ${Math.round(result.confidence * 100)}%)` : ''}
            </h3>
            {result.items.length === 0 ? (
              <p className="text-sm text-gray-400">Không tìm thấy sản phẩm tương đồng trực tiếp trong kho.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {result.items.slice(0, 6).map((it) => {
                  const p = it.product;
                  const img = p.images.find((x) => x.isPrimary)?.url || p.images[0]?.url || PRODUCT_PLACEHOLDER;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleGoProduct(p.id)}
                      className="group cursor-pointer border rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-[3/4] bg-gray-100 overflow-hidden">
                        <img
                          src={img}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="p-2">
                        <p className="text-xs font-medium text-ink line-clamp-1">{p.name}</p>
                        <p className="text-xs text-brand font-semibold mt-1">{formatVND(p.price)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Cảm hứng mẫu */}
        <div className="mt-6 border-t pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">Hoặc thử phong cách nổi bật:</p>
          <div className="grid grid-cols-3 gap-2">
            {SAMPLE_INSPIRATIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => handleSelectSample(s)}
                className="group flex flex-col items-center text-center p-2 rounded-lg border border-gray-100 hover:border-brand/40 hover:bg-cream transition-colors"
              >
                <img src={s.img} alt={s.label} className="w-14 h-14 rounded-full object-cover mb-1.5 shadow-xs" />
                <span className="text-xs text-gray-700 font-medium group-hover:text-brand line-clamp-1">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

