import { useEffect, useState } from 'react';

// ============================================================
//  Thông báo nổi (toast) canh GIỮA màn hình, dùng chung toàn hệ thống.
//  Thay thế window.alert() để mọi thông báo cũ tự hiển thị đẹp theo theme,
//  không cần sửa từng chỗ gọi. Tự ẩn sau vài giây, bấm để đóng.
// ============================================================

export interface ToastItem { id: number; message: string; tone: 'info' | 'success' | 'error' }

type Listener = (t: ToastItem) => void;
const listeners = new Set<Listener>();
let seq = 0;

// Đoán sắc thái từ nội dung để tô màu phù hợp.
function toneOf(msg: string): ToastItem['tone'] {
  const m = msg.toLowerCase();
  if (/(không|lỗi|thất bại|vui lòng|chưa|hết hàng|quá|sai)/.test(m)) return 'error';
  if (/(đã|thành công|hoàn tất|đã gửi|đã lưu|đã thêm)/.test(m)) return 'success';
  return 'info';
}

// Gọi trực tiếp nếu cần hiển thị toast từ code.
export function toast(message: string, tone?: ToastItem['tone']) {
  const item: ToastItem = { id: ++seq, message, tone: tone ?? toneOf(message) };
  listeners.forEach((l) => l(item));
}

const TONE_CLS: Record<ToastItem['tone'], string> = {
  info: 'border-brand/20 text-ink',
  success: 'border-emerald-200 text-emerald-700',
  error: 'border-red-200 text-red-600',
};
const ICON: Record<ToastItem['tone'], string> = { info: 'ℹ', success: '✓', error: '!' };
const ICON_CLS: Record<ToastItem['tone'], string> = {
  info: 'bg-brand/10 text-brand',
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-red-100 text-red-600',
};

export default function GlobalToast() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const onToast: Listener = (t) => {
      setItems((prev) => [...prev, t]);
      window.setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 2600);
    };
    listeners.add(onToast);

    // Thay thế window.alert bằng toast canh giữa (giữ lại bản gốc để khôi phục).
    const originalAlert = window.alert;
    window.alert = (msg?: any) => { toast(String(msg ?? '')); };

    return () => { listeners.delete(onToast); window.alert = originalAlert; };
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((x) => x.id !== id));

  if (!items.length) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none">
      <div className="flex flex-col items-center gap-2 w-full max-w-sm">
        {items.map((t) => (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto cursor-pointer w-full bg-white/95 backdrop-blur border ${TONE_CLS[t.tone]} rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3 animate-fadeIn`}
            role="alert"
          >
            <span className={`shrink-0 w-7 h-7 grid place-items-center rounded-full text-sm font-bold ${ICON_CLS[t.tone]}`}>{ICON[t.tone]}</span>
            <p className="text-sm leading-snug flex-1">{t.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
