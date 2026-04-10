import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { MASTER_CLASS_TYPE_LIST } from "@/constants/master-class-types";
import { Search, Plus, Pencil, Trash2, FolderTree, Save, X } from "lucide-react";

interface MasterClassEntry {
  id: string;
  type: string;
  code: string;
  name: string;
  order: number;
  isActive: boolean;
}

interface FormData {
  code: string;
  name: string;
  order: number;
}

const INITIAL_FORM: FormData = { code: "", name: "", order: 0 };

export default function MasterClassPage() {
  const [selectedType, setSelectedType] = useState(MASTER_CLASS_TYPE_LIST[0].code);
  const [entries, setEntries] = useState<MasterClassEntry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const selectedTypeName = MASTER_CLASS_TYPE_LIST.find(t => t.code === selectedType)?.name ?? "";

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/master-classes?type=${selectedType}&limit=500`);
      setEntries(res.data?.data ?? []);
    } catch { setEntries([]); }
    setLoading(false);
  }, [selectedType]);

  const fetchCounts = useCallback(async () => {
    const c: Record<string, number> = {};
    for (const t of MASTER_CLASS_TYPE_LIST) {
      try {
        const res = await api.get(`/master-classes?type=${t.code}&limit=1`);
        c[t.code] = res.data?.total ?? 0;
      } catch { c[t.code] = 0; }
    }
    setCounts(c);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);
  useEffect(() => { fetchCounts(); }, [fetchCounts]);

  const filtered = entries.filter(e =>
    !search ||
    e.code.toLowerCase().includes(search.toLowerCase()) ||
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingId(null);
    setFormData(INITIAL_FORM);
    setShowModal(true);
  };

  const openEdit = (entry: MasterClassEntry) => {
    setEditingId(entry.id);
    setFormData({ code: entry.code, name: entry.name, order: entry.order });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editingId) {
        await api.put(`/master-classes/${editingId}`, formData);
      } else {
        await api.post("/master-classes", { ...formData, type: selectedType });
      }
      setShowModal(false);
      fetchEntries();
      fetchCounts();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      alert(e.response?.data?.message ?? "Lỗi khi lưu");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await api.delete(`/master-classes/${deleteId}`);
      setDeleteId(null);
      fetchEntries();
      fetchCounts();
    } catch {
      alert("Lỗi khi xóa");
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Type list */}
      <div className="w-72 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-4 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-primary" />
            Phân loại danh mục
          </h2>
          <p className="text-xs text-slate-500 mt-1">9 loại phân loại</p>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {MASTER_CLASS_TYPE_LIST.map(t => (
            <button
              key={t.code}
              onClick={() => { setSelectedType(t.code); setSearch(""); }}
              className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                selectedType === t.code
                  ? "bg-blue-50 text-blue-700 border-r-2 border-blue-600"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <div>
                <span className="text-xs font-mono text-slate-400 mr-2">{t.code}</span>
                <span className="text-sm font-medium">{t.name}</span>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {counts[t.code] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{selectedTypeName}</h3>
            <p className="text-sm text-slate-500">Type: {selectedType} · {filtered.length} mục</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm kiếm..."
                className="pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
              <Plus className="w-4 h-4" /> Thêm mới
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Đang tải...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Không có dữ liệu</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase w-24">Mã</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Tên</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase w-24">Thứ tự</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase w-24">Trạng thái</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-mono text-slate-700">{entry.code}</td>
                    <td className="px-4 py-3 text-sm text-slate-800 font-medium">{entry.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{entry.order}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${entry.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                        {entry.isActive ? "Hoạt động" : "Tắt"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(entry)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded mr-1"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteId(entry.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editingId ? "Chỉnh sửa" : "Thêm mới"} - {selectedTypeName}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mã (Code)</label>
                <input value={formData.code} onChange={e => setFormData(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="VD: NAM" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên (Name)</label>
                <input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="VD: Nam" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Thứ tự (Order)</label>
                <input type="number" value={formData.order} onChange={e => setFormData(f => ({ ...f, order: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Hủy</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4" /> Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h3 className="font-bold text-slate-800 mb-2">Xác nhận xóa</h3>
            <p className="text-sm text-slate-600 mb-4">Bạn có chắc chắn muốn xóa mục này?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Hủy</button>
              <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
