import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { ArrowLeft, Save, AlertCircle, Calendar, FileText, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { FKSelect, type FKOption } from "@/components/FKSelect";
import { getPhaseForStatus } from "@/constants/incident-phases";

interface FormData {
  name: string;
  incidentType: string;
  description: string;
  fromDate: string;
  toDate: string;
  deadline: string;
  doiTuongCaNhan: string;
  doiTuongToChuc: string;
  loaiDonVu: string;
  benVu: string;
  donViGiaiQuyet: string;
  ngayDeXuat: string;
  sdtNguoiToGiac: string;
  diaChiNguoiToGiac: string;
  cmndNguoiToGiac: string;
  diaChiXayRa: string;
  canBoNhapId: string;
  investigatorId: string;
  ketQuaXuLy: string;
  soQuyetDinh: string;
  ngayQuyetDinh: string;
  nguoiQuyetDinh: string;
  lyDoKhongKhoiTo: string;
  lyDoTamDinhChi: string;
  tinhTrangThoiHieu: string;
  tinhTrangHoSo: string;
}

const INITIAL_FORM: FormData = {
  name: "",
  incidentType: "",
  description: "",
  fromDate: "",
  toDate: "",
  deadline: "",
  doiTuongCaNhan: "",
  doiTuongToChuc: "",
  loaiDonVu: "",
  benVu: "",
  donViGiaiQuyet: "",
  ngayDeXuat: "",
  sdtNguoiToGiac: "",
  diaChiNguoiToGiac: "",
  cmndNguoiToGiac: "",
  diaChiXayRa: "",
  canBoNhapId: "",
  investigatorId: "",
  ketQuaXuLy: "",
  soQuyetDinh: "",
  ngayQuyetDinh: "",
  nguoiQuyetDinh: "",
  lyDoKhongKhoiTo: "",
  lyDoTamDinhChi: "",
  tinhTrangThoiHieu: "",
  tinhTrangHoSo: "",
};

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children,
  testId,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm" data-testid={testId}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full border-b border-slate-200 px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <h2 className="font-bold text-slate-800">{title}</h2>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-slate-500" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-500" />
        )}
      </button>
      {expanded && <div className="p-6 space-y-4">{children}</div>}
    </div>
  );
}

export function IncidentFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [userOptions, setUserOptions] = useState<FKOption[]>([]);
  const [recordUpdatedAt, setRecordUpdatedAt] = useState<string | null>(null);

  // Section expanded states - compute defaults based on mode and status
  const currentPhase = getPhaseForStatus(currentStatus);
  const [section1Open, setSection1Open] = useState(true);
  const [section2Open, setSection2Open] = useState(false);
  const [section3Open, setSection3Open] = useState(false);
  const [section4Open, setSection4Open] = useState(false);

  // Load users for investigator / canBoNhap pickers
  useEffect(() => {
    api
      .get<{ success: boolean; data: { id: string; firstName: string; lastName: string }[] }>(
        "/admin/users",
        { params: { limit: 200 } },
      )
      .then((res) => {
        const users = res.data.data ?? [];
        setUserOptions(users.map((u) => ({ value: u.id, label: `${u.lastName} ${u.firstName}` })));
      })
      .catch(() => setUserOptions([]));
  }, []);

  // Fetch existing data in edit mode
  useEffect(() => {
    if (!isEditMode || !id) return;
    setIsLoadingData(true);
    api.get<{ success: boolean; data: Record<string, unknown> }>(`/incidents/${id}`)
      .then((res) => {
        const d = res.data.data;
        if (d) {
          const status = (d.status as string) ?? "";
          setCurrentStatus(status);
          setFormData({
            name: (d.name as string) ?? "",
            incidentType: (d.incidentType as string) ?? "",
            description: (d.description as string) ?? "",
            fromDate: d.fromDate ? String(d.fromDate).split("T")[0] : "",
            toDate: d.toDate ? String(d.toDate).split("T")[0] : "",
            deadline: d.deadline ? String(d.deadline).split("T")[0] : "",
            doiTuongCaNhan: (d.doiTuongCaNhan as string) ?? "",
            doiTuongToChuc: (d.doiTuongToChuc as string) ?? "",
            loaiDonVu: (d.loaiDonVu as string) ?? "",
            benVu: (d.benVu as string) ?? "",
            donViGiaiQuyet: (d.donViGiaiQuyet as string) ?? "",
            ngayDeXuat: d.ngayDeXuat ? String(d.ngayDeXuat).split("T")[0] : "",
            sdtNguoiToGiac: (d.sdtNguoiToGiac as string) ?? "",
            diaChiNguoiToGiac: (d.diaChiNguoiToGiac as string) ?? "",
            cmndNguoiToGiac: (d.cmndNguoiToGiac as string) ?? "",
            diaChiXayRa: (d.diaChiXayRa as string) ?? "",
            canBoNhapId: (d.canBoNhapId as string) ?? "",
            investigatorId: (d.investigatorId as string) ?? "",
            ketQuaXuLy: (d.ketQuaXuLy as string) ?? "",
            soQuyetDinh: (d.soQuyetDinh as string) ?? "",
            ngayQuyetDinh: d.ngayQuyetDinh ? String(d.ngayQuyetDinh).split("T")[0] : "",
            nguoiQuyetDinh: (d.nguoiQuyetDinh as string) ?? "",
            lyDoKhongKhoiTo: (d.lyDoKhongKhoiTo as string) ?? "",
            lyDoTamDinhChi: (d.lyDoTamDinhChi as string) ?? "",
            tinhTrangThoiHieu: (d.tinhTrangThoiHieu as string) ?? "",
            tinhTrangHoSo: (d.tinhTrangHoSo as string) ?? "",
          });
          setRecordUpdatedAt((d.updatedAt as string) ?? null);
          // Auto-expand sections based on phase
          const phase = getPhaseForStatus(status);
          setSection2Open(true); // always expand in edit mode
          setSection3Open(phase === "ket-qua");
          setSection4Open(phase === "tam-dinh-chi");
        }
      })
      .catch(() => {
        setErrors(["Không thể tải dữ liệu vụ việc"]);
      })
      .finally(() => setIsLoadingData(false));
  }, [id, isEditMode]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];
    if (!formData.name.trim() || formData.name.length < 5) newErrors.push("Tên vụ việc phải có ít nhất 5 ký tự");
    if (formData.fromDate && formData.toDate && new Date(formData.fromDate) > new Date(formData.toDate)) newErrors.push("Từ ngày không được lớn hơn Đến ngày (EC-05)");
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateForm()) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setIsSubmitting(true);
    try {
      // Build payload explicitly — only fields that exist in CreateIncidentDto
      // / UpdateIncidentDto. Empty strings → undefined so optional fields
      // are omitted rather than sent as "".
      const s = (v: string) => v || undefined;
      const payload = {
        name: formData.name,
        incidentType: s(formData.incidentType),
        description: s(formData.description),
        fromDate: s(formData.fromDate),
        toDate: s(formData.toDate),
        deadline: s(formData.deadline),
        investigatorId: s(formData.investigatorId),
        canBoNhapId: s(formData.canBoNhapId),
        doiTuongCaNhan: s(formData.doiTuongCaNhan),
        doiTuongToChuc: s(formData.doiTuongToChuc),
        loaiDonVu: s(formData.loaiDonVu),
        benVu: s(formData.benVu),
        donViGiaiQuyet: s(formData.donViGiaiQuyet),
        ngayDeXuat: s(formData.ngayDeXuat),
        sdtNguoiToGiac: s(formData.sdtNguoiToGiac),
        diaChiNguoiToGiac: s(formData.diaChiNguoiToGiac),
        cmndNguoiToGiac: s(formData.cmndNguoiToGiac),
        diaChiXayRa: s(formData.diaChiXayRa),
        soQuyetDinh: s(formData.soQuyetDinh),
        ngayQuyetDinh: s(formData.ngayQuyetDinh),
        ketQuaXuLy: s(formData.ketQuaXuLy),
        nguoiQuyetDinh: s(formData.nguoiQuyetDinh),
        lyDoKhongKhoiTo: s(formData.lyDoKhongKhoiTo),
        lyDoTamDinhChi: s(formData.lyDoTamDinhChi),
        tinhTrangHoSo: s(formData.tinhTrangHoSo),
        tinhTrangThoiHieu: s(formData.tinhTrangThoiHieu),
      };
      if (isEditMode) await api.put(`/incidents/${id}`, { ...payload, expectedUpdatedAt: recordUpdatedAt ?? undefined });
      else await api.post('/incidents', payload);
      navigate("/vu-viec");
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setErrors(["Vụ việc đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang để xem phiên bản mới nhất trước khi chỉnh sửa."]);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
        if (Array.isArray(msg)) setErrors(msg); else if (typeof msg === "string") setErrors([msg]); else setErrors(["Có lỗi xảy ra"]);
      }
    } finally { setIsSubmitting(false); }
  };

  const handleCancel = () => { if (confirm("Bạn có chắc muốn hủy? Dữ liệu chưa lưu sẽ mất.")) navigate("/vu-viec"); };
  const update = (field: keyof FormData, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const inputClass = "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-slate-700 mb-2";

  if (isLoadingData) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-3 animate-spin" />
          <p className="text-slate-500 font-medium">Đang tải dữ liệu vụ việc...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="incident-form-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/vu-viec")} className="p-2 hover:bg-slate-100 rounded-lg" data-testid="btn-back"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{isEditMode ? "Cập nhật Vụ việc" : "Thêm mới Vụ việc"}</h1>
            <p className="text-slate-600 text-sm mt-1">{isEditMode ? `Chỉnh sửa vụ việc ${id}` : "Nhập thông tin vụ việc mới"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleCancel} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50" data-testid="btn-cancel-top">Hủy</button>
          <button onClick={() => void handleSubmit()} disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50" data-testid="btn-save-top">
            <Save className="w-4 h-4" />{isEditMode ? "Cập nhật" : "Lưu vụ việc"}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="validation-errors">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div><h3 className="font-medium text-red-800 mb-2">Vui lòng kiểm tra:</h3><ul className="list-disc list-inside">{errors.map((e, i) => <li key={i} className="text-sm text-red-700">{e}</li>)}</ul></div>
          </div>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* Section 1: Tiep nhan nguon tin */}
        <CollapsibleSection
          title="Tiếp nhận nguồn tin"
          expanded={section1Open}
          onToggle={() => setSection1Open(!section1Open)}
          testId="section-tiep-nhan"
        >
          <div>
            <label className={labelClass}>Tên vụ việc <span className="text-red-500">*</span></label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={formData.name} onChange={(e) => update("name", e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nhập tên vụ việc" data-testid="field-name" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FKSelect
                label="Loại vụ việc"
                masterClassType="01"
                value={formData.incidentType}
                onChange={(v) => update("incidentType", v)}
                placeholder="Chọn loại vụ việc"
                testId="field-incidentType"
              />
            </div>
            <div>
              <label className={labelClass}>Loại nguồn tin (Điều 144 BLTTHS)</label>
              <select value={formData.loaiDonVu} onChange={(e) => update("loaiDonVu", e.target.value)}
                className={inputClass} data-testid="field-loaiDonVu">
                <option value="">-- Chọn loại nguồn tin --</option>
                <option value="TO_GIAC">Tố giác của cá nhân (khoản 1a)</option>
                <option value="TIN_BAO">Tin báo của cơ quan, tổ chức (khoản 1b)</option>
                <option value="KIEN_NGHI_KHOI_TO">Kiến nghị khởi tố (khoản 1c)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Người tố giác/báo tin</label>
              <input type="text" value={formData.benVu} onChange={(e) => update("benVu", e.target.value)}
                className={inputClass} placeholder="Họ tên người tố giác hoặc đại diện cơ quan báo tin" data-testid="field-benVu" />
            </div>
            <div>
              <label className={labelClass}>SĐT người tố giác</label>
              <input type="text" value={formData.sdtNguoiToGiac} onChange={(e) => update("sdtNguoiToGiac", e.target.value)}
                className={inputClass} placeholder="Số điện thoại" data-testid="field-sdtNguoiToGiac" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Địa chỉ người tố giác</label>
              <input type="text" value={formData.diaChiNguoiToGiac} onChange={(e) => update("diaChiNguoiToGiac", e.target.value)}
                className={inputClass} placeholder="Địa chỉ thường trú" data-testid="field-diaChiNguoiToGiac" />
            </div>
            <div>
              <label className={labelClass}>CCCD người tố giác</label>
              <input type="text" value={formData.cmndNguoiToGiac} onChange={(e) => update("cmndNguoiToGiac", e.target.value)}
                className={inputClass} placeholder="Số CCCD/CMND" data-testid="field-cmndNguoiToGiac" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Đối tượng bị tố giác</label>
              <input type="text" value={formData.doiTuongCaNhan} onChange={(e) => update("doiTuongCaNhan", e.target.value)}
                className={inputClass} placeholder="Họ tên, đặc điểm nhận dạng đối tượng" data-testid="field-doiTuongCaNhan" />
            </div>
            <div>
              <label className={labelClass}>Tổ chức liên quan</label>
              <input type="text" value={formData.doiTuongToChuc} onChange={(e) => update("doiTuongToChuc", e.target.value)}
                className={inputClass} placeholder="Tên tổ chức liên quan (nếu có)" data-testid="field-doiTuongToChuc" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Tóm tắt nội dung vụ việc</label>
            <textarea value={formData.description} onChange={(e) => update("description", e.target.value)} rows={4}
              className={inputClass} placeholder="Tóm tắt nội dung, diễn biến vụ việc" data-testid="field-description" />
          </div>
          <div>
            <label className={labelClass}>Địa điểm xảy ra</label>
            <input type="text" value={formData.diaChiXayRa} onChange={(e) => update("diaChiXayRa", e.target.value)}
              className={inputClass} placeholder="Địa điểm xảy ra vụ việc" data-testid="field-diaChiXayRa" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Ngày xảy ra</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" value={formData.fromDate} onChange={(e) => update("fromDate", e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-fromDate" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Ngày phát hiện</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" value={formData.toDate} onChange={(e) => update("toDate", e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-toDate" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Ngày tiếp nhận</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" value={formData.ngayDeXuat} onChange={(e) => update("ngayDeXuat", e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-ngayDeXuat" />
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Section 2: Phan cong & Xac minh */}
        <CollapsibleSection
          title="Phân công & Xác minh"
          expanded={section2Open}
          onToggle={() => setSection2Open(!section2Open)}
          testId="section-phan-cong"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Đơn vị thụ lý</label>
              <input type="text" value={formData.donViGiaiQuyet} onChange={(e) => update("donViGiaiQuyet", e.target.value)}
                className={inputClass} placeholder="Nhập đơn vị thụ lý" data-testid="field-donViGiaiQuyet" />
            </div>
            <div>
              <FKSelect
                label="Điều tra viên"
                value={formData.investigatorId}
                onChange={(v) => update("investigatorId", v)}
                options={userOptions}
                placeholder="Chọn điều tra viên"
                testId="field-investigatorId"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Thời hạn giải quyết</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" value={formData.deadline} onChange={(e) => update("deadline", e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-deadline" />
              </div>
            </div>
            <div>
              <FKSelect
                label="Cán bộ nhập"
                value={formData.canBoNhapId}
                onChange={(v) => update("canBoNhapId", v)}
                options={userOptions}
                placeholder="Chọn cán bộ nhập"
                testId="field-canBoNhapId"
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* Section 3: Ket qua giai quyet */}
        <CollapsibleSection
          title="Kết quả giải quyết"
          expanded={section3Open}
          onToggle={() => setSection3Open(!section3Open)}
          testId="section-ket-qua"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Kết quả giải quyết</label>
              <input type="text" value={formData.ketQuaXuLy} onChange={(e) => update("ketQuaXuLy", e.target.value)}
                className={inputClass} placeholder="Kết quả giải quyết vụ việc" data-testid="field-ketQuaXuLy" />
            </div>
            <div>
              <label className={labelClass}>Số quyết định</label>
              <input type="text" value={formData.soQuyetDinh} onChange={(e) => update("soQuyetDinh", e.target.value)}
                className={inputClass} placeholder="Số quyết định" data-testid="field-soQuyetDinh" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ngày ra quyết định</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" value={formData.ngayQuyetDinh} onChange={(e) => update("ngayQuyetDinh", e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-ngayQuyetDinh" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Người ra quyết định</label>
              <input type="text" value={formData.nguoiQuyetDinh} onChange={(e) => update("nguoiQuyetDinh", e.target.value)}
                className={inputClass} placeholder="Người ra quyết định" data-testid="field-nguoiQuyetDinh" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Lý do không khởi tố (Điều 157 BLTTHS)</label>
            <select value={formData.lyDoKhongKhoiTo} onChange={(e) => update("lyDoKhongKhoiTo", e.target.value)}
              className={inputClass} data-testid="field-lyDoKhongKhoiTo">
              <option value="">-- Chọn căn cứ --</option>
              <option value="KHONG_CO_SU_VIEC">Không có sự việc phạm tội (Đ.157 khoản 1a)</option>
              <option value="HANH_VI_KHONG_CAU_THANH_TOI_PHAM">Hành vi không cấu thành tội phạm (khoản 1b)</option>
              <option value="NGUOI_THUC_HIEN_CHUA_DU_TUOI">Người thực hiện chưa đủ tuổi TNHS (khoản 1c)</option>
              <option value="NGUOI_PHAM_TOI_CHET">Người phạm tội đã chết (khoản 1d)</option>
              <option value="HET_THOI_HIEU">Hết thời hiệu truy cứu TNHS (khoản 1đ)</option>
              <option value="TOI_PHAM_DA_DUOC_XOA_AN_TICH">Tội phạm đã được đại xá (khoản 1e)</option>
              <option value="TRUONG_HOP_KHAC">Trường hợp khác theo quy định BLTTHS (khoản 1g)</option>
            </select>
          </div>
        </CollapsibleSection>

        {/* Section 4: Tam dinh chi & Phuc hoi */}
        <CollapsibleSection
          title="Tạm đình chỉ & Phục hồi"
          expanded={section4Open}
          onToggle={() => setSection4Open(!section4Open)}
          testId="section-tam-dinh-chi"
        >
          <div>
            <label className={labelClass}>Lý do tạm đình chỉ</label>
            <textarea value={formData.lyDoTamDinhChi} onChange={(e) => update("lyDoTamDinhChi", e.target.value)} rows={3}
              className={inputClass} placeholder="Lý do tạm đình chỉ vụ việc" data-testid="field-lyDoTamDinhChi" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Tình trạng thời hiệu</label>
              <input type="text" value={formData.tinhTrangThoiHieu} onChange={(e) => update("tinhTrangThoiHieu", e.target.value)}
                className={inputClass} placeholder="Tình trạng thời hiệu" data-testid="field-tinhTrangThoiHieu" />
            </div>
            <div>
              <label className={labelClass}>Tình trạng hồ sơ</label>
              <input type="text" value={formData.tinhTrangHoSo} onChange={(e) => update("tinhTrangHoSo", e.target.value)}
                className={inputClass} placeholder="Tình trạng hồ sơ" data-testid="field-tinhTrangHoSo" />
            </div>
          </div>
        </CollapsibleSection>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <button type="button" onClick={handleCancel} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50" data-testid="btn-cancel">Hủy</button>
          <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50" data-testid="btn-save">
            <Save className="w-4 h-4" />{isSubmitting ? "Đang lưu..." : isEditMode ? "Cập nhật" : "Lưu vụ việc"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default IncidentFormPage;
