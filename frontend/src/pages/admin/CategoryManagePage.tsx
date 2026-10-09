import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../../lib/api';
import { ErrorBox, SuccessBox, PrimaryButton, SecondaryButton } from '../../components/ui';

// UC6.2 - Quản lý cây danh mục đa cấp (chỉ Quản trị viên)

interface Cat { id: number; name: string; parentId: number | null; active: boolean; sortOrder: number; productCount: number; childCount: number; referenced: number }

export default function CategoryManagePage() {
  const [items, setItems] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newName, setNewName] = useState('');
  const [newParent, setNewParent] = useState('');
  const [edit, setEdit] = useState<Cat | null>(null);

  function load() {
    setLoading(true);
    api.get('/admin/categories').then((r) => setItems(r.data.items)).catch((e) => setError(getErrorMessage(e))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function add() {
    if (!newName.trim()) return;
    setError(''); setSuccess('');
    try {
      await api.post('/admin/categories', { name: newName.trim(), parentId: newParent ? Number(newParent) : undefined });
      setSuccess('Đã thêm danh mục.'); setNewName(''); setNewParent(''); load();
    } catch (e) { setError(getErrorMessage(e)); } // 6E trùng/độ sâu
  }

  async function toggleActive(c: Cat) {
    try { await api.patch(`/admin/categories/${c.id}`, { active: !c.active }); load(); }
    catch (e) { setError(getErrorMessage(e)); }
  }

  async function remove(c: Cat) {
    if (!confirm(`Xóa danh mục "${c.name}"?`)) return;
    setError(''); setSuccess('');
    try { await api.delete(`/admin/categories/${c.id}`); setSuccess('Đã xóa danh mục.'); load(); }
    catch (e) { setError(getErrorMessage(e)); } // 6F - đang tham chiếu
  }

  // Dựng cây từ danh sách phẳng
  const byParent = new Map<number | null, Cat[]>();
  for (const c of items) { const k = c.parentId; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k)!.push(c); }
  const renderNodes = (parentId: number | null, depth: number): React.ReactNode =>
    (byParent.get(parentId) ?? []).map((c) => (
      <div key={c.id}>
        <div className="flex items-center gap-2 py-1.5 border-b" style={{ paddingLeft: depth * 20 }}>
          <span className="text-gray-300">{depth > 0 ? '└' : ''}</span>
          <span className={`font-medium ${!c.active ? 'text-gray-400 line-through' : ''}`}>{c.name}</span>
          {!c.active && <span className="text-xs bg-gray-200 text-gray-500 rounded-full px-2">ẩn</span>}
          <span className="text-xs text-gray-400">({c.productCount} SP{c.childCount ? `, ${c.childCount} con` : ''})</span>
          <div className="ml-auto flex gap-2 text-xs">
            <button onClick={() => setEdit(c)} className="text-indigo-600 hover:underline">Sửa</button>
            <button onClick={() => toggleActive(c)} className="text-amber-600 hover:underline">{c.active ? 'Ẩn' : 'Hiện'}</button>
            <button onClick={() => remove(c)} className="text-red-500 hover:underline">Xóa</button>
          </div>
        </div>
        {renderNodes(c.id, depth + 1)}
      </div>
    ));

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/admin" className="text-sm text-gray-400 hover:text-gray-600">← Quản trị</Link>
      <h1 className="text-2xl font-bold mt-2 mb-1">Quản lý danh mục</h1>
      <p className="text-sm text-gray-500 mb-4">Cây danh mục đa cấp dùng chung toàn sàn. Không xóa cứng danh mục đang có sản phẩm/con — hãy ẩn hoặc di chuyển.</p>
      <ErrorBox message={error} />
      <SuccessBox message={success} />

      <div className="bg-white border rounded-xl p-4 mb-4 flex gap-2 flex-wrap items-end">
        <label className="flex-1 min-w-[160px]">
          <span className="block text-xs text-gray-500 mb-1">Tên danh mục mới</span>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </label>
        <label>
          <span className="block text-xs text-gray-500 mb-1">Danh mục cha</span>
          <select value={newParent} onChange={(e) => setNewParent(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">(Gốc)</option>
            {items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <PrimaryButton style={{ width: 'auto' }} onClick={add}>+ Thêm</PrimaryButton>
      </div>

      {loading ? <p className="text-gray-400">Đang tải...</p> : (
        <div className="bg-white border rounded-xl px-4 py-2">{renderNodes(null, 0)}</div>
      )}

      {edit && <EditCategoryModal cat={edit} all={items} onClose={(changed) => { setEdit(null); if (changed) load(); }} onError={setError} />}
    </div>
  );
}

function EditCategoryModal({ cat, all, onClose, onError }: { cat: Cat; all: Cat[]; onClose: (c: boolean) => void; onError: (m: string) => void }) {
  const [name, setName] = useState(cat.name);
  const [parentId, setParentId] = useState<string>(cat.parentId == null ? '' : String(cat.parentId));
  const [sortOrder, setSortOrder] = useState(String(cat.sortOrder));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/admin/categories/${cat.id}`, {
        name, sortOrder: Number(sortOrder),
        parentId: parentId === '' ? null : Number(parentId),
      });
      onClose(true);
    } catch (e) { onError(getErrorMessage(e)); setSaving(false); } // 6E vòng lặp/trùng/độ sâu
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => onClose(false)}>
      <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold">Sửa danh mục</h3>
        <label className="block"><span className="block text-xs text-gray-500 mb-1">Tên</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></label>
        <label className="block"><span className="block text-xs text-gray-500 mb-1">Danh mục cha (di chuyển)</span>
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">(Gốc)</option>
            {all.filter((c) => c.id !== cat.id).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>
        <label className="block"><span className="block text-xs text-gray-500 mb-1">Thứ tự</span>
          <input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" /></label>
        <div className="flex gap-2 justify-end">
          <SecondaryButton type="button" onClick={() => onClose(false)}>Hủy</SecondaryButton>
          <PrimaryButton style={{ width: 'auto' }} onClick={save} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu'}</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
