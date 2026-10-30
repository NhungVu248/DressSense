import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listAdminPasswordResets, resolveAdminPasswordReset } from '../../lib/admin';

// Admin cấp lại mật khẩu cho Quản trị viên khác quên mật khẩu
export default function AdminPasswordResetsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-pw-resets'], queryFn: listAdminPasswordResets });
  const [result, setResult] = useState<{ email?: string; password?: string } | null>(null);
  const mut = useMutation({
    mutationFn: (id: number) => resolveAdminPasswordReset(id),
    onSuccess: (r) => { setResult({ email: r.email, password: r.password }); qc.invalidateQueries({ queryKey: ['admin-pw-resets'] }); },
  });

  return (
    <div className="p-5 md:p-8 max-w-3xl">
      <h1 className="font-display text-3xl font-bold mb-1">Cấp lại mật khẩu quản trị</h1>
      <p className="text-sm text-ink/50 mb-5">Khi một Quản trị viên quên mật khẩu, bạn sinh mật khẩu mới — hệ thống gửi qua email đã đăng ký của họ.</p>

      {result && (
        <div className="mb-5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3">
          Đã cấp mật khẩu mới cho <b>{result.email}</b> (đã gửi qua email).
          {result.password && <> Mật khẩu tạm để chuyển trực tiếp nếu cần: <code className="bg-white px-2 py-0.5 rounded font-mono">{result.password}</code></>}
        </div>
      )}

      {isLoading && <p className="text-sm text-ink/50">Đang tải…</p>}
      {data && data.length === 0 && <p className="text-sm text-ink/40">Không có yêu cầu cấp lại mật khẩu nào.</p>}

      <div className="space-y-3">
        {data?.map((r) => (
          <div key={r.id} className="rounded-2xl border border-brand/10 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{r.user?.fullName ?? `Admin #${r.userId}`}</p>
              <p className="text-sm text-ink/50">{r.user?.email} · Yêu cầu: {new Date(r.requestedAt).toLocaleString('vi-VN')}</p>
            </div>
            <button onClick={() => mut.mutate(r.id)} disabled={mut.isPending}
              className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand/90 disabled:opacity-50">
              Sinh &amp; cấp mật khẩu mới
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
