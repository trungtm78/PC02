import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  FolderTree,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Save,
  AlertTriangle,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Directory = {
  id: string;
  type: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormData = {
  type: string;
  code: string;
  name: string;
  description: string;
  parentId: string;
  order: number;
  isActive: boolean;
};

// Labels for all known directory types — unknown types fall back to their key
const DIRECTORY_TYPE_LABELS: Record<string, string> = {
  WARD:               'Phường/Xã',
  PROVINCE:           'Tỉnh/Thành phố',
  DISTRICT:           'Quận/Huyện (cũ)',
  UNIT:               'Đơn vị công an',
  CRIME:              'Tội danh (BLHS)',
  INCIDENT_TYPE:      'Loại vụ việc',
  INCIDENT_LEVEL:     'Mức độ nghiêm trọng',
  CASE_CLASSIFICATION:'Phân loại vụ án',
  TDC_SOURCE:         'Nguồn tin TĐC',
  TDC_CASE_TYPE:      'Loại vụ TĐC',
  PROSECUTION_OFFICE: 'Viện kiểm sát',
  PRIORITY:           'Mức độ ưu tiên',
  PETITION_TYPE:      'Loại đơn thư',
  DOCUMENT_TYPE:      'Loại tài liệu',
  EVIDENCE_TYPE:      'Loại vật chứng',
  OCCUPATION:         'Ngành nghề',
  NATIONALITY:        'Quốc tịch',
  GENDER:             'Giới tính',
  AGE_GROUP:          'Nhóm tuổi',
  EDUCATION_LEVEL:    'Trình độ học vấn',
  ORG:                'Tổ chức/Đơn vị',
  // Legacy types still in DB
  LOCATION:           'Địa bàn (cũ)',
  STATUS:             'Trạng thái (cũ)',
};

const EMPTY_FORM: FormData = {
  type: 'CRIME',
  code: '',
  name: '',
  description: '',
  parentId: '',
  order: 0,
  isActive: true,
};

// ─── Component ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function DirectoriesPage() {
  const [activeType, setActiveType] = useState('CRIME');
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [items, setItems] = useState<Directory[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Directory | null>(null);
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM, type: activeType });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Directory | null>(null);

  // ─── Hierarchy drill-down (PROVINCE → WARD children) ───────────────────────
  const [drillParentId, setDrillParentId] = useState<string | null>(null);
  const [drillParentName, setDrillParentName] = useState<string>('');

  // ─── Load available types from API ─────────────────────────────────────────
  useEffect(() => {
    api.get('/directories/types')
      .then((res) => {
        const types: string[] = res.data ?? [];
        // Sort: priority types first, then alphabetical
        const priority = ['WARD', 'PROVINCE', 'CRIME', 'INCIDENT_TYPE', 'PETITION_TYPE', 'PRIORITY', 'UNIT'];
        const sorted = [
          ...priority.filter(t => types.includes(t)),
          ...types.filter(t => !priority.includes(t)).sort(),
        ];
        setAvailableTypes(sorted);
        if (sorted.length > 0 && !sorted.includes(activeType)) {
          setActiveType(sorted[0]);
        }
      })
      .catch(() => {
        // Fallback to static list if API unavailable
        setAvailableTypes(['CRIME', 'ORG', 'LOCATION', 'STATUS']);
      })
      .finally(() => setTypesLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (currentPage - 1) * PAGE_SIZE;
      const params: Record<string, string | number> = { type: activeType, limit: PAGE_SIZE, offset };
      if (searchQuery) params.search = searchQuery;
      if (filterStatus !== 'all') params.isActive = filterStatus === 'active' ? 'true' : 'false';
      if (drillParentId) params.parentId = drillParentId;
      const res = await api.get('/directories', { params });
      setItems(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [activeType, searchQuery, filterStatus, currentPage, drillParentId]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({ ...EMPTY_FORM, type: activeType });
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: Directory) => {
    setEditingItem(item);
    setFormData({
      type: item.type,
      code: item.code,
      name: item.name,
      description: item.description ?? '',
      parentId: item.parentId ?? '',
      order: item.order,
      isActive: item.isActive,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.name) {
      setFormError('Vui lòng điền Mã danh mục và Tên danh mục.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        type: formData.type,
        code: formData.code.toUpperCase(),
        name: formData.name,
        description: formData.description || undefined,
        parentId: formData.parentId || undefined,
        order: formData.order,
        isActive: formData.isActive,
      };
      if (editingItem) {
        await api.patch(`/directories/${editingItem.id}`, payload);
      } else {
        await api.post('/directories', payload);
      }
      setShowModal(false);
      void loadItems();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Có lỗi xảy ra. Vui lòng thử lại.';
      setFormError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;
    try {
      await api.delete(`/directories/${deletingItem.id}`);
      setShowDeleteConfirm(false);
      setDeletingItem(null);
      void loadItems();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Không thể xóa danh mục.';
      alert(msg);
    }
  };

  const handleSeedSample = async () => {
    if (!window.confirm('Seed dữ liệu mẫu cho tất cả loại danh mục?')) return;
    try {
      await api.post('/directories/seed');
      void loadItems();
    } catch {
      alert('Lỗi khi seed dữ liệu.');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div data-testid="directories-page" className="p-6">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
          <Database className="w-4 h-4" />
          <span>Hệ thống</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-800 font-medium">Danh mục</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#003973] mb-1">Quản lý danh mục</h1>
            <p className="text-slate-600">
              Quản lý các danh mục nghiệp vụ dùng cho hệ thống
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSeedSample}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
            >
              Seed dữ liệu mẫu
            </button>
            <button
              onClick={handleOpenAdd}
              data-testid="btn-add-directory"
              className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Thêm danh mục
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        {/* Left: Type selector */}
        <div className="col-span-1">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Database className="w-4 h-4 text-[#003973]" />
                Loại danh mục
              </h3>
            </div>
            <div className="divide-y divide-slate-200">
              {typesLoading ? (
                <div className="p-4 text-slate-400 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang tải...
                </div>
              ) : availableTypes.map((typeId) => {
                const active = activeType === typeId;
                const label = DIRECTORY_TYPE_LABELS[typeId] ?? typeId;
                const isLegacy = typeId === 'DISTRICT' || typeId === 'LOCATION' || typeId === 'STATUS';
                return (
                  <button
                    key={typeId}
                    onClick={() => {
                      setActiveType(typeId);
                      setSearchQuery('');
                      setFilterStatus('all');
                      setCurrentPage(1);
                      setDrillParentId(null);
                      setDrillParentName('');
                    }}
                    className={`w-full text-left p-4 border-l-4 transition-all ${
                      active
                        ? 'bg-[#003973]/5 border-[#003973]'
                        : 'border-transparent hover:bg-slate-50'
                    } ${isLegacy ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <FolderTree
                        className={`w-5 h-5 ${active ? 'text-[#003973]' : 'text-slate-500'}`}
                      />
                      <div>
                        <div
                          className={`font-semibold text-sm ${
                            active ? 'text-[#003973]' : 'text-slate-800'
                          }`}
                        >
                          {label}
                        </div>
                        {active && (
                          <div className="text-xs text-slate-500 mt-0.5">{total} mục</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Table */}
        <div className="col-span-3">
          <div className="bg-white rounded-lg border border-slate-200">
            {/* Breadcrumb when drilling into province wards */}
            {drillParentId && (
              <div className="px-4 py-2 border-b border-blue-100 bg-blue-50 flex items-center gap-2 text-sm">
                <button
                  onClick={() => {
                    setDrillParentId(null);
                    setDrillParentName('');
                    setActiveType('PROVINCE');
                    setCurrentPage(1);
                  }}
                  className="text-blue-600 hover:underline flex items-center gap-1"
                >
                  ← Tỉnh/Thành phố
                </button>
                <span className="text-slate-400">›</span>
                <span className="font-medium text-slate-800">{drillParentName}</span>
                <span className="text-slate-500 ml-auto text-xs">{total.toLocaleString('vi-VN')} phường/xã</span>
              </div>
            )}

            {/* Filters */}
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo mã hoặc tên..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-500" />
                  <select
                    value={filterStatus}
                    onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                    className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                  >
                    <option value="all">Tất cả</option>
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Vô hiệu</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Mã', 'Tên danh mục', 'Mô tả', 'Thứ tự', 'Trạng thái', 'Thao tác'].map(
                      (h) => (
                        <th
                          key={h}
                          className="text-left py-3 px-4 font-semibold text-slate-700 text-sm"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#003973] mx-auto mb-2" />
                        <p className="text-slate-600">Đang tải dữ liệu...</p>
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <FolderTree className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                        <p className="text-slate-600 font-medium mb-1">Chưa có danh mục nào</p>
                        <p className="text-sm text-slate-500">
                          Nhấn "Thêm danh mục" hoặc "Seed dữ liệu mẫu"
                        </p>
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono text-sm font-medium text-[#003973]">
                            {item.code}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800 text-sm">{item.name}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-sm text-slate-600 line-clamp-1 max-w-xs">
                            {item.description ?? '—'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 text-sm text-center">
                          {item.order}
                        </td>
                        <td className="py-3 px-4">
                          {item.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                              <XCircle className="w-3 h-3" />
                              Vô hiệu
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {/* Drill-down button: visible only for PROVINCE type */}
                            {activeType === 'PROVINCE' && !drillParentId && (
                              <button
                                onClick={() => {
                                  setDrillParentId(item.id);
                                  setDrillParentName(item.name);
                                  setActiveType('WARD');
                                  setCurrentPage(1);
                                  setSearchQuery('');
                                }}
                                className="px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
                                title="Xem phường/xã của tỉnh này"
                                data-testid="btn-drill-down"
                              >
                                Xem phường/xã →
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="w-4 h-4 text-slate-600" />
                            </button>
                            <button
                              onClick={() => {
                                setDeletingItem(item);
                                setShowDeleteConfirm(true);
                              }}
                              className="p-1.5 hover:bg-red-50 rounded transition-colors"
                              title="Xóa"
                              data-testid="btn-delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {!loading && total > 0 && (
              <div className="p-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
                <span>
                  Hiển thị{' '}
                  <span className="font-medium">{(currentPage - 1) * PAGE_SIZE + 1}</span>–
                  <span className="font-medium">{Math.min(currentPage * PAGE_SIZE, total)}</span>{' '}
                  trong tổng số <span className="font-medium">{total.toLocaleString('vi-VN')}</span> mục
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 text-xs font-medium"
                  >
                    ← Trước
                  </button>
                  <span className="text-xs text-slate-500">
                    Trang {currentPage}/{Math.ceil(total / PAGE_SIZE)}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(total / PAGE_SIZE), p + 1))}
                    disabled={currentPage >= Math.ceil(total / PAGE_SIZE)}
                    className="px-3 py-1.5 rounded border border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 text-xs font-medium"
                  >
                    Sau →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add/Edit Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-slate-800">
                {editingItem ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Loại danh mục <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  disabled={!!editingItem}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm disabled:bg-slate-50"
                >
                  {availableTypes.map((typeId) => (
                    <option key={typeId} value={typeId}>
                      {DIRECTORY_TYPE_LABELS[typeId] ?? typeId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dir-field-code" className="block text-sm font-medium text-slate-700 mb-1">
                    Mã danh mục <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="dir-field-code"
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="VD: TH001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="dir-field-order" className="block text-sm font-medium text-slate-700 mb-1">
                    Thứ tự hiển thị
                  </label>
                  <input
                    id="dir-field-order"
                    type="number"
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                    min="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="dir-field-name" className="block text-sm font-medium text-slate-700 mb-1">
                  Tên danh mục <span className="text-red-600">*</span>
                </label>
                <input
                  id="dir-field-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nhập tên danh mục"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Nhập mô tả chi tiết"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Trạng thái
                </label>
                <select
                  value={formData.isActive ? 'active' : 'inactive'}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.value === 'active' })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                >
                  <option value="active">Hoạt động</option>
                  <option value="inactive">Vô hiệu hóa</option>
                </select>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.code || !formData.name}
                className="flex-1 px-4 py-2 bg-[#003973] text-white rounded-lg hover:bg-[#002a5c] transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingItem ? 'Cập nhật' : 'Thêm mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {showDeleteConfirm && deletingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 text-center mb-2">
                Xác nhận xóa danh mục
              </h3>
              <p className="text-slate-600 text-center mb-6">
                Bạn có chắc chắn muốn xóa danh mục{' '}
                <strong>{deletingItem.name}</strong> ({deletingItem.code})?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingItem(null);
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors text-sm"
                >
                  Hủy
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
