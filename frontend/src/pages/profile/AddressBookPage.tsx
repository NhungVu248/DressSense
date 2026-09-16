import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { Field, PrimaryButton, SecondaryButton, ErrorBox, SuccessBox } from '../../components/ui';

interface Address {
  id: number; recipientName: string; phone: string;
  province: string; district: string; ward: string; detail: string; isDefault: boolean;
}

const emptyForm = { recipientName: '', phone: '', province: '', district: '', ward: '', detail: '' };

// UC1.6 - Quản lý sổ địa chỉ
export default function AddressBookPage() {
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof emptyForm) => (e: any) => setForm({ ...form, [k]: e.target.value });

  function load() {
    api.get('/addresses').then((res) => setAddresses(res.data.addresses)).catch((err) => setError(getErrorMessage(err)));
  }
  useEffect(load, []);

  function openCreate() {
    setEditingId(null); setForm(emptyForm); setShowForm(true); setError(''); setSuccess('');
  }
  function openEdit(a: Address) {
    setEditingId(a.id);
    setForm({ recipientName: a.recipientName, phone: a.phone, province: a.province, district: a.district, ward: a.ward, detail: a.detail });
    setShowForm(true); setError(''); setSuccess('');
  }

  // Bước 4-9 (thêm mới) / luồng 4a (chỉnh sửa)
  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/addresses/${editingId}`, form);
        setSuccess('Cập nhật địa chỉ thành công');
      } else {
        await api.post('/addresses', form);
        setSuccess('Thêm địa chỉ thành công');
      }
      setShowForm(false);
      load();
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setSaving(false); }
  }

  // Luồng 4b: xóa (có xác nhận)
  async function remove(a: Address) {
    if (!confirm(`Xóa địa chỉ của ${a.recipientName}?`)) return;
    setError('');
    try {
      const res = await api.delete(`/addresses/${a.id}`);
      setAddresses(res.data.addresses);
      setSuccess('Xóa địa chỉ thành công');
    } catch (err) { setError(getErrorMessage(err)); }
  }

  // Luồng 4c: đặt mặc định
  async function setDefault(a: Address) {
    setError('');
    try {
      const res = await api.post(`/addresses/${a.id}/default`);
      setAddresses(res.data.addresses);
    } catch (err) { setError(getErrorMessage(err)); }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link to="/profile" className="text-sm text-gray-400 hover:text-gray-600">← Hồ sơ cá nhân</Link>
      <div className="flex items-center justify-between mt-2 mb-6">
        <h1 className="text-2xl font-bold">Sổ địa chỉ</h1>
        {!showForm && <PrimaryButton style={{ width: 'auto' }} onClick={openCreate}>+ Thêm địa chỉ mới</PrimaryButton>}
      </div>

      <ErrorBox message={error} />
      <SuccessBox message={success} />

      {showForm && (
        <form onSubmit={submitForm} className="bg-white rounded-xl border p-6 mb-5">
          <h3 className="font-medium mb-4">{editingId ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}</h3>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Họ tên người nhận" value={form.recipientName} onChange={set('recipientName')} required />
            <Field label="Số điện thoại" value={form.phone} onChange={set('phone')} required />
            <Field label="Tỉnh/Thành" value={form.province} onChange={set('province')} required />
            <Field label="Quận/Huyện" value={form.district} onChange={set('district')} required />
            <Field label="Phường/Xã" value={form.ward} onChange={set('ward')} required />
          </div>
          <Field label="Địa chỉ chi tiết" value={form.detail} onChange={set('detail')} required placeholder="Số nhà, tên đường..." />
          <div className="flex gap-2">
            <PrimaryButton type="submit" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu địa chỉ'}</PrimaryButton>
            <SecondaryButton type="button" onClick={() => setShowForm(false)}>Hủy</SecondaryButton>
          </div>
        </form>
      )}

      {!addresses ? (
        <p className="text-gray-400">Đang tải...</p>
      ) : addresses.length === 0 ? (
        <p className="text-gray-400 text-sm">Chưa có địa chỉ nào. Thêm địa chỉ đầu tiên sẽ tự động làm mặc định.</p>
      ) : (
        <div className="space-y-3">
          {addresses.map((a) => (
            <div key={a.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{a.recipientName}</span>
                    <span className="text-gray-400 text-sm">{a.phone}</span>
                    {a.isDefault && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Mặc định</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{a.detail}, {a.ward}, {a.district}, {a.province}</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-sm whitespace-nowrap">
                  {!a.isDefault && <button onClick={() => setDefault(a)} className="text-indigo-600 hover:underline">Đặt mặc định</button>}
                  <button onClick={() => openEdit(a)} className="text-gray-500 hover:underline">Sửa</button>
                  <button onClick={() => remove(a)} className="text-red-500 hover:underline">Xóa</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
