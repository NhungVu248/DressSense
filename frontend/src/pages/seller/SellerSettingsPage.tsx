import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getMe, updateMe, changePassword, setMyShopStatus, lockMyAccount } from '../../lib/account';
import { getMyShop } from '../../lib/shop';
import { getErrorMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

// Cài đặt người bán - trang riêng (không dùng form trang khách), chia tab.
type Tab = 'profile' | 'password' | 'security';

export default function SellerSettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const tabs: [Tab, string][] = [['profile', 'Thông tin cá nhân'], ['password', 'Đổi mật khẩu'], ['security', 'Khóa tài khoản & gian hàng']];
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="font-display text-3xl text-ink mb-5">Cài đặt tài khoản</h1>
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`text-sm px-4 py-1.5 rounded-full border ${tab === k ? 'border-brand bg-brand text-white' : 'border-black/10 text-gray-600'}`}>{label}</button>
        ))}
      </div>
      {tab === 'profile' && <ProfileTab />}
      {tab === 'password' && <PasswordTab />}
      {tab === 'security' && <SecurityTab />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="block text-xs text-gray-500 mb-1">{label}</span>{children}</label>;
}
const inputCls = 'w-full border border-black/10 rounded-lg px-3 py-2 text-sm';

function ProfileTab() {
  const { data: me } = useQuery({ queryKey: ['me-profile'], queryFn: getMe });
  const [f, setF] = useState({ fullName: '', phone: '', gender: '', dateOfBirth: '', idNumber: '', address: '', bio: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const hadPhone = !!me?.phone;

  useEffect(() => {
    if (me) setF({
      fullName: me.fullName ?? '', phone: me.phone ?? '', gender: me.gender ?? '',
      dateOfBirth: me.dateOfBirth ? me.dateOfBirth.slice(0, 10) : '', idNumber: me.idNumber ?? '',
      address: me.address ?? '', bio: me.bio ?? '',
    });
  }, [me]);

  async function save() {
    setBusy(true); setMsg('');
    try {
      await updateMe({
        fullName: f.fullName.trim(), gender: f.gender || null, dateOfBirth: f.dateOfBirth || null,
        idNumber: f.idNumber.trim() || null, address: f.address.trim() || null, bio: f.bio.trim() || null,
        ...(!hadPhone && f.phone.trim() ? { phone: f.phone.trim() } : {}),
      });
      setMsg('Đã lưu thông tin cá nhân.');
    } catch (e) { setMsg(getErrorMessage(e)); } finally { setBusy(false); }
  }

  if (!me) return <p className="text-gray-400 text-sm">Đang tải…</p>;
  return (
    <div className="bg-white border border-black/5 rounded-xl p-5 space-y-3">
      <Field label="Họ tên"><input value={f.fullName} onChange={(e) => set('fullName', e.target.value)} className={inputCls} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><input value={me.email ?? ''} disabled className={`${inputCls} bg-gray-50 text-gray-400`} /></Field>
        <Field label={hadPhone ? 'Số điện thoại' : 'Số điện thoại (khai báo lần đầu)'}>
          <input value={f.phone} onChange={(e) => set('phone', e.target.value)} disabled={hadPhone} className={`${inputCls} ${hadPhone ? 'bg-gray-50 text-gray-400' : ''}`} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Giới tính">
          <select value={f.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls}>
            <option value="">—</option><option>Nam</option><option>Nữ</option><option>Khác</option>
          </select>
        </Field>
        <Field label="Ngày sinh"><input type="date" value={f.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} className={inputCls} /></Field>
      </div>
      <Field label="CCCD / CMND"><input value={f.idNumber} onChange={(e) => set('idNumber', e.target.value)} className={inputCls} placeholder="Số căn cước công dân" /></Field>
      <Field label="Địa chỉ"><input value={f.address} onChange={(e) => set('address', e.target.value)} className={inputCls} placeholder="Địa chỉ liên hệ" /></Field>
      <Field label="Giới thiệu"><textarea value={f.bio} onChange={(e) => set('bio', e.target.value)} rows={2} className={inputCls} /></Field>
      {msg && <p className="text-sm text-brand">{msg}</p>}
      <button onClick={save} disabled={busy} className="bg-brand text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
    </div>
  );
}

function PasswordTab() {
  const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [cf, setCf] = useState('');
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [ok, setOk] = useState(false);
  async function submit() {
    if (!cur || !nw) { setMsg('Vui lòng nhập đủ mật khẩu.'); return; }
    if (nw !== cf) { setMsg('Mật khẩu xác nhận không khớp.'); return; }
    setBusy(true); setMsg('');
    try { await changePassword({ currentPassword: cur, newPassword: nw, confirmPassword: cf }); setOk(true); setMsg('Đã đổi mật khẩu thành công.'); setCur(''); setNw(''); setCf(''); }
    catch (e) { setOk(false); setMsg(getErrorMessage(e)); } finally { setBusy(false); }
  }
  return (
    <div className="bg-white border border-black/5 rounded-xl p-5 space-y-3 max-w-md">
      <Field label="Mật khẩu hiện tại"><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} className={inputCls} /></Field>
      <Field label="Mật khẩu mới"><input type="password" value={nw} onChange={(e) => setNw(e.target.value)} className={inputCls} /></Field>
      <Field label="Xác nhận mật khẩu mới"><input type="password" value={cf} onChange={(e) => setCf(e.target.value)} className={inputCls} /></Field>
      {msg && <p className={`text-sm ${ok ? 'text-green-600' : 'text-red-500'}`}>{msg}</p>}
      <button onClick={submit} disabled={busy} className="bg-brand text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50">{busy ? 'Đang đổi…' : 'Đổi mật khẩu'}</button>
    </div>
  );
}

function SecurityTab() {
  const nav = useNavigate();
  const { logout } = useAuth();
  const { data: shop, refetch } = useQuery({ queryKey: ['my-shop'], queryFn: getMyShop });
  const [busy, setBusy] = useState(false);

  async function shopStatus(action: 'suspend' | 'reopen') {
    const warn = action === 'suspend' ? 'Tạm ngưng gian hàng? Sản phẩm sẽ ẩn khỏi khách cho tới khi bạn mở lại.' : 'Mở lại gian hàng?';
    if (!confirm(warn)) return;
    setBusy(true);
    try { const r = await setMyShopStatus(action); alert(r.message); refetch(); }
    catch (e) { alert(getErrorMessage(e)); } finally { setBusy(false); }
  }
  async function lockAccount(mode: 'temporary' | 'permanent') {
    const warn = mode === 'permanent'
      ? 'ĐÓNG VĨNH VIỄN tài khoản? Bạn sẽ bị đăng xuất và chỉ quản trị viên mới khôi phục được. Hành động này rất khó hoàn tác.'
      : 'Khóa tạm thời tài khoản? Bạn sẽ bị đăng xuất; liên hệ quản trị viên để mở lại.';
    if (!confirm(warn)) return;
    if (mode === 'permanent' && !confirm('Xác nhận lần cuối: đóng vĩnh viễn tài khoản?')) return;
    setBusy(true);
    try {
      const r = await lockMyAccount(mode);
      alert(r.message);
      logout();
      nav('/seller/login');
    } catch (e) { alert(getErrorMessage(e)); setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-black/5 rounded-xl p-5">
        <h3 className="font-medium text-ink mb-1">Gian hàng</h3>
        <p className="text-sm text-gray-500 mb-3">Trạng thái hiện tại: <b>{shop?.status ?? '—'}</b></p>
        {shop?.status === 'ACTIVE' && <button onClick={() => shopStatus('suspend')} disabled={busy} className="border border-amber-300 text-amber-700 rounded-lg px-4 py-2 text-sm">Tạm ngưng gian hàng</button>}
        {shop?.status === 'SUSPENDED' && <button onClick={() => shopStatus('reopen')} disabled={busy} className="bg-brand text-white rounded-lg px-4 py-2 text-sm">Mở lại gian hàng</button>}
        {shop && shop.status !== 'ACTIVE' && shop.status !== 'SUSPENDED' && <p className="text-xs text-gray-400">Chỉ tạm ngưng/mở lại được khi gian hàng đang hoạt động.</p>}
      </div>

      <div className="bg-white border border-red-200 rounded-xl p-5">
        <h3 className="font-medium text-red-600 mb-1">Khóa tài khoản</h3>
        <p className="text-sm text-gray-500 mb-3">Sau khi khóa, bạn sẽ bị đăng xuất. Khóa tạm thời có thể nhờ quản trị viên mở lại; đóng vĩnh viễn là đóng tài khoản.</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => lockAccount('temporary')} disabled={busy} className="border border-red-300 text-red-600 rounded-lg px-4 py-2 text-sm">Khóa tạm thời</button>
          <button onClick={() => lockAccount('permanent')} disabled={busy} className="bg-red-600 text-white rounded-lg px-4 py-2 text-sm">Đóng vĩnh viễn</button>
        </div>
      </div>
    </div>
  );
}
