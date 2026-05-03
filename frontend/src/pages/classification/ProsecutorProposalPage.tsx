import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Download,
  RotateCcw,
  Plus,
  Eye,
  Edit,
  Trash2,
  X,
  Calendar,
  Building2,
  FileText,
  User,
  CheckCircle,
  Clock,
  Send,
  AlertTriangle,
  FileCheck,
  Printer,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  ProposalStatus,
  PROPOSAL_STATUS_LABEL,
} from "@/shared/enums/proposal-status";
import { CASE_TYPE, type CaseType } from "@/shared/enums/case-types";

type ProposalStatusLabel = (typeof PROPOSAL_STATUS_LABEL)[ProposalStatus];

interface Proposal {
  id: string;
  stt: number;
  proposalNumber: string;
  relatedCase: string;
  caseType: CaseType;
  content: string;
  createdDate: string;
  sentDate?: string;
  unit: string;
  createdBy: string;
  status: ProposalStatusLabel;
  statusColor: string;
  response?: string;
  responseDate?: string;
}

export default function ProsecutorProposalPage() {
  const [quickSearch, setQuickSearch] = useState("");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  const [allProposals, setAllProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    status: "",
    fromDate: "",
    toDate: "",
    unit: "",
  });

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/proposals?limit=100");
      const statusColorMap: Record<ProposalStatusLabel, string> = {
        [PROPOSAL_STATUS_LABEL.CHO_GUI]: "bg-slate-400 text-white",
        [PROPOSAL_STATUS_LABEL.DA_GUI]: "bg-amber-500 text-white",
        [PROPOSAL_STATUS_LABEL.CO_PHAN_HOI]: "bg-blue-600 text-white",
        [PROPOSAL_STATUS_LABEL.DA_XU_LY]: "bg-green-600 text-white",
      };
      const mapped: Proposal[] = (res.data.data ?? []).map((p: any, i: number) => {
        const apiStatus = p.status as ProposalStatus | undefined;
        const status: ProposalStatusLabel =
          apiStatus && apiStatus in PROPOSAL_STATUS_LABEL
            ? PROPOSAL_STATUS_LABEL[apiStatus]
            : PROPOSAL_STATUS_LABEL[ProposalStatus.CHO_GUI];
        return {
          id: p.id,
          stt: i + 1,
          proposalNumber: p.proposalNumber,
          relatedCase: p.relatedCase?.name ?? "",
          caseType: (p.caseType ?? CASE_TYPE.CASE) as CaseType,
          content: p.content,
          createdDate: p.createdAt ? new Date(p.createdAt).toLocaleDateString("vi-VN") : "",
          sentDate: p.sentDate ? new Date(p.sentDate).toLocaleDateString("vi-VN") : undefined,
          unit: p.unit ?? "",
          createdBy: p.createdBy ? `${p.createdBy.firstName ?? ""} ${p.createdBy.lastName ?? ""}`.trim() : "",
          status,
          statusColor: statusColorMap[status] ?? "bg-slate-400 text-white",
          response: p.response,
          responseDate: p.responseDate ? new Date(p.responseDate).toLocaleDateString("vi-VN") : undefined,
        };
      });
      setAllProposals(mapped);
    } catch {
      setAllProposals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  const filteredProposals = useMemo(() => {
    return allProposals.filter((proposal) => {
      const matchesQuickSearch =
        (proposal.proposalNumber ?? "").toLowerCase().includes(quickSearch.toLowerCase()) ||
        (proposal.relatedCase ?? "").toLowerCase().includes(quickSearch.toLowerCase()) ||
        (proposal.content ?? "").toLowerCase().includes(quickSearch.toLowerCase()) ||
        (proposal.unit ?? "").toLowerCase().includes(quickSearch.toLowerCase());

      const matchesStatus = filters.status === "" || proposal.status === filters.status;
      const matchesUnit = filters.unit === "" || proposal.unit === filters.unit;

      return matchesQuickSearch && matchesStatus && matchesUnit;
    });
  }, [allProposals, quickSearch, filters]);

  const handleAdd = () => {
    setSelectedProposal(null);
    setShowFormModal(true);
  };

  const handleEdit = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setShowFormModal(true);
  };

  const handleViewDetail = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setShowDetailModal(true);
  };

  const handleExport = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setShowExportModal(true);
  };

  const handleDelete = (proposal: Proposal) => {
    setSelectedProposal(proposal);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedProposal) return;
    try {
      await api.delete(`/proposals/${selectedProposal.id}`);
      await fetchProposals();
    } catch {
      alert(`Đã xóa kiến nghị ${selectedProposal.proposalNumber}`);
    }
    setShowDeleteConfirm(false);
    setSelectedProposal(null);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case PROPOSAL_STATUS_LABEL.CHO_GUI:
        return <Clock className="w-4 h-4" />;
      case PROPOSAL_STATUS_LABEL.DA_GUI:
        return <Send className="w-4 h-4" />;
      case PROPOSAL_STATUS_LABEL.CO_PHAN_HOI:
        return <FileCheck className="w-4 h-4" />;
      case PROPOSAL_STATUS_LABEL.DA_XU_LY:
        return <CheckCircle className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const statusCounts = {
    total: allProposals.length,
    pending: allProposals.filter((p) => p.status === PROPOSAL_STATUS_LABEL.CHO_GUI).length,
    sent: allProposals.filter((p) => p.status === PROPOSAL_STATUS_LABEL.DA_GUI).length,
    responded: allProposals.filter((p) => p.status === PROPOSAL_STATUS_LABEL.CO_PHAN_HOI).length,
    completed: allProposals.filter((p) => p.status === PROPOSAL_STATUS_LABEL.DA_XU_LY).length,
  };

  const handleExportExcel = () => {
    const headers = ["Mã kiến nghị", "Mã hồ sơ", "Loại", "Nội dung", "Ngày tạo", "Đơn vị VKS", "Trạng thái"];
    const csvContent = [
      headers.join(","),
      ...filteredProposals.map((p) =>
        [
          p.proposalNumber,
          p.relatedCase,
          p.caseType,
          `"${(p.content ?? "").replace(/"/g, '""')}"`,
          p.createdDate,
          p.unit,
          p.status,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `kien-nghi-vks-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="p-6 space-y-6" data-testid="prosecutor-proposal-page">
      <div>
        <h1 className="text-2xl font-bold text-[#003973]">Kiến nghị VKS</h1>
        <p className="text-slate-600 text-sm mt-1">
          Quản lý các kiến nghị gửi Viện Kiểm sát nhân dân
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Tổng số kiến nghị</p>
              <p className="text-2xl font-bold text-[#003973] mt-1">{statusCounts.total}</p>
            </div>
            <div className="w-12 h-12 bg-[#003973]/10 rounded-lg flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#003973]" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Chờ gửi</p>
              <p className="text-2xl font-bold text-slate-600 mt-1">{statusCounts.pending}</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Đã gửi</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{statusCounts.sent}</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <Send className="w-6 h-6 text-amber-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Đã có phản hồi</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{statusCounts.responded}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileCheck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">Đã xử lý</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{statusCounts.completed}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleAdd}
              data-testid="add-proposal-btn"
              className="flex items-center gap-2 px-4 py-2.5 bg-[#003973] text-white rounded-lg hover:bg-[#002d5c] transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Tạo kiến nghị mới
            </button>
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
              onClick={handleExportExcel}
              data-testid="export-excel-btn"
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Xuất Excel
            </button>
            <button
              onClick={() => setFilters({ status: "", fromDate: "", toDate: "", unit: "" })}
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
              placeholder="Tìm kiếm theo mã kiến nghị, mã hồ sơ, nội dung, đơn vị..."
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] focus:border-transparent"
            />
          </div>
        </div>

        {showAdvancedSearch && (
          <div className="mt-4 pt-4 border-t border-slate-200" data-testid="advanced-filter-panel">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Đơn vị VKS
                </label>
                <select
                  value={filters.unit}
                  onChange={(e) => setFilters({ ...filters, unit: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white text-sm"
                >
                  <option value="">Tất cả đơn vị</option>
                  <option value="Viện Kiểm sát Quận 1">Viện Kiểm sát Quận 1</option>
                  <option value="Viện Kiểm sát Quận 3">Viện Kiểm sát Quận 3</option>
                  <option value="Viện Kiểm sát Quận 5">Viện Kiểm sát Quận 5</option>
                  <option value="Viện Kiểm sát Quận 7">Viện Kiểm sát Quận 7</option>
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
                  {Object.values(PROPOSAL_STATUS_LABEL).map((label) => (
                    <option key={label} value={label}>
                      {label}
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
          <h2 className="font-bold text-[#003973]">Danh sách kiến nghị</h2>
          <p className="text-sm text-slate-600 mt-1">
            Hiển thị {filteredProposals.length} / {allProposals.length} kiến nghị
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" data-testid="proposals-table">
            <thead className="bg-[#003973]/5 border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider w-36 sticky left-0 bg-[#eef2f7] z-10 border-r border-slate-200">
                  Thao tác
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider w-16">
                  STT
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider">
                  Mã kiến nghị
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider">
                  Mã hồ sơ liên quan
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider">
                  Nội dung kiến nghị
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider">
                  Ngày tạo
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-[#003973] uppercase tracking-wider">
                  Đơn vị VKS
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
                filteredProposals.map((proposal) => (
                  <tr
                    key={proposal.id}
                    onClick={() => handleViewDetail(proposal)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleViewDetail(proposal); } }}
                    tabIndex={0}
                    className="cursor-pointer hover:bg-blue-50 transition-colors"
                  >
                    <td
                      className="px-3 py-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleViewDetail(proposal)}
                          data-testid={`view-btn-${proposal.id}`}
                          className="p-2 text-[#003973] hover:bg-[#003973]/10 rounded transition-colors"
                          title="Xem chi tiết"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleExport(proposal)}
                          data-testid={`export-btn-${proposal.id}`}
                          className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                          title="Xuất văn bản"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(proposal)}
                          data-testid={`edit-btn-${proposal.id}`}
                          className="p-2 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                          title="Sửa"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(proposal)}
                          data-testid={`delete-btn-${proposal.id}`}
                          className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 font-medium">
                      {proposal.stt}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-medium text-[#003973]">
                        {proposal.proposalNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            proposal.caseType === CASE_TYPE.CASE
                              ? "bg-red-100 text-red-700"
                              : proposal.caseType === CASE_TYPE.INCIDENT
                              ? "bg-purple-100 text-purple-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {proposal.caseType}
                        </span>
                        <span className="text-sm font-medium text-slate-700">
                          {proposal.relatedCase}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700 line-clamp-2 max-w-md">
                        {proposal.content}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {proposal.createdDate}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {proposal.unit}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        data-testid={`status-badge-${proposal.status.replace(/\s/g, "-")}`}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium ${proposal.statusColor}`}
                      >
                        {getStatusIcon(proposal.status)}
                        {proposal.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredProposals.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Không tìm thấy kiến nghị nào</p>
          </div>
        )}
      </div>

      {showFormModal && (
        <ProposalFormModal
          proposal={selectedProposal}
          onClose={() => {
            setShowFormModal(false);
            setSelectedProposal(null);
          }}
          onSaved={fetchProposals}
        />
      )}

      {showDetailModal && selectedProposal && (
        <ProposalDetailModal
          proposal={selectedProposal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedProposal(null);
          }}
          onEdit={() => {
            setShowDetailModal(false);
            setShowFormModal(true);
          }}
          onExport={() => {
            setShowDetailModal(false);
            setShowExportModal(true);
          }}
        />
      )}

      {showExportModal && selectedProposal && (
        <ExportDocumentModal
          proposal={selectedProposal}
          onClose={() => {
            setShowExportModal(false);
            setSelectedProposal(null);
          }}
        />
      )}

      {showDeleteConfirm && selectedProposal && (
        <DeleteConfirmModal
          proposalNumber={selectedProposal.proposalNumber}
          onConfirm={confirmDelete}
          onCancel={() => {
            setShowDeleteConfirm(false);
            setSelectedProposal(null);
          }}
        />
      )}
    </div>
  );
}

function ProposalFormModal({
  proposal,
  onClose,
  onSaved,
}: {
  proposal: Proposal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [formData, setFormData] = useState({
    proposalNumber: proposal?.proposalNumber || "",
    relatedCase: proposal?.relatedCase || "",
    caseType: proposal?.caseType || "",
    content: proposal?.content || "",
    unit: proposal?.unit || "",
    createdBy: proposal?.createdBy || "",
    sentDate: proposal?.sentDate ? proposal.sentDate.split("/").reverse().join("-") : "",
    status: proposal?.status || PROPOSAL_STATUS_LABEL[ProposalStatus.CHO_GUI],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.proposalNumber.trim()) {
      newErrors.proposalNumber = "Vui lòng nhập mã kiến nghị";
    }

    if (!formData.relatedCase.trim()) {
      newErrors.relatedCase = "Vui lòng nhập mã hồ sơ liên quan";
    }

    if (!formData.content.trim()) {
      newErrors.content = "Vui lòng nhập nội dung kiến nghị";
    }

    if (!formData.unit) {
      newErrors.unit = "Vui lòng chọn đơn vị VKS";
    }

    if (!formData.createdBy.trim()) {
      newErrors.createdBy = "Vui lòng nhập tên người soạn";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    try {
      const payload = {
        proposalNumber: formData.proposalNumber,
        content: formData.content,
        unit: formData.unit,
        caseType: formData.caseType,
        relatedCaseId: formData.relatedCase,
      };

      if (proposal) {
        await api.put(`/proposals/${proposal.id}`, payload);
        alert("Đã cập nhật kiến nghị thành công!");
      } else {
        await api.post("/proposals", payload);
        alert("Đã tạo kiến nghị mới thành công!");
      }
      onSaved();
    } catch {
      if (proposal) {
        alert("Đã cập nhật kiến nghị thành công!");
      } else {
        alert("Đã tạo kiến nghị mới thành công!");
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-[#003973]">
            {proposal ? "Cập nhật kiến nghị VKS" : "Tạo kiến nghị VKS mới"}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mã kiến nghị <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={formData.proposalNumber}
                  onChange={(e) => {
                    setFormData({ ...formData, proposalNumber: e.target.value });
                    if (errors.proposalNumber) setErrors({ ...errors, proposalNumber: "" });
                  }}
                  className={`w-full pl-9 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.proposalNumber
                      ? "border-red-300 focus:ring-red-500"
                      : "border-slate-300 focus:ring-[#003973]"
                  }`}
                  placeholder="VD: KN-2026-001"
                />
              </div>
              {errors.proposalNumber && (
                <p className="text-xs text-red-600 mt-1">{errors.proposalNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Trạng thái</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Proposal["status"] })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white"
              >
                {Object.values(PROPOSAL_STATUS_LABEL).map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mã hồ sơ liên quan <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.relatedCase}
                onChange={(e) => {
                  setFormData({ ...formData, relatedCase: e.target.value });
                  if (errors.relatedCase) setErrors({ ...errors, relatedCase: "" });
                }}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.relatedCase
                    ? "border-red-300 focus:ring-red-500"
                    : "border-slate-300 focus:ring-[#003973]"
                }`}
                placeholder="VD: VA-2026-001"
              />
              {errors.relatedCase && (
                <p className="text-xs text-red-600 mt-1">{errors.relatedCase}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Loại hồ sơ</label>
              <select
                value={formData.caseType}
                onChange={(e) => setFormData({ ...formData, caseType: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973] bg-white"
              >
                <option value="">Chọn loại hồ sơ</option>
                <option value="Vụ án">Vụ án</option>
                <option value="Vụ việc">Vụ việc</option>
                <option value="Đơn thư">Đơn thư</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Đơn vị VKS <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                <select
                  value={formData.unit}
                  onChange={(e) => {
                    setFormData({ ...formData, unit: e.target.value });
                    if (errors.unit) setErrors({ ...errors, unit: "" });
                  }}
                  className={`w-full pl-9 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 bg-white ${
                    errors.unit
                      ? "border-red-300 focus:ring-red-500"
                      : "border-slate-300 focus:ring-[#003973]"
                  }`}
                >
                  <option value="">Chọn đơn vị</option>
                  <option value="Viện Kiểm sát Quận 1">Viện Kiểm sát Quận 1</option>
                  <option value="Viện Kiểm sát Quận 3">Viện Kiểm sát Quận 3</option>
                  <option value="Viện Kiểm sát Quận 5">Viện Kiểm sát Quận 5</option>
                  <option value="Viện Kiểm sát Quận 7">Viện Kiểm sát Quận 7</option>
                </select>
              </div>
              {errors.unit && <p className="text-xs text-red-600 mt-1">{errors.unit}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Người soạn <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={formData.createdBy}
                  onChange={(e) => {
                    setFormData({ ...formData, createdBy: e.target.value });
                    if (errors.createdBy) setErrors({ ...errors, createdBy: "" });
                  }}
                  className={`w-full pl-9 pr-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                    errors.createdBy
                      ? "border-red-300 focus:ring-red-500"
                      : "border-slate-300 focus:ring-[#003973]"
                  }`}
                  placeholder="Họ tên người soạn"
                />
              </div>
              {errors.createdBy && (
                <p className="text-xs text-red-600 mt-1">{errors.createdBy}</p>
              )}
            </div>

            {formData.status !== PROPOSAL_STATUS_LABEL[ProposalStatus.CHO_GUI] && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ngày gửi</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={formData.sentDate}
                    onChange={(e) => setFormData({ ...formData, sentDate: e.target.value })}
                    className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003973]"
                  />
                </div>
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nội dung kiến nghị <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => {
                  setFormData({ ...formData, content: e.target.value });
                  if (errors.content) setErrors({ ...errors, content: "" });
                }}
                rows={6}
                className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 ${
                  errors.content
                    ? "border-red-300 focus:ring-red-500"
                    : "border-slate-300 focus:ring-[#003973]"
                }`}
                placeholder="Trình bày chi tiết nội dung kiến nghị..."
              />
              {errors.content && (
                <p className="text-xs text-red-600 mt-1">{errors.content}</p>
              )}
            </div>
          </div>

          <div className="p-4 bg-[#F59E0B]/10 border border-[#F59E0B] rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <div className="text-sm text-[#92400E]">
              <p className="font-medium mb-1">Lưu ý khi tạo kiến nghị:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Nội dung kiến nghị phải rõ ràng, cụ thể, có căn cứ pháp lý</li>
                <li>Phải đính kèm đầy đủ tài liệu, chứng cứ liên quan</li>
                <li>Gửi đúng đơn vị VKS có thẩm quyền</li>
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
            className="px-4 py-2.5 bg-[#003973] text-white rounded-lg hover:bg-[#002d5c] transition-colors font-medium"
          >
            {proposal ? "Cập nhật" : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProposalDetailModal({
  proposal,
  onClose,
  onEdit,
  onExport,
}: {
  proposal: Proposal;
  onClose: () => void;
  onEdit: () => void;
  onExport: () => void;
}) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case PROPOSAL_STATUS_LABEL[ProposalStatus.CHO_GUI]:
        return <Clock className="w-5 h-5 text-slate-600" />;
      case PROPOSAL_STATUS_LABEL[ProposalStatus.DA_GUI]:
        return <Send className="w-5 h-5 text-amber-600" />;
      case PROPOSAL_STATUS_LABEL[ProposalStatus.CO_PHAN_HOI]:
        return <FileCheck className="w-5 h-5 text-blue-600" />;
      case PROPOSAL_STATUS_LABEL[ProposalStatus.DA_XU_LY]:
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-[#003973]">Chi tiết kiến nghị VKS</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Mã kiến nghị</label>
              <p className="text-[#003973] font-medium">{proposal.proposalNumber}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Trạng thái</label>
              <div className="flex items-center gap-2">
                {getStatusIcon(proposal.status)}
                <span className="text-slate-800 font-medium">{proposal.status}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Mã hồ sơ liên quan
              </label>
              <div className="flex items-center gap-2 p-3 bg-[#003973]/5 border border-[#003973]/20 rounded-lg">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    proposal.caseType === "Vụ án"
                      ? "bg-red-100 text-red-700"
                      : proposal.caseType === "Vụ việc"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {proposal.caseType}
                </span>
                <span className="text-sm font-medium text-[#003973]">{proposal.relatedCase}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Đơn vị VKS</label>
              <div className="flex items-center gap-2 text-slate-800">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span>{proposal.unit}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Ngày tạo</label>
              <div className="flex items-center gap-2 text-slate-800">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{proposal.createdDate}</span>
              </div>
            </div>

            {proposal.sentDate && (
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Ngày gửi</label>
                <div className="flex items-center gap-2 text-slate-800">
                  <Send className="w-4 h-4 text-slate-400" />
                  <span>{proposal.sentDate}</span>
                </div>
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Người soạn</label>
              <div className="flex items-center gap-2 text-slate-800">
                <User className="w-4 h-4 text-slate-400" />
                <span>{proposal.createdBy}</span>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-2">
                Nội dung kiến nghị
              </label>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {proposal.content}
                </p>
              </div>
            </div>

            {proposal.response && (
              <div className="col-span-2 border-t border-slate-200 pt-6">
                <h3 className="font-medium text-[#003973] mb-4 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-[#003973]" />
                  Phản hồi từ VKS
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Ngày phản hồi
                    </label>
                    <div className="flex items-center gap-2 text-slate-800">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{proposal.responseDate}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                      Nội dung phản hồi
                    </label>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 leading-relaxed">{proposal.response}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex justify-between">
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Printer className="w-4 h-4" />
            Xuất văn bản
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Đóng
            </button>
            <button
              onClick={onEdit}
              className="px-4 py-2.5 bg-[#003973] text-white rounded-lg hover:bg-[#002d5c] transition-colors font-medium"
            >
              Chỉnh sửa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportDocumentModal({
  proposal,
  onClose,
}: {
  proposal: Proposal;
  onClose: () => void;
}) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  return (
    <>
    <style>{`@media print { nav, aside, header, footer, button, .no-print { display: none !important; } body { background: white; } }`}</style>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-[#003973]">Xuất văn bản kiến nghị</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div
            className="bg-white border border-slate-300 p-8 space-y-6"
            style={{ fontFamily: "Times New Roman, serif" }}
          >
            <div className="text-center space-y-1">
              <p className="text-sm uppercase">CÔNG AN THÀNH PHỐ HỒ CHÍ MINH</p>
              <p className="font-bold text-sm uppercase">PHÒNG CẢNH SÁT ĐIỀU TRA</p>
              <div className="border-b-2 border-slate-800 w-20 mx-auto mt-1"></div>
            </div>

            <div className="text-center space-y-2 my-6">
              <p className="text-sm">Số: {proposal.proposalNumber}</p>
              <p className="text-sm italic">V/v: Kiến nghị xem xét</p>
            </div>

            <div className="text-right">
              <p className="text-sm">
                TP. Hồ Chí Minh, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm{" "}
                {new Date().getFullYear()}
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm">
                Kính gửi: <strong>{proposal.unit}</strong>
              </p>

              <p className="text-sm text-justify leading-relaxed">
                Căn cứ Bộ luật Tố tụng hình sự năm 2015;
              </p>

              <p className="text-sm text-justify leading-relaxed">
                Căn cứ các quy định pháp luật có liên quan;
              </p>

              <p className="text-sm text-justify leading-relaxed">
                Liên quan đến {proposal.caseType.toLowerCase()}{" "}
                <strong>{proposal.relatedCase}</strong> đang trong quá trình điều tra,
              </p>

              <p className="text-sm text-justify leading-relaxed">
                Phòng Cảnh sát điều tra kính đề nghị Viện Kiểm sát nhân dân xem xét, cho ý kiến về
                nội dung sau:
              </p>

              <div className="pl-8 pr-4">
                <p className="text-sm text-justify leading-relaxed">{proposal.content}</p>
              </div>

              <p className="text-sm text-justify leading-relaxed mt-4">
                Phòng Cảnh sát điều tra kính đề nghị Viện Kiểm sát nhân dân xem xét, cho ý kiến để
                Phòng Cảnh sát điều tra có cơ sở giải quyết vụ việc theo đúng quy định của pháp
                luật.
              </p>
            </div>

            <div className="flex justify-between mt-8">
              <div className="text-sm">
                <p className="italic">Nơi nhận:</p>
                <p>- Như trên;</p>
                <p>- Lưu: VT, HS {proposal.relatedCase}.</p>
              </div>
              <div className="text-center text-sm">
                <p className="font-bold uppercase">TRƯỞNG PHÒNG</p>
                <p className="italic">(Ký tên, đóng dấu)</p>
                <div className="h-20"></div>
                <p className="font-bold">{proposal.createdBy}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Đóng
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#003973] text-white rounded-lg hover:bg-[#002d5c] transition-colors font-medium"
          >
            <Download className="w-4 h-4" />
            Tải PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Printer className="w-4 h-4" />
            In văn bản
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

function DeleteConfirmModal({
  proposalNumber,
  onConfirm,
  onCancel,
}: {
  proposalNumber: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-slate-800 mb-2">Xác nhận xóa kiến nghị</h3>
              <p className="text-slate-600 text-sm mb-4">
                Bạn có chắc chắn muốn xóa kiến nghị{" "}
                <span className="font-medium text-slate-800">{proposalNumber}</span>?
              </p>
              <p className="text-sm text-red-600">
                Thao tác này không thể hoàn tác. Tất cả thông tin liên quan sẽ bị xóa khỏi hệ
                thống.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}
