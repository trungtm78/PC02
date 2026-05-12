import { useState, useEffect, useCallback } from 'react';
import { MapPin, Plus, Edit2, Trash2, RefreshCw, Search, X, Save, Loader2, AlertTriangle, CheckCircle2, StopCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';

interface AddressMapping {
  id: string;
  oldWard: string;
  oldDistrict: string;
  newWard: string;
  province: string;
  note?: string;
  isActive: boolean;
  needsReview: boolean;
  createdAt: string;
}

interface FormData {
  oldWard: string;
  oldDistrict: string;
  newWard: string;
  province: string;
  note: string;
  needsReview: boolean;
}

const EMPTY_FORM: FormData = {
  oldWard: '', oldDistrict: '', newWard: '', province: 'HCM', note: '', needsReview: false,
};

type SeedProvince = 'HCM' | 'HN' | 'HP' | 'DN' | 'CT';
type SeedJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

interface SeedJob {
  jobId: string;
  province: SeedProvince;
  status: SeedJobStatus;
  totalWards: number;
  mappedCount: number;
  errorCount: number;
  needsReview: number;
  errorLog?: string | null;
}

const SUPPORTED_SEED_PROVINCES: Array<{ code: SeedProvince; label: string }> = [
  { code: 'HCM', label: 'TP. Hồ Chí Minh' },
  { code: 'HN', label: 'Hà Nội' },
  { code: 'HP', label: 'Hải Phòng' },
  { code: 'DN', label: 'Đà Nẵng' },
  { code: 'CT', label: 'Cần Thơ' },
];

const SEED_POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES: SeedJobStatus[] = ['completed', 'failed', 'cancelled'];

export function AddressMappingModule() {
  const { canEdit } = usePermission();
  const canEditRow = canEdit('settings');
  const [items, setItems] = useState<AddressMapping[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterReview, setFilterReview] = useState<'all' | 'needs_review'>('all');
  const [stats, setStats] = useState<{ total: number; needsReview: number; active: number } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AddressMapping | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [seedProvince, setSeedProvince] = useState<SeedProvince>('HCM');
  const [seedJob, setSeedJob] = useState<SeedJob | null>(null);
  const [seedError, setSeedError] = useState<string>('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100', offset: '0' });
      if (search) params.set('search', search);
      if (filterReview === 'needs_review') params.set('needsReview', 'true');
      const res = await api.get(`/address-mappings?${params}`);
      setItems(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [search, filterReview]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  useEffect(() => {
    api.get('/address-mappings/stats').then(r => setStats(r.data)).catch(() => null);
  }, [items]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: AddressMapping) => {
    setEditingItem(item);
    setFormData({ oldWard: item.oldWard, oldDistrict: item.oldDistrict, newWard: item.newWard, province: item.province, note: item.note ?? '', needsReview: item.needsReview });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.oldWard || !formData.oldDistrict || !formData.newWard) {
      setFormError('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingItem) {
        await api.patch(`/address-mappings/${editingItem.id}`, formData);
      } else {
        await api.post('/address-mappings', formData);
      }
      setShowModal(false);
      void loadItems();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'Lỗi khi lưu mapping');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa mapping này?')) return;
    await api.delete(`/address-mappings/${id}`);
    void loadItems();
  };

  const isSeedJobActive = seedJob?.status === 'queued' || seedJob?.status === 'running';

  const handleStartSeed = async () => {
    setSeedError('');
    try {
      const res = await api.post(`/address-mappings/seed/${seedProvince}`);
      const jobId = res.data?.jobId as string | undefined;
      if (!jobId) {
        setSeedError('Không nhận được jobId từ server');
        return;
      }
      setSeedJob({
        jobId,
        province: seedProvince,
        status: 'queued',
        totalWards: 0,
        mappedCount: 0,
        errorCount: 0,
        needsReview: 0,
      });
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSeedError(msg ?? 'Không khởi động được job seed');
    }
  };

  const handleCancelSeed = async () => {
    if (!seedJob || !isSeedJobActive) return;
    try {
      await api.post(`/address-mappings/seed/${seedJob.jobId}/cancel`);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSeedError(msg ?? 'Không hủy được job');
    }
  };

  // Poll seed job status every 2s while queued/running.
  useEffect(() => {
    if (!seedJob || TERMINAL_STATUSES.includes(seedJob.status)) return;
    const jobId = seedJob.jobId;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/address-mappings/seed/status/${jobId}`);
        const data = res.data as Partial<SeedJob> & { status?: SeedJobStatus; id?: string };
        setSeedJob((prev) => {
          if (!prev || prev.jobId !== jobId) return prev;
          return {
            ...prev,
            status: data.status ?? prev.status,
            totalWards: data.totalWards ?? prev.totalWards,
            mappedCount: data.mappedCount ?? prev.mappedCount,
            errorCount: data.errorCount ?? prev.errorCount,
            needsReview: data.needsReview ?? prev.needsReview,
            errorLog: data.errorLog ?? prev.errorLog,
          };
        });
        if (data.status && TERMINAL_STATUSES.includes(data.status)) {
          void loadItems();
        }
      } catch {
        // Job có thể bị xóa khỏi DB hoặc backend restart; dừng polling.
        setSeedJob(null);
      }
    }, SEED_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [seedJob, loadItems]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Mapping địa chỉ cải cách 2025</h2>
          <p className="text-sm text-slate-500 mt-0.5">Chuyển đổi địa chỉ cũ (có quận/huyện) sang mới theo NQ 1279/NQ-UBTVQH15</p>
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-1 text-sm">
            <span className="sr-only">Tỉnh/TP để seed</span>
            <select
              aria-label="Tỉnh/TP để seed"
              value={seedProvince}
              onChange={(e) => setSeedProvince(e.target.value as SeedProvince)}
              disabled={isSeedJobActive}
              className="px-2 py-2 text-sm border border-slate-300 rounded-lg disabled:opacity-50"
            >
              {SUPPORTED_SEED_PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>{p.code} — {p.label}</option>
              ))}
            </select>
          </label>
          <button onClick={handleStartSeed} disabled={isSeedJobActive}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50">
            {isSeedJobActive ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Cập nhật từ API
          </button>
          <button onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-[#003973] text-white rounded-lg hover:bg-[#003973]/90">
            <Plus className="w-4 h-4" />
            Thêm mapping
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Tổng mapping', value: stats.total, icon: MapPin },
            { label: 'Cần review', value: stats.needsReview, icon: AlertTriangle, warn: stats.needsReview > 0 },
            { label: 'Đang dùng', value: stats.active, icon: CheckCircle2 },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-lg border border-slate-200 p-3 flex items-center gap-3">
              <s.icon className={`w-5 h-5 ${s.warn ? 'text-amber-500' : 'text-[#003973]'}`} />
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={`text-lg font-bold ${s.warn ? 'text-amber-600' : 'text-slate-800'}`}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {seedError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{seedError}</div>
      )}

      {seedJob && (
        <div
          className={`p-3 rounded-lg border text-sm flex items-center justify-between gap-3 ${
            seedJob.status === 'completed' ? 'bg-green-50 border-green-200 text-green-800' :
            seedJob.status === 'failed' ? 'bg-red-50 border-red-200 text-red-800' :
            seedJob.status === 'cancelled' ? 'bg-slate-50 border-slate-200 text-slate-700' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-3 flex-1">
            {isSeedJobActive && <Loader2 className="w-4 h-4 animate-spin" />}
            <div className="flex-1">
              <div className="font-medium">
                Job {seedJob.province} · {seedJob.status}
              </div>
              <div className="text-xs">
                Đã map <span data-testid="seed-progress">{seedJob.mappedCount}/{seedJob.totalWards || '?'}</span>
                {seedJob.needsReview > 0 && ` · ${seedJob.needsReview} cần review`}
                {seedJob.errorCount > 0 && ` · ${seedJob.errorCount} lỗi`}
              </div>
            </div>
          </div>
          {isSeedJobActive ? (
            <button
              onClick={handleCancelSeed}
              className="flex items-center gap-1 px-2 py-1 text-xs border border-current rounded hover:bg-white/40"
            >
              <StopCircle className="w-3 h-3" />Hủy
            </button>
          ) : (
            <button
              onClick={() => setSeedJob(null)}
              className="p-1 hover:bg-white/40 rounded"
              aria-label="Đóng thông báo job"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm phường/xã, quận/huyện..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973]" />
        </div>
        <select value={filterReview} onChange={e => setFilterReview(e.target.value as 'all' | 'needs_review')}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="all">Tất cả</option>
          <option value="needs_review">Cần review</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-3 px-3 font-semibold text-slate-700 text-sm w-24 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Thao tác</th>
                {['Phường/Xã cũ', 'Quận/Huyện cũ', '→ Phường/Xã mới', 'Tỉnh', 'Ghi chú', 'Trạng thái'].map(h => (
                  <th key={h} className="text-left py-3 px-4 font-semibold text-slate-700 text-sm">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Đang tải...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Không có dữ liệu</td></tr>
              ) : items.map(item => (
                <tr
                  key={item.id}
                  onClick={canEditRow ? () => handleOpenEdit(item) : undefined}
                  onKeyDown={canEditRow ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenEdit(item); } } : undefined}
                  tabIndex={canEditRow ? 0 : undefined}
                  className={`transition-colors ${canEditRow ? "cursor-pointer hover:bg-blue-50" : "hover:bg-slate-50"} ${item.needsReview ? 'bg-amber-50/30' : ''}`}
                >
                  <td
                    className="py-2.5 px-3 sticky left-0 z-10 bg-white border-r border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex gap-1">
                      <button onClick={() => handleOpenEdit(item)} className="p-1.5 hover:bg-slate-100 rounded"><Edit2 className="w-4 h-4 text-slate-600" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
                    </div>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-sm text-slate-700">{item.oldWard}</td>
                  <td className="py-2.5 px-4 text-sm text-slate-500">{item.oldDistrict}</td>
                  <td className="py-2.5 px-4">
                    <span className="text-sm font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">{item.newWard}</span>
                  </td>
                  <td className="py-2.5 px-4 text-sm text-slate-500">{item.province}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-400 max-w-[200px] truncate">{item.note ?? '—'}</td>
                  <td className="py-2.5 px-4">
                    {item.needsReview ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">
                        <AlertTriangle className="w-3 h-3" />Cần review
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                        <CheckCircle2 className="w-3 h-3" />OK
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="p-3 border-t border-slate-100 text-sm text-slate-500">
            Hiển thị {items.length} / {total} mapping
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{editingItem ? 'Sửa mapping' : 'Thêm mapping mới'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">{formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phường/Xã cũ <span className="text-red-500">*</span></label>
                  <input value={formData.oldWard} onChange={e => setFormData({ ...formData, oldWard: e.target.value })}
                    placeholder="phường 14" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003973] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quận/Huyện cũ <span className="text-red-500">*</span></label>
                  <input value={formData.oldDistrict} onChange={e => setFormData({ ...formData, oldDistrict: e.target.value })}
                    placeholder="quận phú nhuận" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003973] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">→ Phường/Xã mới <span className="text-red-500">*</span></label>
                <input value={formData.newWard} onChange={e => setFormData({ ...formData, newWard: e.target.value })}
                  placeholder="phường phú nhuận" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003973] focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tỉnh/TP</label>
                  <input value={formData.province} onChange={e => setFormData({ ...formData, province: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003973] focus:outline-none" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.needsReview} onChange={e => setFormData({ ...formData, needsReview: e.target.checked })} className="w-4 h-4" />
                    <span className="text-sm text-slate-700">Cần review</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú</label>
                <input value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })}
                  placeholder="NQ 1279/NQ-UBTVQH15..." className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#003973] focus:outline-none" />
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
