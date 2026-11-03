import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listCommissionPolicies, createCommissionPolicy, updateCommissionPolicy, setCommissionPolicyStatus,
  getCommissionPolicyHistory, listAdminCategories, type CommissionPolicy,
} from '../../lib/finance';
import { getErrorMessage } from '../../lib/api';

// 2.1 / 2.2 - Thiết lập & quản lý chính sách hoa hồng (mặc định toàn sàn / theo danh mục).
const empty = { name: '', categoryId: '', commissionRate: '', effectiveFrom: '', effectiveTo: '', note: '' };

export default function AdminCommissionPoliciesPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const { data: policies, isLoading } = useQuery({
    queryKey: ['commission-policies', statusFilter],
    queryFn: () => listCommissionPolicies(statusFilter ? { status: statusFilter } : undefined),
  });
  const { data: categories } = useQuery({ queryKey: ['admin-categories'], queryFn: listAdminCategories });

  const [form, setForm] = useState<typeof empty>(empty);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [historyOf, setHistoryOf] = useState<number | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ['commission-policies'] });
  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function startEdit(p: CommissionPolicy) {
    setEditId(p.id);
    setForm({
      name: p.name, categoryId: p.categoryId ? String(p.categoryId) : '',
      commissionRate: String(p.commissionRate), effectiveFrom: p.effectiveFrom.slice(0, 10),
      effectiveTo: p.effectiveTo ? p.effectiveTo.slice(0, 10) : '', note: p.note ?? '',
    });
  }
  function reset() { setEditId(null); setForm(empty); }

  async function save() {
    if (!form.name.trim() || form.commissionRate === '' || !form.effectiveFrom) { alert('Nhập tên, tỷ lệ và ngày bắt đầu.'); return; }
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      commissionRate: Number(form.commissionRate),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      note: form.note.trim() || undefined,
    };
    try {
      if (editId) await updateCommissionPolicy(editId, payload);
      else await createCommissionPolicy(payload);
      reset(); refresh();
    } catch (e) { alert(getErrorMessage(e)); } finally { setBusy(false); }
  }

  async function toggle(p: CommissionPolicy) {
    const next = p.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    if (!confirm(next === 'INACTIVE' ? 'Ngừng áp dụng chính sách này?' : 'Kích hoạt lại chính sách này?')) return;
    try { await setCommissionPolicyStatus(p.id, next); refresh(); } catch (e) { alert(getErrorMessage(e)); }
  }

  return (
    <div className="p-5 md:p-8 max-w-6xl">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-widest text-ink/40">Tài chính · Hoa hồng</p>
        <h1 className="font-display text-3xl font-bold">Chính sách hoa hồng</h1>
        <p className="text-sm text-ink/50 mt-1">Tỷ lệ mặc định toàn sàn hoặc theo danh mục, áp dụng theo thời gian hiệu lực. Đơn cũ giữ nguyên tỷ lệ đã chốt.</p>
      </div>

      {/* Form thêm / sửa */}
      <div className="bg-white rounded-2xl border border-brand/10 p-4 mb-6">
        <h2 className="font-display text-lg font-bold mb-3">{editId ? 'Sửa chính sách' : 'Thêm chính sách'}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="text-sm">
            <span className="text-ink/60">Tên chính sách</span>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2" placeholder="Hoa hồng thời trang" />
          </label>
          <label className="text-sm">
            <span className="text-ink/60">Phạm vi áp dụng</span>
            <select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2">
              <option value="">Mặc định toàn sàn</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-ink/60">Tỷ lệ hoa hồng (%)</span>
            <input type="number" step="0.1" min="0" max="100" value={form.commissionRate} onChange={(e) => set('commissionRate', e.target.value)} className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2" placeholder="5" />
          </label>
          <label className="text-sm">
            <span className="text-ink/60">Ngày bắt đầu</span>
            <input type="date" value={form.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-ink/60">Ngày kết thúc <span className="text-ink/30">(để trống = không giới hạn)</span></span>
            <input type="date" value={form.effectiveTo} onChange={(e) => set('effectiveTo', e.target.value)} className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2" />
          </label>
          <label className="text-sm">
            <span className="text-ink/60">Ghi chú</span>
            <input value={form.note} onChange={(e) => set('note', e.target.value)} className="mt-1 w-full border border-brand/20 rounded-lg px-3 py-2" />
          </label>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={save} disabled={busy} className="bg-brand text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50">{editId ? 'Lưu thay đổi' : 'Thêm chính sách'}</button>
          {editId && <button onClick={reset} className="border border-brand/20 rounded-lg px-4 py-2 text-sm">Hủy</button>}
        </div>
      </div>

      {/* Bộ lọc */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <span className="text-ink/50">Trạng thái:</span>
        {['', 'ACTIVE', 'INACTIVE'].map((s) => (
          <button key={s || 'all'} onClick={() => setStatusFilter(s)} className={`px-3 py-1 rounded-full border ${statusFilter === s ? 'bg-brand text-white border-brand' : 'border-brand/20 text-ink/70'}`}>
            {s === '' ? 'Tất cả' : s === 'ACTIVE' ? 'Đang áp dụng' : 'Ngừng'}
          </button>
        ))}
      </div>

      {/* Danh sách */}
      {isLoading ? <p className="text-ink/40">Đang tải…</p> : (
        <div className="bg-white rounded-2xl border border-brand/10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink/50 border-b border-brand/10">
                <th className="py-2.5 px-3 font-medium">Tên</th>
                <th className="py-2.5 px-3 font-medium">Phạm vi</th>
                <th className="py-2.5 px-3 font-medium text-right">Tỷ lệ</th>
                <th className="py-2.5 px-3 font-medium">Hiệu lực</th>
                <th className="py-2.5 px-3 font-medium">Trạng thái</th>
                <th className="py-2.5 px-3 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(!policies || policies.length === 0) ? (
                <tr><td colSpan={6} className="text-center text-ink/40 py-10">Chưa có chính sách nào.</td></tr>
              ) : policies.map((p) => (
                <tr key={p.id} className="border-b border-brand/5 last:border-0">
                  <td className="py-2.5 px-3 font-medium">{p.name}</td>
                  <td className="py-2.5 px-3">{p.categoryName}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-brand">{p.commissionRate}%</td>
                  <td className="py-2.5 px-3 text-ink/60 text-[13px]">
                    {new Date(p.effectiveFrom).toLocaleDateString('vi-VN')} → {p.effectiveTo ? new Date(p.effectiveTo).toLocaleDateString('vi-VN') : '∞'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.status === 'ACTIVE' ? 'Đang áp dụng' : 'Ngừng'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button onClick={() => startEdit(p)} className="text-brand hover:underline mr-3">Sửa</button>
                    <button onClick={() => toggle(p)} className="text-ink/60 hover:underline mr-3">{p.status === 'ACTIVE' ? 'Ngừng' : 'Kích hoạt'}</button>
                    <button onClick={() => setHistoryOf(p.id)} className="text-ink/60 hover:underline">Lịch sử</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {historyOf != null && <HistoryModal policyId={historyOf} onClose={() => setHistoryOf(null)} />}
    </div>
  );
}

function HistoryModal({ policyId, onClose }: { policyId: number; onClose: () => void }) {
  const [logs, setLogs] = useState<any[] | null>(null);
  useEffect(() => { getCommissionPolicyHistory(policyId).then(setLogs).catch(() => setLogs([])); }, [policyId]);
  const ACTION: Record<string, string> = { CREATE: 'Tạo mới', UPDATE: 'Cập nhật', ACTIVATE: 'Kích hoạt', DEACTIVATE: 'Ngừng áp dụng' };
  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-lg font-bold">Lịch sử thay đổi</h3>
          <button onClick={onClose} className="text-ink/40 hover:text-ink">✕</button>
        </div>
        {logs == null ? <p className="text-ink/40 text-sm">Đang tải…</p>
          : logs.length === 0 ? <p className="text-ink/40 text-sm">Chưa có thay đổi.</p>
            : (
              <ul className="space-y-2 text-sm">
                {logs.map((l) => (
                  <li key={l.id} className="border-b border-brand/5 pb-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{ACTION[l.action] ?? l.action}</span>
                      <span className="text-ink/40 text-xs">{new Date(l.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                    {l.before && l.after && l.before.commissionRate !== l.after.commissionRate && (
                      <p className="text-ink/60 text-xs">Tỷ lệ: {l.before.commissionRate}% → {l.after.commissionRate}%</p>
                    )}
                    {l.actorId && <p className="text-ink/40 text-xs">Người thực hiện: #{l.actorId}</p>}
                  </li>
                ))}
              </ul>
            )}
      </div>
    </div>
  );
}
