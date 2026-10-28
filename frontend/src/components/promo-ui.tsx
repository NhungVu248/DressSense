import type { ReactNode } from 'react';

// UI dùng chung cho các trang khuyến mãi / banner / chiến dịch (UC13).

export const money = (n: number) => n.toLocaleString('vi-VN') + '₫';

export const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

// ISO -> value cho input datetime-local (giờ địa phương)
export const toLocalInput = (s: string | null) => {
  if (!s) return '';
  const d = new Date(s); const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const PROMO_STATUS: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Nháp', cls: 'bg-gray-200 text-gray-600' },
  SCHEDULED: { label: 'Đã lên lịch', cls: 'bg-blue-100 text-blue-700' },
  RUNNING: { label: 'Đang diễn ra', cls: 'bg-green-100 text-green-700' },
  ENDED: { label: 'Đã kết thúc', cls: 'bg-gray-100 text-gray-500' },
  STOPPED: { label: 'Đã ngừng', cls: 'bg-red-100 text-red-600' },
  SENT: { label: 'Đã gửi', cls: 'bg-green-100 text-green-700' },
  CANCELLED: { label: 'Đã hủy', cls: 'bg-red-100 text-red-600' },
};
export function StatusBadge({ status }: { status: string }) {
  const s = PROMO_STATUS[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' };
  return <span className={`text-xs rounded-full px-2 py-0.5 ${s.cls}`}>{s.label}</span>;
}

export const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';

export function L({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? 'col-span-2' : ''}`}>
      <span className="block text-xs font-medium text-gray-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className={`bg-white rounded-xl p-5 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto`} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-semibold mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between flex-wrap gap-2 mb-4">
      <div>
        <h1 className="text-2xl font-display font-bold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyCard({ label }: { label: string }) {
  return <div className="bg-white border border-brand/10 rounded-xl p-8 text-center text-gray-500">{label}</div>;
}
