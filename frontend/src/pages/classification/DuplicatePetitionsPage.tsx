import { useState, useEffect, useMemo } from "react";
import { PetitionStatus } from "@/shared/enums/generated";
import { DUPLICATE_PETITION_STATUS } from "@/shared/enums/duplicate-petition-status";
import {
  Search,
  Download,
  RotateCcw,
  Eye,
  GitMerge,
  GitBranch,
  X,
  Calendar,
  User,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  SlidersHorizontal,
  Fingerprint,
  FileCheck,
  TrendingUp,
  Link2,
  Copy,
} from "lucide-react";
import { api } from "@/lib/api";

interface DuplicatePetition {
  id: string;
  stt: number;
  newPetitionCode: string;
  newPetitionTitle: string;
  submittedBy: string;
  submittedDate: string;
  duplicateCriteria: string[];
  suggestedOriginals: {
    code: string;
    title: string;
    similarity: number;
    submittedDate: string;
  }[];
  status: "Chờ xử lý" | "Đã hợp nhất" | "Tách riêng" | "Đang xem xét";
  statusColor: string;
  handler?: string;
  processedDate?: string;
  notes?: string;
}

const criteria = [
  "Họ tên",
  "CCCD",
  "Số điện thoại",
  "Địa chỉ",
  "Nội dung tương tự",
  "Bị đơn trùng",
  "Thời gian gần nhau",
];

export default function DuplicatePetitionsPage() {
  const [quickSearch, setQuickSearch] = useState("");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [selectedDuplicate, setSelectedDuplicate] = useState<DuplicatePetition | null>(null);
  const [compareWith, setCompareWith] = useState<string>("");

  const [allData, setAllData] = useState<DuplicatePetition[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    criteria: "",
    status: "",
    fromDate: "",
    toDate: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get("/petitions?limit=100");
        const mapped: DuplicatePetition[] = (res.data.data ?? []).map((p: any, i: number) => ({
          id: p.id,
          stt: i + 1,
          newPetitionCode: p.stt ?? `DT-${i + 1}`,
          newPetitionTitle: p.summary ?? "",
          submittedBy: p.senderName ?? "",
          submittedDate: p.receivedDate ? new Date(p.receivedDate).toLocaleDateString("vi-VN") : "",
          duplicateCriteria: [],
          suggestedOriginals: [],
          status: (() => {
            const m: Record<string, string> = {
              [PetitionStatus.MOI_TIEP_NHAN]: DUPLICATE_PETITION_STATUS.PENDING,
              [PetitionStatus.DANG_XU_LY]: DUPLICATE_PETITION_STATUS.REVIEWING,
              [PetitionStatus.DA_GIAI_QUYET]: DUPLICATE_PETITION_STATUS.SPLIT,
            };
            return m[p.status] ?? DUPLICATE_PETITION_STATUS.PENDING;
          })() as DuplicatePetition["status"],
          statusColor: "text-amber-600",
        }));
        setAllData(mapped);
      } catch {
        setAllData([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredDuplicates = useMemo(() => {
    return allData.filter((dup) => {
      const matchesQuickSearch =
        dup.newPetitionCode.toLowerCase().includes(quickSearch.toLowerCase()) ||
        dup.newPetitionTitle.toLowerCase().includes(quickSearch.toLowerCase()) ||
        dup.submittedBy.toLowerCase().includes(quickSearch.toLowerCase());

      const matchesStatus = filters.status === "" || dup.status === filters.status;
      const matchesCriteria =
        filters.criteria === "" || dup.duplicateCriteria.includes(filters.criteria);

      return matchesQuickSearch && matchesStatus && matchesCriteria;
    });
  }, [allData, quickSearch, filters]);

  const handleViewDetail = (duplicate: DuplicatePetition) => {
    setSelectedDuplicate(duplicate);
    setShowDetailModal(true);
  };

  const handleProcess = (duplicate: DuplicatePetition) => {
    setSelectedDuplicate(duplicate);
    setShowProcessModal(true);
  };

  const handleCompare = (duplicate: DuplicatePetition, originalCode: string) => {
    setSelectedDuplicate(duplicate);
    setCompareWith(originalCode);
    setShowCompareModal(true);
  };

  const getCriteriaColor = (criterion: string) => {
    const colors: Record<string, string> = {
      "Họ tên": "bg-blue-100 text-blue-700",
      CCCD: "bg-purple-100 text-purple-700",
      "Số điện thoại": "bg-green-100 text-green-700",
      "Địa chỉ": "bg-amber-100 text-amber-700",
      "Nội dung tương tự": "bg-pink-100 text-pink-700",
      "Bị đơn trùng": "bg-red-100 text-red-700",
      "Thời gian gần nhau": "bg-cyan-100 text-cyan-700",
    };
    return colors[criterion] || "bg-slate-100 text-slate-700";
  };

  const statusCounts = {
    total: allData.length,
    pending: allData.filter((d) => d.status === DUPLICATE_PETITION_STATUS.PENDING).length,
    reviewing: allData.filter((d) => d.status === DUPLICATE_PETITION_STATUS.REVIEWING).length,
    merged: allData.filter((d) => d.status === DUPLICATE_PETITION_STATUS.MERGED).length,
    separated: allData.filter((d) => d.status === DUPLICATE_PETITION_STATUS.SPLIT).length,
  };

  return (
    <div className="p-6 space-y-6" data-testid="duplicate-petitions-page">
      <div>
        <h1 className="text-2xl font-bold text-[#003973]">Quản lý đơn trùng</h1>
        <p className="text-slate-600 text-sm mt-1">
          Phát hiện và xử lý các đơn thư có dấu hiệu trùng lặp
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Tổng số đơn trùng</p>
              <p className="text-2xl font-bold text-[#003973] mt-1">{statusCounts.total}</p>
            </div>
            <div className="w-12 h-12 bg-[#003973]/10 rounded-lg flex items-center justify-center">
              <Copy className="w-6 h-6 text-[#003973]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Chờ xử lý</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{statusCounts.pending}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Đang xem xét</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{statusCounts.reviewing}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Eye className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Đã hợp nhất</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{statusCounts.merged}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <GitMerge className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Tách riêng</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{statusCounts.separated}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <GitBranch className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
              data-testid="filter-toggle-btn"
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                showAdvancedSearch
                  ? "bg-[#003973]/10 border-[#003973] text-[#003973]"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Bộ lọc
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              data-testid="export-excel-btn"
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Xuất Excel
            </button>
            <button
              onClick={() => setFilters({ criteria: "", fromDate: "", toDate: "", status: "" })}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              data-testid="quick-search-input"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Tìm kiếm theo mã đơn, tiêu đề, người nộp..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent"
            />
          </div>
        </div>

        {showAdvancedSearch && (
          <div className="mt-4 pt-4 border-t border-slate-200" data-testid="advanced-filter-panel">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tiêu chí trùng</label>
                <select
                  value={filters.criteria}
                  onChange={(e) => setFilters({ ...filters, criteria: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white text-sm"
                >
                  <option value="">Tất cả tiêu chí</option>
                  {criteria.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Từ ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={filters.fromDate}
                    onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đến ngày</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={filters.toDate}
                    onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white text-sm"
                >
                  <option value="">Tất cả</option>
                  {Object.values(DUPLICATE_PETITION_STATUS).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="font-bold text-[#003973]">Danh sách đơn trùng</h2>
          <p className="text-sm text-slate-600 mt-1">
            Hiển thị {filteredDuplicates.length} / {allData.length} đơn trùng
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" data-testid="duplicates-table">
            <thead className="bg-[#003973]/5 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider w-28 sticky left-0 bg-[#eef2f7] z-10 border-r border-slate-200">
                  Thao tác
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider w-16">
                  STT
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider">
                  Mã đơn mới
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider">
                  Tiêu chí trùng
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider">
                  Hồ sơ gốc gợi ý
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider">
                  Người nộp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider">
                  Ngày nộp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <p className="text-slate-500">Đang tải dữ liệu...</p>
                  </td>
                </tr>
              ) : (
                filteredDuplicates.map((dup) => (
                  <tr
                    key={dup.id}
                    onClick={() => handleViewDetail(dup)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewDetail(dup); } }}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-blue-50 transition-colors"
                  >
                    <td
                      className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewDetail(dup)}
                          data-testid={`view-btn-${dup.id}`}
                          className="p-2 text-[#003973] hover:bg-[#003973]/10 rounded transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {dup.status === DUPLICATE_PETITION_STATUS.PENDING && (
                          <button
                            onClick={() => handleProcess(dup)}
                            data-testid={`process-btn-${dup.id}`}
                            className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Xử lý"
                          >
                            <FileCheck className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-medium">
                      {dup.stt}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-[#003973]">
                          {dup.newPetitionCode}
                        </span>
                        <span className="text-xs text-slate-500 line-clamp-1 max-w-xs">
                          {dup.newPetitionTitle}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {dup.duplicateCriteria.map((criterion) => (
                          <span
                            key={criterion}
                            className={`px-2 py-0.5 rounded text-xs font-medium ${getCriteriaColor(
                              criterion
                            )}`}
                          >
                            {criterion}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1.5 max-w-sm">
                        {dup.suggestedOriginals.map((original) => (
                          <div
                            key={original.code}
                            className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-purple-600">
                                  {original.code}
                                </span>
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3 text-green-600" />
                                  <span
                                    data-testid={`similarity-${dup.id}-${original.code}`}
                                    className={`text-xs font-medium ${
                                      original.similarity > 90 ? "text-red-600" : "text-green-600"
                                    }`}
                                  >
                                    {original.similarity}%
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-slate-500 line-clamp-1">{original.title}</p>
                            </div>
                            <button
                              onClick={() => handleCompare(dup, original.code)}
                              data-testid={`compare-btn-${dup.id}-${original.code}`}
                              className="p-1 text-[#003973] hover:bg-[#003973]/10 rounded transition-colors"
                              title="So sánh"
                            >
                              <Link2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-slate-400" />
                        <span className="line-clamp-1">{dup.submittedBy}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {dup.submittedDate}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        data-testid={`status-badge-${dup.status.replace(/\s/g, "-")}`}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium ${dup.statusColor}`}
                      >
                        {dup.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredDuplicates.length === 0 && (
          <div className="text-center py-12">
            <Copy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Không tìm thấy đơn trùng nào</p>
          </div>
        )}
      </div>

      {showDetailModal && selectedDuplicate && (
        <DuplicateDetailModal
          duplicate={selectedDuplicate}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedDuplicate(null);
          }}
          onProcess={() => {
            setShowDetailModal(false);
            setShowProcessModal(true);
          }}
          onCompare={(originalCode) => {
            setShowDetailModal(false);
            setCompareWith(originalCode);
            setShowCompareModal(true);
          }}
        />
      )}

      {showProcessModal && selectedDuplicate && (
        <ProcessDuplicateModal
          duplicate={selectedDuplicate}
          onClose={() => {
            setShowProcessModal(false);
            setSelectedDuplicate(null);
          }}
        />
      )}

      {showCompareModal && selectedDuplicate && compareWith && (
        <ComparePetitionsModal
          newPetition={selectedDuplicate}
          originalCode={compareWith}
          onClose={() => {
            setShowCompareModal(false);
            setSelectedDuplicate(null);
            setCompareWith("");
          }}
        />
      )}
    </div>
  );
}

function DuplicateDetailModal({
  duplicate,
  onClose,
  onProcess,
  onCompare,
}: {
  duplicate: DuplicatePetition;
  onClose: () => void;
  onProcess: () => void;
  onCompare: (originalCode: string) => void;
}) {
  const getCriteriaColor = (criterion: string) => {
    const colors: Record<string, string> = {
      "Họ tên": "bg-blue-100 text-blue-700",
      CCCD: "bg-purple-100 text-purple-700",
      "Số điện thoại": "bg-green-100 text-green-700",
      "Địa chỉ": "bg-amber-100 text-amber-700",
      "Nội dung tương tự": "bg-pink-100 text-pink-700",
      "Bị đơn trùng": "bg-red-100 text-red-700",
      "Thời gian gần nhau": "bg-cyan-100 text-cyan-700",
    };
    return colors[criterion] || "bg-slate-100 text-slate-700";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-[#003973]">Chi tiết đơn trùng</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-4 bg-[#003973]/5 border border-[#003973]/20 rounded-lg">
            <h3 className="font-medium text-[#003973] mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Thông tin đơn mới
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Mã đơn</label>
                <p className="text-[#003973] font-medium">{duplicate.newPetitionCode}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Ngày nộp</label>
                <p className="text-slate-800">{duplicate.submittedDate}</p>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1">Tiêu đề</label>
                <p className="text-slate-800">{duplicate.newPetitionTitle}</p>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-600 mb-1">Người nộp</label>
                <p className="text-slate-800">{duplicate.submittedBy}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-[#003973] mb-3 flex items-center gap-2">
              <Fingerprint className="w-5 h-5" />
              Tiêu chí phát hiện trùng
            </h3>
            <div className="flex flex-wrap gap-2">
              {duplicate.duplicateCriteria.map((criterion) => (
                <span
                  key={criterion}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${getCriteriaColor(
                    criterion
                  )}`}
                >
                  {criterion}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-medium text-[#003973] mb-3 flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Hồ sơ gốc được gợi ý
            </h3>
            <div className="space-y-3">
              {duplicate.suggestedOriginals.map((original) => (
                <div
                  key={original.code}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-purple-600">{original.code}</span>
                        <div
                          className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                            original.similarity > 90 ? "bg-red-100" : "bg-green-100"
                          }`}
                        >
                          <TrendingUp
                            className={`w-3 h-3 ${original.similarity > 90 ? "text-red-700" : "text-green-700"}`}
                          />
                          <span
                            className={`text-xs font-medium ${original.similarity > 90 ? "text-red-700" : "text-green-700"}`}
                          >
                            Độ tương đồng: {original.similarity}%
                          </span>
                        </div>
                        <span className="text-xs text-slate-500">
                          Ngày nộp: {original.submittedDate}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{original.title}</p>
                    </div>
                    <button
                      onClick={() => onCompare(original.code)}
                      data-testid="detail-compare-btn"
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#003973] text-white rounded-lg hover:bg-[#002d5c] transition-colors text-sm"
                    >
                      <Link2 className="w-4 h-4" />
                      So sánh
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Trạng thái</label>
                <span
                  className={`inline-block px-3 py-1.5 rounded-md text-sm font-medium ${duplicate.statusColor}`}
                >
                  {duplicate.status}
                </span>
              </div>
              {duplicate.handler && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Người xử lý
                  </label>
                  <p className="text-slate-800">{duplicate.handler}</p>
                </div>
              )}
              {duplicate.processedDate && (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Ngày xử lý
                  </label>
                  <p className="text-slate-800">{duplicate.processedDate}</p>
                </div>
              )}
              {duplicate.notes && (
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Ghi chú xử lý
                  </label>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-800">{duplicate.notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex justify-between">
          <div>
            {duplicate.status === DUPLICATE_PETITION_STATUS.PENDING && (
              <button
                onClick={onProcess}
                data-testid="detail-process-btn"
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                <FileCheck className="w-4 h-4" />
                Xử lý đơn trùng
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

function ProcessDuplicateModal({
  duplicate,
  onClose,
}: {
  duplicate: DuplicatePetition;
  onClose: () => void;
}) {
  const [action, setAction] = useState<"merge" | "separate" | "review">("merge");
  const [selectedOriginal, setSelectedOriginal] = useState(
    duplicate.suggestedOriginals[0]?.code || ""
  );
  const [notes, setNotes] = useState("");

  const handleSubmit = () => {
    if (action === "merge" && !selectedOriginal) {
      alert("Vui lòng chọn hồ sơ gốc để hợp nhất");
      return;
    }

    if (!notes.trim()) {
      alert("Vui lòng nhập ghi chú xử lý");
      return;
    }

    const actionText =
      action === "merge"
        ? "hợp nhất vào hồ sơ " + selectedOriginal
        : action === "separate"
        ? "tách thành hồ sơ riêng"
        : "chuyển sang trạng thái xem xét";

    alert(`Đã ${actionText} cho đơn ${duplicate.newPetitionCode}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-[#003973]">Xử lý đơn trùng</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h3 className="font-medium text-slate-800 mb-2">Đơn cần xử lý</h3>
            <p className="text-sm">
              <span className="font-medium text-[#003973]">{duplicate.newPetitionCode}</span>
              <span className="text-slate-600"> - {duplicate.newPetitionTitle}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Hành động xử lý <span className="text-red-500">*</span>
            </label>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="merge"
                  checked={action === "merge"}
                  onChange={(e) => setAction(e.target.value as any)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <GitMerge className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-slate-800">Hợp nhất vào hồ sơ gốc</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Hợp nhất đơn này vào một hồ sơ đã có trước đó
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="separate"
                  checked={action === "separate"}
                  onChange={(e) => setAction(e.target.value as any)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <GitBranch className="w-5 h-5 text-purple-600" />
                    <span className="font-medium text-slate-800">Tách thành hồ sơ riêng</span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Sau khi xem xét, xác định đây không phải đơn trùng
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                <input
                  type="radio"
                  name="action"
                  value="review"
                  checked={action === "review"}
                  onChange={(e) => setAction(e.target.value as any)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-slate-800">Chuyển sang xem xét</span>
                  </div>
                  <p className="text-sm text-slate-600">Cần thêm thời gian để xem xét và đánh giá</p>
                </div>
              </label>
            </div>
          </div>

          {action === "merge" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Chọn hồ sơ gốc <span className="text-red-500">*</span>
              </label>
              <div className="space-y-2">
                {duplicate.suggestedOriginals.map((original) => (
                  <label
                    key={original.code}
                    className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <input
                      type="radio"
                      name="original"
                      value={original.code}
                      checked={selectedOriginal === original.code}
                      onChange={(e) => setSelectedOriginal(e.target.value)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-purple-600">{original.code}</span>
                        <div
                          className={`flex items-center gap-1 px-2 py-0.5 rounded ${
                            original.similarity > 90 ? "bg-red-100" : "bg-green-100"
                          }`}
                        >
                          <TrendingUp
                            className={`w-3 h-3 ${original.similarity > 90 ? "text-red-700" : "text-green-700"}`}
                          />
                          <span
                            className={`text-xs font-medium ${original.similarity > 90 ? "text-red-700" : "text-green-700"}`}
                          >
                            {original.similarity}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600">{original.title}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Ngày nộp: {original.submittedDate}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Ghi chú xử lý <span className="text-red-500">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              data-testid="process-notes-input"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
              placeholder="Nhập lý do và căn cứ xử lý..."
            />
          </div>

          <div className="p-4 bg-[#F59E0B]/10 border border-[#F59E0B] rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[#92400E]">
              <p className="font-medium mb-1">Lưu ý:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Hành động này sẽ ảnh hưởng đến luồng xử lý của đơn</li>
                <li>Người nộp đơn sẽ được thông báo về kết quả xử lý</li>
                <li>Vui lòng kiểm tra kỹ trước khi xác nhận</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            data-testid="confirm-process-btn"
            className="px-4 py-2.5 bg-[#003973] text-white rounded-lg hover:bg-[#002d5c] transition-colors font-medium"
          >
            Xác nhận xử lý
          </button>
        </div>
      </div>
    </div>
  );
}

function ComparePetitionsModal({
  newPetition,
  originalCode,
  onClose,
}: {
  newPetition: DuplicatePetition;
  originalCode: string;
  onClose: () => void;
}) {
  const original = newPetition.suggestedOriginals.find((o) => o.code === originalCode);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-[#003973]">So sánh đơn thư</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 bg-[#003973]/5 border-2 border-[#003973]/20 rounded-lg">
                <h3 className="font-bold text-[#003973] mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Đơn mới
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Mã đơn</label>
                    <p className="text-[#003973] font-medium">{newPetition.newPetitionCode}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Ngày nộp</label>
                    <p className="text-slate-800">{newPetition.submittedDate}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Người nộp</label>
                    <p className="text-slate-800">{newPetition.submittedBy}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">Tiêu đề</label>
                    <p className="text-slate-800">{newPetition.newPetitionTitle}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
                <h3 className="font-bold text-purple-800 mb-2 flex items-center gap-2">
                  <FileCheck className="w-5 h-5" />
                  Hồ sơ gốc
                  {original && (
                    <div
                      className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded ${
                        original.similarity > 90 ? "bg-red-100" : "bg-green-100"
                      }`}
                    >
                      <TrendingUp
                        className={`w-3 h-3 ${original.similarity > 90 ? "text-red-700" : "text-green-700"}`}
                      />
                      <span
                        className={`text-xs font-medium ${original.similarity > 90 ? "text-red-700" : "text-green-700"}`}
                      >
                        Độ tương đồng: {original.similarity}%
                      </span>
                    </div>
                  )}
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-purple-700 mb-1">Mã đơn</label>
                    <p className="text-purple-900 font-medium">{originalCode}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-700 mb-1">Ngày nộp</label>
                    <p className="text-purple-900">{original?.submittedDate}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-700 mb-1">
                      Người nộp
                    </label>
                    <p className="text-purple-900">Nguyễn Văn A (CCCD: 001234567890)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-purple-700 mb-1">Tiêu đề</label>
                    <p className="text-purple-900">{original?.title}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <h3 className="font-bold text-[#003973] mb-3 flex items-center gap-2">
              <Fingerprint className="w-5 h-5" />
              Phân tích điểm trùng khớp
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {newPetition.duplicateCriteria.map((criterion) => (
                <div
                  key={criterion}
                  className="flex items-center gap-2 p-2 bg-white rounded border border-slate-200"
                >
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-slate-700">{criterion}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
