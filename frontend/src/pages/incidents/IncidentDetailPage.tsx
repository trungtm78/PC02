import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { usePermission } from "@/hooks/usePermission";
import { IncidentStatus } from "@/shared/enums/generated";
import {
  ArrowLeft, Edit, Calendar, FileText, User, MapPin, Clock,
  AlertCircle, Loader2,
} from "lucide-react";

const STATUS_LABELS: Record<IncidentStatus, string> = {
  TIEP_NHAN: "Tiếp nhận",
  DANG_XAC_MINH: "Đang xác minh",
  DA_PHAN_CONG: "Đã phân công",
  DA_GIAI_QUYET: "Đã giải quyết",
  TAM_DINH_CHI: "Tạm đình chỉ",
  QUA_HAN: "Quá hạn",
  DA_CHUYEN_VU_AN: "Đã khởi tố",
  KHONG_KHOI_TO: "Không khởi tố",
  CHUYEN_XPHC: "Chuyển XPHC",
  TDC_HET_THOI_HIEU: "TĐC hết thời hiệu",
  TDC_HTH_KHONG_KT: "TĐC HTH không KT",
  PHUC_HOI_NGUON_TIN: "Phục hồi nguồn tin",
  DA_CHUYEN_DON_VI: "Đã chuyển đơn vị",
  DA_NHAP_VU_KHAC: "Đã nhập vụ khác",
  PHAN_LOAI_DAN_SU: "Phân loại dân sự",
};

const STATUS_COLORS: Record<IncidentStatus, string> = {
  TIEP_NHAN: "bg-slate-800 text-white",
  DANG_XAC_MINH: "bg-amber-500 text-white",
  DA_PHAN_CONG: "bg-blue-600 text-white",
  DA_GIAI_QUYET: "bg-green-600 text-white",
  TAM_DINH_CHI: "bg-orange-500 text-white",
  QUA_HAN: "bg-red-600 text-white",
  DA_CHUYEN_VU_AN: "bg-purple-600 text-white",
  KHONG_KHOI_TO: "bg-gray-600 text-white",
  CHUYEN_XPHC: "bg-cyan-600 text-white",
  TDC_HET_THOI_HIEU: "bg-rose-500 text-white",
  TDC_HTH_KHONG_KT: "bg-rose-400 text-white",
  PHUC_HOI_NGUON_TIN: "bg-teal-600 text-white",
  DA_CHUYEN_DON_VI: "bg-indigo-500 text-white",
  DA_NHAP_VU_KHAC: "bg-violet-500 text-white",
  PHAN_LOAI_DAN_SU: "bg-lime-600 text-white",
};

interface IncidentDetail {
  id: string;
  stt?: string;
  name: string;
  incidentType?: string;
  description?: string;
  status: IncidentStatus;
  fromDate?: string;
  toDate?: string;
  deadline?: string;
  diaChiXayRa?: string;
  investigatorId?: string;
  investigator?: { firstName?: string; lastName?: string };
  donViGiaiQuyet?: string;
  ketQuaXuLy?: string;
  soQuyetDinh?: string;
  ngayQuyetDinh?: string;
  nguoiQuyetDinh?: string;
  createdAt?: string;
  updatedAt?: string;
}

function Field({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="text-sm text-slate-800">{value}</span>
    </div>
  );
}

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermission("incidents");

  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<{ success: boolean; data: Record<string, unknown> }>(`/incidents/${id}`)
      .then((res) => {
        const d = res.data.data;
        setIncident({
          id: d.id as string,
          stt: d.stt as string | undefined,
          name: (d.name as string) ?? "",
          incidentType: d.incidentType as string | undefined,
          description: d.description as string | undefined,
          status: d.status as IncidentStatus,
          fromDate: d.fromDate ? String(d.fromDate).split("T")[0] : undefined,
          toDate: d.toDate ? String(d.toDate).split("T")[0] : undefined,
          deadline: d.deadline ? String(d.deadline).split("T")[0] : undefined,
          diaChiXayRa: d.diaChiXayRa as string | undefined,
          investigatorId: d.investigatorId as string | undefined,
          investigator: d.investigator as IncidentDetail["investigator"],
          donViGiaiQuyet: d.donViGiaiQuyet as string | undefined,
          ketQuaXuLy: d.ketQuaXuLy as string | undefined,
          soQuyetDinh: d.soQuyetDinh as string | undefined,
          ngayQuyetDinh: d.ngayQuyetDinh ? String(d.ngayQuyetDinh).split("T")[0] : undefined,
          nguoiQuyetDinh: d.nguoiQuyetDinh as string | undefined,
          createdAt: d.createdAt as string | undefined,
          updatedAt: d.updatedAt as string | undefined,
        });
      })
      .catch(() => setError("Không thể tải thông tin vụ việc."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-2 text-red-600 mb-4">
          <AlertCircle className="w-5 h-5" />
          <span>{error ?? "Không tìm thấy vụ việc."}</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>
      </div>
    );
  }

  const statusLabel = STATUS_LABELS[incident.status] ?? incident.status;
  const statusColor = STATUS_COLORS[incident.status] ?? "bg-slate-600 text-white";
  const investigatorName = incident.investigator
    ? `${incident.investigator.lastName ?? ""} ${incident.investigator.firstName ?? ""}`.trim()
    : undefined;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
            title="Quay lại"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{incident.name}</h1>
            {incident.stt && (
              <p className="text-sm text-slate-500 mt-0.5">Mã: {incident.stt}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor}`}>
            {statusLabel}
          </span>
          {canEdit && (
            <button
              onClick={() => navigate(`/vu-viec/${incident.id}/edit`)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Edit className="w-4 h-4" />
              Chỉnh sửa
            </button>
          )}
        </div>
      </div>

      {/* Main info */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 border-b pb-2">Thông tin chung</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Loại vụ việc" value={incident.incidentType} icon={<FileText className="w-3 h-3" />} />
          <Field label="Địa chỉ xảy ra" value={incident.diaChiXayRa} icon={<MapPin className="w-3 h-3" />} />
          <Field label="Điều tra viên" value={investigatorName} icon={<User className="w-3 h-3" />} />
          <Field label="Đơn vị giải quyết" value={incident.donViGiaiQuyet} />
          <Field label="Ngày bắt đầu" value={incident.fromDate} icon={<Calendar className="w-3 h-3" />} />
          <Field label="Ngày kết thúc" value={incident.toDate} />
          <Field label="Hạn xử lý" value={incident.deadline} icon={<Clock className="w-3 h-3" />} />
        </div>
        {incident.description && (
          <div className="flex flex-col gap-1 pt-2 border-t">
            <span className="text-xs font-medium text-slate-500">Mô tả</span>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{incident.description}</p>
          </div>
        )}
      </div>

      {/* Kết quả xử lý */}
      {(incident.ketQuaXuLy || incident.soQuyetDinh || incident.nguoiQuyetDinh) && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 border-b pb-2">Kết quả xử lý</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kết quả xử lý" value={incident.ketQuaXuLy} />
            <Field label="Số quyết định" value={incident.soQuyetDinh} />
            <Field label="Ngày quyết định" value={incident.ngayQuyetDinh} icon={<Calendar className="w-3 h-3" />} />
            <Field label="Người quyết định" value={incident.nguoiQuyetDinh} icon={<User className="w-3 h-3" />} />
          </div>
        </div>
      )}
    </div>
  );
}
