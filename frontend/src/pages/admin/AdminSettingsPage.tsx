import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { listSettings, updateSettings, getSettingHistory, type Setting } from '../../lib/admin';

// UC16.5 - Cấu hình hệ thống
export default function AdminSettingsPage() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: listSettings });
  const [vals, setVals] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { if (settings) setVals(Object.fromEntries(settings.map((s) => [s.key, s.value]))); }, [settings]);

  const groups = useMemo(() => {
    const m = new Map<string, Setting[]>();
    (settings ?? []).forEach((s) => { const g = m.get(s.group) ?? []; g.push(s); m.set(s.group, g); });
    return [...m.entries()];
  }, [settings]);

  const dirty = settings?.filter((s) => vals[s.key] !== undefined && vals[s.key] !== s.value) ?? [];

  const saveMut = useMutation({
    mutationFn: () => updateSettings(dirty.map((s) => ({ key: s.key, value: vals[s.key] }))),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['settings'] }); qc.invalidateQueries({ queryKey: ['settings-history'] }); setMsg({ type: 'ok', text: `Đã cập nhật ${r.updated.length} tham số.` }); },
    onError: (e: any) => setMsg({ type: 'err', text: e?.response?.data?.message ?? 'Lưu thất bại.' }),
  });

  const { data: history } = useQuery({ queryKey: ['settings-history'], queryFn: getSettingHistory, enabled: showHistory });

  return (
    <div className="p-5 md:p-8 max-w-3xl">
      <h1 className="font-display text-3xl font-bold mb-1">Cấu hình hệ thống</h1>
      <p className="text-sm text-ink/50 mb-5">Tham số dùng chung giữa các module. Thay đổi được lưu lịch sử (UC16.5).</p>

      {msg && <div className={`mb-5 text-sm px-4 py-3 rounded-xl ${msg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-600'}`}>{msg.text}</div>}

      <div className="space-y-5">
        {groups.map(([group, items]) => (
          <section key={group} className="rounded-2xl border border-brand/10 bg-white p-5">
            <h2 className="font-display text-lg font-bold mb-3">{group}</h2>
            <div className="space-y-4">
              {items.map((s) => (
                <div key={s.key}>
                  <label className="text-sm text-ink/80 font-medium">{s.label}</label>
                  {s.description && <p className="text-xs text-ink/40 mb-1">{s.description}</p>}
                  {s.type === 'boolean' ? (
                    <select value={vals[s.key] ?? s.value} onChange={(e) => setVals((v) => ({ ...v, [s.key]: e.target.value }))}
                      className="mt-1 border border-brand/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand">
                      <option value="true">Bật</option><option value="false">Tắt</option>
                    </select>
                  ) : (
                    <input type={s.type === 'number' ? 'number' : 'text'} value={vals[s.key] ?? s.value}
                      onChange={(e) => setVals((v) => ({ ...v, [s.key]: e.target.value }))}
                      className="mt-1 w-full max-w-sm border border-brand/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand" />
                  )}
                  <span className="ml-2 text-xs text-ink/30">{s.key}</span>
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="rounded-2xl border border-brand/10 bg-white p-5">
          <h2 className="font-display text-lg font-bold mb-1">Danh mục sản phẩm</h2>
          <p className="text-sm text-ink/50 mb-2">Quản lý cây danh mục (thêm/sửa/ẩn) ở trang riêng.</p>
          <Link to="/admin/categories" className="text-sm text-brand font-medium hover:underline">Mở quản lý danh mục →</Link>
        </section>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button onClick={() => { setMsg(null); saveMut.mutate(); }} disabled={dirty.length === 0 || saveMut.isPending}
          className="px-5 py-2.5 rounded-xl bg-brand text-white font-medium hover:bg-brand/90 disabled:opacity-50">
          {saveMut.isPending ? 'Đang lưu…' : `Lưu thay đổi${dirty.length ? ` (${dirty.length})` : ''}`}
        </button>
        <button onClick={() => setShowHistory((v) => !v)} className="text-sm text-ink/60 hover:text-brand">
          {showHistory ? 'Ẩn lịch sử' : 'Xem lịch sử thay đổi'}
        </button>
      </div>

      {showHistory && history && (
        <div className="mt-4 rounded-2xl border border-brand/10 bg-white p-4">
          <h3 className="font-display text-base font-bold mb-2">Lịch sử thay đổi</h3>
          {history.length === 0 ? <p className="text-sm text-ink/40">Chưa có thay đổi nào.</p> : (
            <div className="space-y-1.5 text-sm">
              {history.map((h) => (
                <div key={h.id} className="flex justify-between border-b border-brand/5 last:border-0 py-1">
                  <span className="text-ink/70"><b>{h.key}</b>: {h.valueBefore ?? '∅'} → {h.valueAfter}</span>
                  <span className="text-ink/40 text-xs">{new Date(h.createdAt).toLocaleString('vi-VN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
