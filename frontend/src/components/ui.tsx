import { useState, type ReactNode, type InputHTMLAttributes, type ButtonHTMLAttributes } from 'react';

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

// Nhãn + input. Ô mật khẩu có nút xem/ẩn (toggle).
export function Field({
  label, hint, ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const isPassword = props.type === 'password';
  const [show, setShow] = useState(false);
  const type = isPassword ? (show ? 'text' : 'password') : props.type;
  return (
    <label className="block mb-4">
      <span className="block text-sm font-medium text-gray-700 mb-1.5">{label}</span>
      <div className="relative">
        <input
          {...props}
          type={type}
          className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm
                     focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 ${isPassword ? 'pr-10' : ''}`}
        />
        {isPassword && (
          <button type="button" tabIndex={-1} onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
            {show ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
            )}
          </button>
        )}
      </div>
      {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
    </label>
  );
}

// Quy tắc mật khẩu mạnh (đồng bộ passwordSchema ở backend)
const PW_RULES: { test: (v: string) => boolean; label: string }[] = [
  { test: (v) => v.length >= 8, label: 'Tối thiểu 8 ký tự' },
  { test: (v) => /[a-z]/.test(v), label: 'Có chữ thường' },
  { test: (v) => /[A-Z]/.test(v), label: 'Có chữ hoa' },
  { test: (v) => /[0-9]/.test(v), label: 'Có chữ số' },
  { test: (v) => /[^A-Za-z0-9]/.test(v), label: 'Có ký tự đặc biệt' },
];
export const passwordOk = (v: string) => PW_RULES.every((r) => r.test(v));

// Danh sách tiêu chí mật khẩu (hiện khi người dùng bắt đầu nhập)
export function PasswordChecklist({ value }: { value: string }) {
  if (!value) return null;
  return (
    <ul className="mb-4 -mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
      {PW_RULES.map((r) => {
        const ok = r.test(value);
        return <li key={r.label} className={ok ? 'text-green-600' : 'text-gray-400'}>{ok ? '✓' : '○'} {r.label}</li>;
      })}
    </ul>
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
