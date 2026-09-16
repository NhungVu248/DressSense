import { useEffect, useState } from 'react';
import api, { getErrorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { ErrorBox, SuccessBox, SecondaryButton, PrimaryButton } from '../../components/ui';

type Role = 'CUSTOMER' | 'SELLER' | 'ADMIN';
type Status = 'ACTIVE' | 'PENDING_APPROVAL' | 'LOCKED' | 'DISABLED';

interface AdminUser {
  id: number;
  email: string | null;
  phone: string | null;
  fullName: string;
  role: Role;
  status: Status;
  avatarUrl: string | null;
  shopName: string | null;
  provider: 'LOCAL' | 'GOOGLE';
  createdAt: string;
}

interface AuditLog {
  id: number;
  actor: { id: number; fullName: string; email: string | null; phone: string | null };
  target: { id: number; fullName: string; email: string | null; phone: string | null };
  roleBefore: Role;
  roleAfter: Role;
  statusBefore: Status;
  statusAfter: Status;
  note: string | null;
  createdAt: string;
}

const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: 'Khách hàng',
  SELLER: 'Người bán',
  ADMIN: 'Quản trị viên',
};
const STATUS_LABEL: Record<Status, string> = {
  ACTIVE: 'Đang hoạt động',
  PENDING_APPROVAL: 'Chờ kiểm duyệt',
  LOCKED: 'Bị khóa',
  DISABLED: 'Vô hiệu hóa',
};
const STATUS_STYLE: Record<Status, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700',
  LOCKED: 'bg-red-100 text-red-700',
  DISABLED: 'bg-gray-200 text-gray-600',
};

function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN');
}

// UC1.7 - Phân quyền người dùng (chỉ Quản trị viên)
export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [tab, setTab] = useState<'users' | 'logs'>('users');

  // --- Bước 3-4: danh sách + tìm kiếm/lọc (luồng 4a) ---
  const [items, setItems] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [statusFilter, setStatusFilter] = useState<Status | ''>('');
  const [listError, setListError] = useState('');

  function loadUsers(p = page) {
    setListError('');
    api.get('/admin/users', {
      params: {
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page: p,
        limit: 10,
      },
    })
      .then((res) => {
        setItems(res.data.items);
        setTotal(res.data.total);
        setPage(res.data.page);
        setTotalPages(res.data.totalPages);
      })
      .catch((err) => setListError(getErrorMessage(err)));
  }

  useEffect(() => { loadUsers(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadUsers(1);
  }

  // --- Bước 5-9: chọn tài khoản, gán vai trò / phê duyệt / thu hồi (luồng 7E) ---
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<Role>('CUSTOMER');
  const [editStatus, setEditStatus] = useState<Status>('ACTIVE');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  function openDetail(u: AdminUser) {
    setSelected(u);
    setEditRole(u.role);
    setEditStatus(u.status);
    setNote('');
    setDetailError('');
    setSuccessMsg('');
  }

  async function saveRole() {
    if (!selected) return;
    setDetailError('');
    setSaving(true);
    try {
      const res = await api.patch(`/admin/users/${selected.id}`, {
        role: editRole,
        status: editStatus,
        note: note || undefined,
      });
      setSuccessMsg(res.data.message ?? 'Cập nhật phân quyền thành công');
      setSelected(res.data.user);
      loadUsers(page);
    } catch (err) {
      setDetailError(getErrorMessage(err)); // 7E: hiển thị lỗi ràng buộc nghiệp vụ
    } finally {
      setSaving(false);
    }
  }

  // --- Nhật ký phân quyền (phục vụ truy vết/kiểm toán) ---
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [logsError, setLogsError] = useState('');
  function loadLogs() {
    setLogsError('');
    api.get('/admin/audit-logs', { params: { limit: 50 } })
      .then((res) => setLogs(res.data.logs))
      .catch((err) => setLogsError(getErrorMessage(err)));
  }
  useEffect(() => { if (tab === 'logs' && logs === null) loadLogs(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quản trị người dùng</h1>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setTab('users')}
            className={`px-3 py-1.5 rounded-lg font-medium ${tab === 'users' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Danh sách người dùng
          </button>
          <button
            onClick={() => setTab('logs')}
            className={`px-3 py-1.5 rounded-lg font-medium ${tab === 'logs' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Nhật ký phân quyền
          </button>
        </div>
      </div>

      {tab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ErrorBox message={listError} />

            <form onSubmit={onSearchSubmit} className="flex flex-wrap gap-2 mb-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên, email hoặc số điện thoại..."
                className="flex-1 min-w-[200px] border border-gray-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
              />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as Role | '')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Tất cả vai trò</option>
                {(['CUSTOMER', 'SELLER', 'ADMIN'] as Role[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as Status | '')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Tất cả trạng thái</option>
                {(['ACTIVE', 'PENDING_APPROVAL', 'LOCKED', 'DISABLED'] as Status[]).map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
              <SecondaryButton type="submit">Lọc</SecondaryButton>
            </form>

            {!items ? (
              <p className="text-gray-400">Đang tải...</p>
            ) : items.length === 0 ? (
              <p className="text-gray-400 text-sm">Không tìm thấy tài khoản phù hợp.</p>
            ) : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-left">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Tài khoản</th>
                      <th className="px-4 py-2.5 font-medium">Vai trò</th>
                      <th className="px-4 py-2.5 font-medium">Trạng thái</th>
                      <th className="px-4 py-2.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((u) => (
                      <tr key={u.id} className={`border-t ${selected?.id === u.id ? 'bg-indigo-50/50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{u.fullName}</div>
                          <div className="text-gray-400 text-xs">{u.email ?? u.phone}</div>
                        </td>
                        <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[u.status]}`}>
                            {STATUS_LABEL[u.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openDetail(u)} className="text-indigo-600 hover:underline">
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {items && items.length > 0 && (
              <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
                <span>Tổng {total} tài khoản</span>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => loadUsers(page - 1)}
                    className="px-2.5 py-1 rounded border border-gray-300 disabled:opacity-40"
                  >
                    ← Trước
                  </button>
                  <span>Trang {page}/{totalPages}</span>
                  <button
                    disabled={page >= totalPages}
                    onClick={() => loadUsers(page + 1)}
                    className="px-2.5 py-1 rounded border border-gray-300 disabled:opacity-40"
                  >
                    Sau →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bước 5: thông tin tài khoản + gán vai trò */}
          <div>
            {!selected ? (
              <div className="bg-white rounded-xl border p-6 text-sm text-gray-400">
                Chọn một tài khoản để xem chi tiết và gán vai trò.
              </div>
            ) : (
              <div className="bg-white rounded-xl border p-5 sticky top-4">
                <h3 className="font-semibold mb-1">{selected.fullName}</h3>
                <p className="text-xs text-gray-400 mb-4">
                  {selected.email ?? '—'} · {selected.phone ?? '—'} · {selected.provider === 'GOOGLE' ? 'Google' : 'Local'}
                </p>
                <p className="text-xs text-gray-400 mb-4">Tạo lúc: {fmtDate(selected.createdAt)}</p>

                <ErrorBox message={detailError} />
                <SuccessBox message={successMsg} />

                <label className="block mb-3">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">Vai trò</span>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as Role)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {(['CUSTOMER', 'SELLER', 'ADMIN'] as Role[]).map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </label>

                <label className="block mb-3">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">Trạng thái</span>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as Status)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {(['ACTIVE', 'PENDING_APPROVAL', 'LOCKED', 'DISABLED'] as Status[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </label>

                <label className="block mb-4">
                  <span className="block text-sm font-medium text-gray-700 mb-1.5">Ghi chú (tùy chọn)</span>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Lý do thay đổi..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </label>

                {selected.id === me?.id && selected.role === 'ADMIN' && editRole !== 'ADMIN' && (
                  <p className="text-xs text-amber-600 mb-3">
                    Bạn đang tự hạ quyền của chính mình. Thao tác sẽ bị từ chối nếu bạn là Quản trị viên duy nhất.
                  </p>
                )}

                <div className="flex gap-2">
                  <PrimaryButton onClick={saveRole} disabled={saving}>
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </PrimaryButton>
                  <SecondaryButton type="button" onClick={() => setSelected(null)}>Đóng</SecondaryButton>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div>
          <ErrorBox message={logsError} />
          {!logs ? (
            <p className="text-gray-400">Đang tải...</p>
          ) : logs.length === 0 ? (
            <p className="text-gray-400 text-sm">Chưa có nhật ký phân quyền nào.</p>
          ) : (
            <div className="bg-white rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-left">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Thời gian</th>
                    <th className="px-4 py-2.5 font-medium">Người thực hiện</th>
                    <th className="px-4 py-2.5 font-medium">Tài khoản bị thay đổi</th>
                    <th className="px-4 py-2.5 font-medium">Thay đổi</th>
                    <th className="px-4 py-2.5 font-medium">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l.id} className="border-t align-top">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(l.createdAt)}</td>
                      <td className="px-4 py-3">{l.actor.fullName}</td>
                      <td className="px-4 py-3">{l.target.fullName}</td>
                      <td className="px-4 py-3">
                        {l.roleBefore !== l.roleAfter && (
                          <div>{ROLE_LABEL[l.roleBefore]} → {ROLE_LABEL[l.roleAfter]}</div>
                        )}
                        {l.statusBefore !== l.statusAfter && (
                          <div>{STATUS_LABEL[l.statusBefore]} → {STATUS_LABEL[l.statusAfter]}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{l.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
