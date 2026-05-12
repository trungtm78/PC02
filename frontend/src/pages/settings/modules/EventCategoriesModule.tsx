import { useState, useEffect, useCallback } from 'react';
import { Tag, Plus, Edit2, Trash2, X, Save, Loader2, Lock } from 'lucide-react';
import { eventCategoriesApi, type EventCategory, type CreateCategoryPayload } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';

const COLOR_PRESETS = ['#dc2626', '#1e40af', '#15803d', '#ea580c', '#7c3aed', '#0891b2', '#db2777', '#64748b'];

interface FormData {
  slug: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
}

const EMPTY_FORM: FormData = {
  slug: '',
  name: '',
  color: '#003973',
  icon: '',
  sortOrder: 100,
};

const SLUG_REGEX = /^[a-z0-9_-]+$/;
const HEX_REGEX = /^#[0-9a-fA-F]{6}$/;

export function EventCategoriesModule() {
  const { canEdit } = usePermission();
  const canEditRow = canEdit('settings');

  const [items, setItems] = useState<EventCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EventCategory | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await eventCategoriesApi.list();
      setItems(res.data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const handleOpenAdd = () => {
    setEditing(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: EventCategory) => {
    setEditing(item);
    setFormData({
      slug: item.slug,
      name: item.name,
      color: item.color,
      icon: item.icon ?? '',
      sortOrder: item.sortOrder,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setFormError('Tên danh mục không được để trống');
      return;
    }
    if (!HEX_REGEX.test(formData.color)) {
      setFormError('Màu phải là hex format #RRGGBB');
      return;
    }
    if (!editing && !SLUG_REGEX.test(formData.slug)) {
      setFormError('Slug chỉ chứa chữ thường, số, gạch dưới, gạch ngang');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        // Slug + isSystem stripped server-side; only mutable fields sent.
        await eventCategoriesApi.update(editing.id, {
          name: formData.name,
          color: formData.color,
          icon: formData.icon || undefined,
          sortOrder: formData.sortOrder,
        });
      } else {
        const payload: CreateCategoryPayload = {
          slug: formData.slug,
          name: formData.name,
          color: formData.color,
          sortOrder: formData.sortOrder,
        };
        if (formData.icon) payload.icon = formData.icon;
        await eventCategoriesApi.create(payload);
      }
      setShowModal(false);
      void loadItems();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'Lỗi khi lưu danh mục');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: EventCategory) => {
    if (item.isSystem) return;
    if (!confirm(`Xóa danh mục "${item.name}"?`)) return;
    try {
      await eventCategoriesApi.remove(item.id);
      void loadItems();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không xóa được';
      alert(msg);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Danh mục sự kiện</h2>
          <p className="text-sm text-slate-500 mt-0.5">Phân loại sự kiện calendar — admin tự thêm/sửa danh mục với màu riêng</p>
        </div>
        {canEditRow && (
          <button onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#003973] text-white rounded-lg hover:bg-[#003973]/90">
            <Plus className="w-4 h-4" />Thêm danh mục
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm w-12"></th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Tên</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Slug</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Loại</th>
              <th className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">Thứ tự</th>
              <th className="text-right py-3 px-4 font-semibold text-slate-700 text-sm">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Đang tải...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">Chưa có danh mục</td></tr>
            ) : items.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="py-3 px-4">
                  <div className="w-6 h-6 rounded" style={{ backgroundColor: item.color }} aria-label={`Màu ${item.color}`} />
                </td>
                <td className="py-3 px-4 font-medium text-slate-800">{item.name}</td>
                <td className="py-3 px-4 font-mono text-sm text-slate-600">{item.slug}</td>
                <td className="py-3 px-4">
                  {item.isSystem ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                      <Lock className="w-3 h-3" />Hệ thống
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">Tùy chỉnh</span>
                  )}
                </td>
                <td className="py-3 px-4 text-sm text-slate-600">{item.sortOrder}</td>
                <td className="py-3 px-4">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => handleOpenEdit(item)} className="p-1.5 hover:bg-slate-100 rounded" aria-label="Sửa">
                      <Edit2 className="w-4 h-4 text-slate-600" />
                    </button>
                    {!item.isSystem && (
                      <button onClick={() => handleDelete(item)} className="p-1.5 hover:bg-red-50 rounded" aria-label="Xóa">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                {editing ? 'Sửa danh mục' : 'Thêm danh mục mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{formError}</div>
              )}
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Slug <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={formData.slug}
                    onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                    placeholder="vd: training, unit-internal"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003973] focus:outline-none font-mono"
                  />
                  <p className="text-xs text-slate-500 mt-1">Chỉ chữ thường, số, gạch dưới/ngang. Không sửa được sau khi tạo.</p>
                </div>
              )}
              {editing?.isSystem && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Danh mục hệ thống — chỉ sửa được tên + màu + thứ tự
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tên hiển thị <span className="text-red-500">*</span>
                </label>
                <input
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="vd: Tập huấn nội bộ"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003973] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Màu</label>
                <div className="flex items-center gap-2 mb-2">
                  {COLOR_PRESETS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: c })}
                      className="w-8 h-8 rounded-full ring-2 ring-offset-2 transition-all"
                      style={{ backgroundColor: c, ringColor: formData.color === c ? '#003973' : 'transparent' } as React.CSSProperties}
                      aria-label={`Chọn màu ${c}`}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={formData.color}
                  onChange={e => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 border border-slate-300 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Thứ tự hiển thị</label>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  value={formData.sortOrder}
                  onChange={e => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003973] focus:outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Số nhỏ hơn hiện trước. Mặc định 100.</p>
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Hủy</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-[#003973] text-white rounded-lg hover:bg-[#003973]/90 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
