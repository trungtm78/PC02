import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import {
  Plus, Search, SlidersHorizontal, Download, RotateCcw, Eye, Edit, MoreVertical,
  Scale, AlertTriangle, X, Calendar, User, AlertCircle,
} from "lucide-react";

type IncidentStatus = 'TIEP_NHAN' | 'DANG_XAC_MINH' | 'DA_GIAI_QUYET' | 'TAM_DINH_CHI' | 'QUA_HAN' | 'DA_CHUYEN_VU_AN';

const STATUS_LABELS: Record<IncidentStatus, string> = {
  TIEP_NHAN: "Tiếp nhận", DANG_XAC_MINH: "Đang xác minh", DA_GIAI_QUYET: "Đã giải quyết",
  TAM_DINH_CHI: "Tạm đình chỉ", QUA_HAN: "Quá hạn", DA_CHUYEN_VU_AN: "Đã chuyển VA",
};

const STATUS_COLORS: Record<IncidentStatus, string> = {
  TIEP_NHAN: "bg-slate-800 text-white", DANG_XAC_MINH: "bg-amber-500 text-white",
  DA_GIAI_QUYET: "bg-green-600 text-white", TAM_DINH_CHI: "bg-orange-500 text-white",
  QUA_HAN: "bg-red-600 text-white", DA_CHUYEN_VU_AN: "bg-purple-600 text-white",
};

interface Incident {
  id: string; code: string; name: string; incidentType?: string; deadline?: string;
  status: IncidentStatus; createdAt: string;
  investigator?: { id: string; firstName?: string; lastName?: string; username: string };
}

function isOverdue(deadline?: string): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date(new Date().setHours(0, 0, 0, 0));
}

function formatDate(d?: string): string {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("vi-VN"); } catch { return d; }
}

export function IncidentListPage() {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quickSearch, setQuickSearch] = useState("");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showProsecuteModal, setShowProsecuteModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [advancedFilters, setAdvancedFilters] = useState({ status: "", investigatorId: "" });

  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: Incident[]; total: number }>('/incidents', { params: { limit: 100 } });
      setIncidents(res.data.data ?? []);
    } catch { setIncidents([]); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void fetchIncidents(); }, [fetchIncidents]);
  useEffect(() => { const h = () => setShowActionMenu(null); document.addEventListener("click", h); return () => document.removeEventListener("click", h); }, []);

  const filteredIncidents = incidents.filter((i) => {
    const matchesSearch = !quickSearch || i.code.toLowerCase().includes(quickSearch.toLowerCase()) ||
      i.name.toLowerCase().includes(quickSearch.toLowerCase()) ||
      (i.investigator?.firstName?.toLowerCase().includes(quickSearch.toLowerCase()) ?? false) ||
      (i.investigator?.lastName?.toLowerCase().includes(quickSearch.toLowerCase()) ?? false);
    const matchesStatus = !advancedFilters.status || i.status === advancedFilters.status;
    const matchesInvestigator = !advancedFilters.investigatorId || i.investigator?.id === advancedFilters.investigatorId;
    return matchesSearch && matchesStatus && matchesInvestigator;
  });

  const overdueCount = filteredIncidents.filter((i) => isOverdue(i.deadline)).length;

  const handleActionClick = useCallback((incident: Incident, action: string) => {
    setSelectedIncident(incident);
    setShowActionMenu(null);
    if (action === "assign") setShowAssignModal(true);
    else if (action === "prosecute") setShowProsecuteModal(true);
  }, []);

  const handleSuccess = useCallback(() => { void fetchIncidents(); }, [fetchIncidents]);

  return (
    <div className="p-6 space-y-6" data-testid="incident-list-page">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Quản lý Vụ việc</h1>
        <p className="text-slate-600 text-sm mt-1">Tiếp nhận, xử lý và quản lý các vụ việc điều tra</p>
      </div>

      {overdueCount > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-center gap-3" data-testid="overdue-warning">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <p className="text-sm font-medium text-red-800">Cảnh báo: Có <span className="font-bold">{overdueCount}</span> vụ việc đã quá hạn xử lý</p>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/vu-viec/new")} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium" data-testid="btn-add-incident">
              <Plus className="w-4 h-4" />Thêm mới
            </button>
            <button onClick={() => setShowAdvancedSearch(!showAdvancedSearch)} className="flex items-center gap-2 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50" data-testid="btn-advanced-search">
              <SlidersHorizontal className="w-4 h-4" />Tìm kiếm nâng cao
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700" data-testid="btn-export">
              <Download className="w-4 h-4" />Xuất Excel
            </button>
            <button onClick={() => void fetchIncidents()} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50" data-testid="btn-refresh">
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input type="text" value={quickSearch} onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Tìm kiếm theo Mã, Tên vụ việc, Điều tra viên..." className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="search-input" />
          </div>
        </div>

        {showAdvancedSearch && (
          <div className="mt-4 pt-4 border-t border-slate-200" data-testid="advanced-search-panel">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-slate-800 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4" />Bộ lọc nâng cao</h3>
              <button onClick={() => setShowAdvancedSearch(false)} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4 text-slate-600" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
                <select value={advancedFilters.status} onChange={(e) => setAdvancedFilters({ ...advancedFilters, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" data-testid="filter-status">
                  <option value="">Tất cả</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setAdvancedFilters({ status: "", investigatorId: "" })} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm">Xóa bộ lọc</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-bold text-slate-800">Danh sách Vụ việc</h2>
          <p className="text-sm text-slate-600 mt-1">Hiển thị {filteredIncidents.length} / {incidents.length} vụ việc{overdueCount > 0 && <span className="ml-2 text-red-600">(<span className="font-medium">{overdueCount}</span> quá hạn)</span>}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" data-testid="incident-table">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase w-12">STT</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Mã vụ việc</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Tên vụ việc</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Loại</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">ĐTV Thụ lý</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Hạn xử lý</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Trạng thái</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase w-32">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500">Đang tải...</td></tr>
              ) : filteredIncidents.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center"><Search className="w-10 h-10 text-slate-300 mx-auto mb-2" /><p className="text-slate-600 font-medium">Không tìm thấy kết quả</p></td></tr>
              ) : (
                filteredIncidents.map((incident, index) => {
                  const overdue = isOverdue(incident.deadline);
                  return (
                    <tr key={incident.id} className={`hover:bg-slate-50 ${overdue ? "bg-red-50/40" : ""}`} data-testid="incident-row">
                      <td className="px-4 py-3 text-sm text-slate-700 font-medium">{index + 1}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-blue-600">{incident.code}</span>
                          {overdue && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full" data-testid="overdue-badge">Quá hạn</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate">{incident.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{incident.incidentType ?? "—"}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{incident.investigator ? `${incident.investigator.firstName ?? ""} ${incident.investigator.lastName ?? ""}`.trim() || incident.investigator.username : "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className={`text-sm ${overdue ? "text-red-600 font-medium" : "text-slate-700"}`}>{formatDate(incident.deadline)}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className={`px-3 py-1.5 rounded-md text-xs font-medium ${STATUS_COLORS[incident.status]}`}>{STATUS_LABELS[incident.status]}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <button onClick={() => navigate(`/vu-viec/${incident.id}`)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title="Xem" data-testid={`btn-view-${incident.id}`}><Eye className="w-4 h-4" /></button>
                          <button onClick={() => navigate(`/vu-viec/${incident.id}/edit`)} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Sửa" data-testid={`btn-edit-${incident.id}`}><Edit className="w-4 h-4" /></button>
                          <div className="relative">
                            <button onClick={(e) => { e.stopPropagation(); setShowActionMenu(showActionMenu === incident.id ? null : incident.id); }} className="p-2 text-slate-600 hover:bg-slate-100 rounded" title="Thao tác" data-testid="btn-action-menu"><MoreVertical className="w-4 h-4" /></button>
                            {showActionMenu === incident.id && (
                              <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-10" onClick={(e) => e.stopPropagation()}>
                                <button onClick={() => handleActionClick(incident, "assign")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left" data-testid="btn-assign"><User className="w-4 h-4 text-blue-600" />Phân công</button>
                                {incident.status === "DANG_XAC_MINH" && <button onClick={() => handleActionClick(incident, "prosecute")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left border-t border-slate-100" data-testid="btn-prosecute"><Scale className="w-4 h-4 text-red-600" />Khởi tố</button>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAssignModal && selectedIncident && <AssignInvestigatorModal incident={selectedIncident} onClose={() => setShowAssignModal(false)} onSuccess={handleSuccess} />}
      {showProsecuteModal && selectedIncident && <ProsecuteModal incident={selectedIncident} onClose={() => setShowProsecuteModal(false)} onSuccess={handleSuccess} />}
    </div>
  );
}

function AssignInvestigatorModal({ incident, onClose, onSuccess }: { incident: Incident; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({ investigatorId: "", deadline: "" });
  const [investigators, setInvestigators] = useState<{ id: string; firstName?: string; lastName?: string; username: string }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get<{ success: boolean; data: typeof investigators }>('/incidents/investigators').then((res) => setInvestigators(res.data.data ?? [])).catch(() => { });
  }, []);

  const handleSubmit = async () => {
    const newErrors: string[] = [];
    if (!formData.investigatorId) newErrors.push("Điều tra viên là bắt buộc");
    if (newErrors.length > 0) { setErrors(newErrors); return; }

    setIsSubmitting(true);
    try {
      await api.patch(`/incidents/${incident.id}/assign`, formData);
      onSuccess(); onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      if (Array.isArray(msg)) setErrors(msg); else if (typeof msg === "string") setErrors([msg]); else setErrors(["Có lỗi xảy ra"]);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div><h2 className="font-bold text-slate-800">Phân công điều tra viên</h2><p className="text-sm text-slate-600 mt-1">{incident.code}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-600" /></button>
        </div>
        <div className="p-6 space-y-4">
          {errors.length > 0 && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><ul className="list-disc list-inside">{errors.map((e, i) => <li key={i} className="text-sm text-red-700">{e}</li>)}</ul></div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Điều tra viên <span className="text-red-500">*</span></label>
            <select value={formData.investigatorId} onChange={(e) => setFormData({ ...formData, investigatorId: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" data-testid="field-investigator">
              <option value="">Chọn điều tra viên</option>
              {investigators.map((inv) => <option key={inv.id} value={inv.id}>{inv.firstName} {inv.lastName} ({inv.username})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Hạn xử lý</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="date" value={formData.deadline} onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-deadline" />
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Hủy</button>
          <button onClick={() => void handleSubmit()} disabled={isSubmitting} className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50" data-testid="btn-confirm-assign">
            {isSubmitting ? "Đang xử lý..." : "Xác nhận phân công"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProsecuteModal({ incident, onClose, onSuccess }: { incident: Incident; onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({ caseName: incident.name, prosecutionDecision: "", prosecutionDate: new Date().toISOString().split("T")[0], crime: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const newErrors: string[] = [];
    if (!formData.caseName) newErrors.push("Tên vụ án là bắt buộc");
    if (!formData.prosecutionDecision) newErrors.push("Số quyết định là bắt buộc");
    if (newErrors.length > 0) { setErrors(newErrors); return; }

    setIsSubmitting(true);
    try {
      await api.post(`/incidents/${incident.id}/prosecute`, formData);
      onSuccess(); onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      if (Array.isArray(msg)) setErrors(msg); else if (typeof msg === "string") setErrors([msg]); else setErrors(["Có lỗi xảy ra"]);
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div><h2 className="font-bold text-slate-800">Khởi tố vụ việc</h2><p className="text-sm text-slate-600 mt-1">{incident.code}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded"><X className="w-5 h-5 text-slate-600" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800"><p className="font-medium">Lưu ý:</p><p>Vụ việc sẽ được chuyển thành Vụ án và không thể hoàn tác.</p></div>
          </div>
          {errors.length > 0 && <div className="bg-red-50 border border-red-200 rounded-lg p-3"><ul className="list-disc list-inside">{errors.map((e, i) => <li key={i} className="text-sm text-red-700">{e}</li>)}</ul></div>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tên vụ án <span className="text-red-500">*</span></label>
            <input type="text" value={formData.caseName} onChange={(e) => setFormData({ ...formData, caseName: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-case-name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Số quyết định khởi tố <span className="text-red-500">*</span></label>
            <input type="text" value={formData.prosecutionDecision} onChange={(e) => setFormData({ ...formData, prosecutionDecision: e.target.value })}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-prosecution-decision" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ngày khởi tố</label>
              <input type="date" value={formData.prosecutionDate} onChange={(e) => setFormData({ ...formData, prosecutionDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tội danh</label>
              <input type="text" value={formData.crime} onChange={(e) => setFormData({ ...formData, crime: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>
        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">Hủy</button>
          <button onClick={() => void handleSubmit()} disabled={isSubmitting} className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50" data-testid="btn-confirm-prosecute">
            {isSubmitting ? "Đang xử lý..." : "Xác nhận khởi tố"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default IncidentListPage;
