import type { ReactNode, InputHTMLAttributes, ButtonHTMLAttributes } from 'react';

// Thẻ khung cho các màn hình xác thực (theo mockup)
export function AuthCard({
  url, title, badge, children,
}: { url: string; title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f5f2ea] flex items-start justify-center py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-gray-200 shadow-sm p-7">
        <span className="inline-block text-xs font-mono text-gray-500 bg-gray-100 rounded px-2 py-1 mb-4">
          {url}
        </span>
        <div className="flex items-center gap-2 mb-5">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {badge}
        </div>
        {children}
      </div>
    </div>
  );
}

// Nhãn + input
export function Field({
  label, hint, ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">{label}</span>
      <input
        {...props}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                   focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
      />
      {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

// Nút chính (đậm) theo mockup
export function PrimaryButton({ children, ...props }: InputHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...(props as any)}
      className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white
                 font-semibold py-2.5 rounded-lg transition-colors"
    >
      {children}
    </button>
  );
}

// Nút Google (viền)
export function GoogleButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => alert('Đăng nhập mạng xã hội (OAuth) sẽ tích hợp ở bước sau.')}
      className="w-full border border-gray-300 hover:bg-gray-50 rounded-lg py-2.5
                 flex items-center justify-center gap-2 text-sm font-medium text-gray-700"
    >
      <span className="text-[#4285F4] font-bold">G</span> {label}
    </button>
  );
}

// Vạch ngăn "hoặc"
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-4 text-xs text-gray-400">
      <div className="h-px bg-gray-200 flex-1" /> hoặc <div className="h-px bg-gray-200 flex-1" />
    </div>
  );
}

// Hộp thông báo lỗi
export function ErrorBox({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2 mb-4">{message}</div>;
}

// Badge "Chờ kiểm duyệt"
export function PendingBadge() {
  return (
    <span className="text-xs font-medium bg-amber-100 text-amber-700 rounded-full px-2.5 py-1">
      Chờ kiểm duyệt
    </span>
  );
}


// Nút phụ (viền, dùng cho Hủy/Xóa/Sửa)
export function SecondaryButton({ children, danger, ...props }: any) {
  return (
    <button
      {...props}
      className={`border rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

// Hộp thông báo thành công
export function SuccessBox({ message }: { message?: string }) {
  if (!message) return null;
  return <div className="bg-green-50 text-green-700 text-sm rounded-lg px-3 py-2 mb-4">{message}</div>;
}

// Chip lựa chọn (bật/tắt) - dùng cho UC2.1 sở thích, dịp sử dụng...
export function Chip({
  active, tone = 'default', children, ...props
}: { active: boolean; tone?: 'default' | 'danger' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  const activeCls = tone === 'danger'
    ? 'bg-red-50 border-red-300 text-red-600'
    : 'bg-gray-900 border-gray-900 text-white';
  return (
    <button
      type="button"
      {...props}
      className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
        active ? activeCls : 'border-gray-300 text-gray-600 hover:border-gray-400'
      }`}
    >
      {children}
    </button>
  );
}

// Tiêu đề phần trong biểu mẫu nhiều bước (UC2.1)
export function SectionTitle({ step, title, hint }: { step?: string; hint?: string; title: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {step && <span className="text-xs font-mono text-gray-400">{step}</span>}
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      {hint && <p className="text-sm text-gray-500 mt-1">{hint}</p>}
    </div>
  );
}
