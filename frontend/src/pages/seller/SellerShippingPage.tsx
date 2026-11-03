import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getShippingMethods, createShippingMethod, updateShippingMethod, deleteShippingMethod,
  type ShippingMethod,
} from '../../lib/seller-ops';
import { formatVND } from '../../lib/products';
import { getErrorMessage } from '../../lib/api';

const EMPTY = { carrierName: '', serviceName: '', shippingFee: 0, estimatedDays: null as number | null, description: '', status: 'ACTIVE' as const };

// Seller #6 - Quản lý phương thức vận chuyển (ERD 3.3). Người bán tự khai đơn vị/dịch vụ & phí.
export default function SellerShippingPage() {
  const qc = useQueryClient();
  const { data: methods, isLoading } = useQuery({ queryKey: ['shipping-methods'], queryFn: getShippingMethods });
  const [form, setForm] = useState<Partial<ShippingMethod>>(EMPTY);
  const [editId, setEditId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['shipping-methods'] });

  async function save() {
    if (!form.carrierName?.trim()) { alert('Nhập tên đơn vị vận chuyển.'); return; }
    setBusy(true);
    try {
      const body = { ...form, shippingFee: Number(form.shippingFee) || 0, estimatedDays: form.estimatedDays ? Number(form.estimatedDays) : null };
      if (editId) await updateShippingMethod(editId, body); else await createShippingMethod(body);
      setForm(EMPTY); setEditId(null); refresh();
    } catch (e) { alert(getErrorMessage(e)); }
    finally { setBusy(false); }
  }

  async function remove(id: number) {
    if (!confirm('Xoá phương thức vận chuyển này?')) return;
    try { await deleteShippingMethod(id); refresh(); } catch (e) { alert(getErrorMessage(e)); }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-ink mb-1">Phương thức vận chuyển</h1>
      <p className="text-sm text-ink/50 mb-5">Khai báo đơn vị, dịch vụ và phí giao hàng cho gian hàng. Trạng thái giao hàng vẫn cập nhật thủ công ở Đơn hàng.</p>

      <div className="bg-white rounded-xl border border-brand/10 p-4 mb-6 grid sm:grid-cols-2 gap-3">
        <input value={form.carrierName || ''} onChange={(e) => setForm({ ...form, carrierName: e.target.value })} placeholder="Đơn vị vận chuyển *" className="border border-brand/20 rounded-lg px-3 py-2 text-sm" />
        <input value={form.serviceName || ''} onChange={(e) => setForm({ ...form, serviceName: e.target.value })} placeholder="Tên dịch vụ (vd Giao nhanh)" className="border border-brand/20 rounded-lg px-3 py-2 text-sm" />
        <input value={form.shippingFee ?? 0} onChange={(e) => setForm({ ...form, shippingFee: Number(e.target.value.replace(/\D/g, '')) })} placeholder="Phí vận chuyển (đ)" className="border border-brand/20 rounded-lg px-3 py-2 text-sm" />
        <input value={form.estimatedDays ?? ''} onChange={(e) => setForm({ ...form, estimatedDays: e.target.value ? Number(e.target.value.replace(/\D/g, '')) : null })} placeholder="Số ngày dự kiến" className="border border-brand/20 rounded-lg px-3 py-2 text-sm" />
        <input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả (tuỳ chọn)" className="border border-brand/20 rounded-lg px-3 py-2 text-sm sm:col-span-2" />
        <div className="sm:col-span-2 flex gap-2">
          <button onClick={save} disabled={busy} className="bg-brand text-white rounded-lg px-5 py-2 text-sm disabled:opacity-50">{editId ? 'Cập nhật' : 'Thêm phương thức'}</button>
          {editId && <button onClick={() => { setForm(EMPTY); setEditId(null); }} className="border border-brand/20 rounded-lg px-4 py-2 text-sm">Huỷ</button>}
        </div>
      </div>

      {isLoading ? <p className="text-ink/40">Đang tải…</p>
        : !methods || methods.length === 0 ? <p className="text-ink/40 text-center py-12 border border-dashed border-brand/20 rounded-xl">Chưa có phương thức vận chuyển.</p>
          : (
            <div className="space-y-2">
              {methods.map((m) => (
                <div key={m.id} className="bg-white rounded-xl border border-brand/10 p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{m.carrierName}{m.serviceName ? ` · ${m.serviceName}` : ''}
                      <span className={`ml-2 text-[11px] px-2 py-0.5 rounded-full ${m.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{m.status === 'ACTIVE' ? 'Đang dùng' : 'Tạm tắt'}</span>
                    </p>
                    <p className="text-sm text-ink/50">{formatVND(m.shippingFee)}{m.estimatedDays ? ` · ~${m.estimatedDays} ngày` : ''}{m.description ? ` · ${m.description}` : ''}</p>
                  </div>
                  <div className="flex gap-3 text-sm shrink-0">
                    <button onClick={() => { setEditId(m.id); setForm(m); }} className="text-brand hover:underline">Sửa</button>
                    <button onClick={() => remove(m.id)} className="text-red-500 hover:underline">Xoá</button>
                  </div>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}
