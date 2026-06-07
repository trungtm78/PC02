import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { ArrowLeft, Save, AlertCircle, Calendar, FileText, Loader2, ChevronDown, ChevronRight, Target } from "lucide-react";
import { DocNumberPreviewField } from "@/components/DocNumberPreviewField";
import { documentNumbersApi } from "@/features/document-numbers/api";
import { FKSelect, type FKOption } from "@/components/FKSelect";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { getPhaseForStatus } from "@/constants/incident-phases";
import {
  LY_DO_KHONG_KHOI_TO_OPTIONS,
  LOAI_NGUON_TIN_OPTIONS,
  NGUON_PHAT_TIN_BY_LOAI,
  PHUONG_THUC_TIEP_NHAN_OPTIONS,
  getNguonPhatTinOptions,
} from "@/shared/enums/status-labels";
import type { LoaiNguonTin, NguonPhatTin } from "@/shared/enums/generated";
import { useFormDefaults } from "@/hooks/useFormDefaults";
import { toDateInput } from "@/lib/dates";
import { EntityDocumentsTab } from "@/components/documents/EntityDocumentsTab";

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
  nguonPhatTin: string;
  phuongThucTiepNhan: string;
  benVu: string;
  donViGiaiQuyet: string;     // Text label
  assignedTeamId: string;     // FK Team for DataScope
  ngayDeXuat: string;
  sdtNguoiToGiac: string;
  diaChiNguoiToGiac: string;
  cmndNguoiToGiac: string;
  diaChiXayRa: string;
  canBoNhapId: string;
  investigatorId: string;
  ketQuaXuLy: string;
  // PR 5 v0.38.4.0 — Loại kết quả chuẩn hóa + Căn cứ khởi tố Đ.143 (Wireframe 5)
  loaiKetQua: string;
  canCuKhoiToCode: string;
  soQuyetDinh: string;
  ngayQuyetDinh: string;
  nguoiQuyetDinh: string;
  lyDoKhongKhoiTo: string;
  lyDoTamDinhChi: string;
  tinhTrangThoiHieu: string;
  tinhTrangHoSo: string;
  // Field-parity hệ thống cũ (giai đoạn nguồn tin)
  soQDPhanCongNguonTin: string;
  ngayQDPhanCongNguonTin: string;
  canCuKhongKhoiTo: string;
  canCuTamDinhChi: string;
  phanLoaiDanSuText: string;
  // Field-parity: TĐC + QĐ tạm đình chỉ/phục hồi + công nghệ cao
  tienDoKhacPhucTDC: string;
  tdcKhacPhucLyDoBienPhap: string;
  tdcKhacPhucBienBan: string;
  soQuyetDinhTamDinhChiVV: string;
  ngayTamDinhChiVV: string;
  soQuyetDinhPhucHoiVV: string;
  ngayPhucHoiVV: string;
  laCongNgheCaoVV: boolean;
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
  nguonPhatTin: "",
  phuongThucTiepNhan: "",
  benVu: "",
  donViGiaiQuyet: "",
  assignedTeamId: "",
  ngayDeXuat: "",
  sdtNguoiToGiac: "",
  diaChiNguoiToGiac: "",
  cmndNguoiToGiac: "",
  diaChiXayRa: "",
  canBoNhapId: "",
  investigatorId: "",
  ketQuaXuLy: "",
  loaiKetQua: "",
  canCuKhoiToCode: "",
  soQuyetDinh: "",
  ngayQuyetDinh: "",
  nguoiQuyetDinh: "",
  lyDoKhongKhoiTo: "",
  lyDoTamDinhChi: "",
  tinhTrangThoiHieu: "",
  tinhTrangHoSo: "",
  soQDPhanCongNguonTin: "", ngayQDPhanCongNguonTin: "", canCuKhongKhoiTo: "",
  canCuTamDinhChi: "", phanLoaiDanSuText: "",
  tienDoKhacPhucTDC: "", tdcKhacPhucLyDoBienPhap: "", tdcKhacPhucBienBan: "",
  soQuyetDinhTamDinhChiVV: "", ngayTamDinhChiVV: "", soQuyetDinhPhucHoiVV: "",
  ngayPhucHoiVV: "", laCongNgheCaoVV: false,
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
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [userOptions, setUserOptions] = useState<FKOption[]>([]);
  const [recordUpdatedAt, setRecordUpdatedAt] = useState<string | null>(null);
  const [draftIncidentCode, setDraftIncidentCode] = useState('');
  const [isDraftLoading, setIsDraftLoading] = useState(!isEditMode);

  // Section expanded states
  const [section1Open, setSection1Open] = useState(true);
  const [section2Open, setSection2Open] = useState(false);
  const [section3Open, setSection3Open] = useState(false);
  const [section4Open, setSection4Open] = useState(false);

  const defaults = useFormDefaults();

  // v0.42 — Fetch draft incident code preview on create mode mount.
  useEffect(() => {
    if (isEditMode) return;
    setIsDraftLoading(true);
    documentNumbersApi.draft('INCIDENT')
      .then((r) => setDraftIncidentCode(r.previewNumber))
      .catch((err) => console.error('draft fetch failed:', err))
      .finally(() => setIsDraftLoading(false));
  }, [isEditMode]);

  // v0.31.0.0 — Cascading guard: khi user đổi `loaiDonVu`, reset `nguonPhatTin`
  // nếu giá trị đang chọn không thuộc group mới. UX để user không submit value
  // mismatch (defense-in-depth — BE validator vẫn reject nếu UI bị bypass).
  useEffect(() => {
    setFormData((prev) => {
      if (!prev.loaiDonVu || !prev.nguonPhatTin) return prev;
      const allowed = NGUON_PHAT_TIN_BY_LOAI[prev.loaiDonVu as LoaiNguonTin] ?? [];
      if (allowed.includes(prev.nguonPhatTin as NguonPhatTin)) return prev;
      return { ...prev, nguonPhatTin: "" };
    });
  }, [formData.loaiDonVu]);

  // Apply defaults on create mode (today, current user, primary team).
  // `prev.x ||` guard preserves user typing if they type before profile loads.
  useEffect(() => {
    if (isEditMode || !defaults.isLoaded) return;
    setFormData((prev) => ({
      ...prev,
      ngayDeXuat:     prev.ngayDeXuat     || defaults.today,
      canBoNhapId:    prev.canBoNhapId    || defaults.userId           || "",
      investigatorId: prev.investigatorId || defaults.userId           || "",
      donViGiaiQuyet: prev.donViGiaiQuyet || defaults.primaryTeamName  || "",
      assignedTeamId: prev.assignedTeamId || defaults.primaryTeamId    || "",
    }));
  }, [isEditMode, defaults.isLoaded, defaults.today, defaults.userId, defaults.primaryTeamId, defaults.primaryTeamName]);

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
          setFormData({
            name: (d.name as string) ?? "",
            incidentType: (d.incidentType as string) ?? "",
            description: (d.description as string) ?? "",
            fromDate: toDateInput(d.fromDate as string | null | undefined),
            toDate: toDateInput(d.toDate as string | null | undefined),
            deadline: toDateInput(d.deadline as string | null | undefined),
            doiTuongCaNhan: (d.doiTuongCaNhan as string) ?? "",
            doiTuongToChuc: (d.doiTuongToChuc as string) ?? "",
            loaiDonVu: (d.loaiDonVu as string) ?? "",
            nguonPhatTin: (d.nguonPhatTin as string) ?? "",
            phuongThucTiepNhan: (d.phuongThucTiepNhan as string) ?? "",
            benVu: (d.benVu as string) ?? "",
            donViGiaiQuyet: (d.donViGiaiQuyet as string) ?? "",
            assignedTeamId: (d.assignedTeamId as string) ?? "",
            ngayDeXuat: toDateInput(d.ngayDeXuat as string | null | undefined),
            sdtNguoiToGiac: (d.sdtNguoiToGiac as string) ?? "",
            diaChiNguoiToGiac: (d.diaChiNguoiToGiac as string) ?? "",
            cmndNguoiToGiac: (d.cmndNguoiToGiac as string) ?? "",
            diaChiXayRa: (d.diaChiXayRa as string) ?? "",
            canBoNhapId: (d.canBoNhapId as string) ?? "",
            investigatorId: (d.investigatorId as string) ?? "",
            ketQuaXuLy: (d.ketQuaXuLy as string) ?? "",
            loaiKetQua: (d.loaiKetQua as string) ?? "",
            canCuKhoiToCode: (d.canCuKhoiToCode as string) ?? "",
            soQuyetDinh: (d.soQuyetDinh as string) ?? "",
            ngayQuyetDinh: toDateInput(d.ngayQuyetDinh as string | null | undefined),
            nguoiQuyetDinh: (d.nguoiQuyetDinh as string) ?? "",
            lyDoKhongKhoiTo: (d.lyDoKhongKhoiTo as string) ?? "",
            lyDoTamDinhChi: (d.lyDoTamDinhChi as string) ?? "",
            tinhTrangThoiHieu: (d.tinhTrangThoiHieu as string) ?? "",
            tinhTrangHoSo: (d.tinhTrangHoSo as string) ?? "",
            soQDPhanCongNguonTin: (d.soQDPhanCongNguonTin as string) ?? "",
            ngayQDPhanCongNguonTin: toDateInput(d.ngayQDPhanCongNguonTin as string | null | undefined),
            canCuKhongKhoiTo: (d.canCuKhongKhoiTo as string) ?? "",
            canCuTamDinhChi: (d.canCuTamDinhChi as string) ?? "",
            phanLoaiDanSuText: (d.phanLoaiDanSuText as string) ?? "",
            tienDoKhacPhucTDC: (d.tienDoKhacPhucTDC as string) ?? "",
            tdcKhacPhucLyDoBienPhap: (d.tdcKhacPhucLyDoBienPhap as string) ?? "",
            tdcKhacPhucBienBan: (d.tdcKhacPhucBienBan as string) ?? "",
            soQuyetDinhTamDinhChiVV: (d.soQuyetDinhTamDinhChiVV as string) ?? "",
            ngayTamDinhChiVV: toDateInput(d.ngayTamDinhChiVV as string | null | undefined),
            soQuyetDinhPhucHoiVV: (d.soQuyetDinhPhucHoiVV as string) ?? "",
            ngayPhucHoiVV: toDateInput(d.ngayPhucHoiVV as string | null | undefined),
            laCongNgheCaoVV: Boolean(d.laCongNgheCaoVV),
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
        nguonPhatTin: s(formData.nguonPhatTin),
        phuongThucTiepNhan: s(formData.phuongThucTiepNhan),
        benVu: s(formData.benVu),
        donViGiaiQuyet: s(formData.donViGiaiQuyet),
        assignedTeamId: s(formData.assignedTeamId),
        ngayDeXuat: s(formData.ngayDeXuat),
        sdtNguoiToGiac: s(formData.sdtNguoiToGiac),
        diaChiNguoiToGiac: s(formData.diaChiNguoiToGiac),
        cmndNguoiToGiac: s(formData.cmndNguoiToGiac),
        diaChiXayRa: s(formData.diaChiXayRa),
        soQuyetDinh: s(formData.soQuyetDinh),
        ngayQuyetDinh: s(formData.ngayQuyetDinh),
        soQDPhanCongNguonTin: s(formData.soQDPhanCongNguonTin),
        ngayQDPhanCongNguonTin: s(formData.ngayQDPhanCongNguonTin),
        canCuKhongKhoiTo: s(formData.canCuKhongKhoiTo),
        canCuTamDinhChi: s(formData.canCuTamDinhChi),
        phanLoaiDanSuText: s(formData.phanLoaiDanSuText),
        ketQuaXuLy: s(formData.ketQuaXuLy),
        loaiKetQua: s(formData.loaiKetQua),
        canCuKhoiToCode: s(formData.canCuKhoiToCode),
        nguoiQuyetDinh: s(formData.nguoiQuyetDinh),
        lyDoKhongKhoiTo: s(formData.lyDoKhongKhoiTo),
        lyDoTamDinhChi: s(formData.lyDoTamDinhChi),
        tinhTrangHoSo: s(formData.tinhTrangHoSo),
        tinhTrangThoiHieu: s(formData.tinhTrangThoiHieu),
        tienDoKhacPhucTDC: s(formData.tienDoKhacPhucTDC),
        tdcKhacPhucLyDoBienPhap: s(formData.tdcKhacPhucLyDoBienPhap),
        tdcKhacPhucBienBan: s(formData.tdcKhacPhucBienBan),
        soQuyetDinhTamDinhChiVV: s(formData.soQuyetDinhTamDinhChiVV),
        ngayTamDinhChiVV: s(formData.ngayTamDinhChiVV),
        soQuyetDinhPhucHoiVV: s(formData.soQuyetDinhPhucHoiVV),
        ngayPhucHoiVV: s(formData.ngayPhucHoiVV),
        laCongNgheCaoVV: formData.laCongNgheCaoVV || undefined,
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
        setErrors(extractApiError(err).messages);
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
          {!isEditMode && (
            <div>
              <label className={labelClass}>Mã vụ việc</label>
              <DocNumberPreviewField
                inputMode="AUTO"
                value={draftIncidentCode}
                onChange={() => {}}
                loading={isDraftLoading}
              />
            </div>
          )}
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
              <FKSelect
                label="Loại nguồn tin (Điều 144 BLTTHS)"
                value={formData.loaiDonVu}
                onChange={(v) => update("loaiDonVu", v)}
                options={LOAI_NGUON_TIN_OPTIONS}
                placeholder="-- Chọn loại nguồn tin --"
                canCreate={false}
                testId="field-loaiDonVu"
              />
            </div>
          </div>
          {/* v0.31.0.0 — sub-types theo Đ.144 BLTTHS + TT 28/2020/TT-BCA Đ.6 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FKSelect
                label="Nguồn phát tin"
                value={formData.nguonPhatTin}
                onChange={(v) => update("nguonPhatTin", v)}
                options={getNguonPhatTinOptions(formData.loaiDonVu)}
                placeholder={formData.loaiDonVu ? "-- Chọn nguồn phát tin --" : "Vui lòng chọn Loại nguồn tin trước"}
                canCreate={false}
                testId="field-nguonPhatTin"
              />
            </div>
            <div>
              <FKSelect
                label="Phương thức tiếp nhận (TT28 Đ.6)"
                value={formData.phuongThucTiepNhan}
                onChange={(v) => update("phuongThucTiepNhan", v)}
                options={PHUONG_THUC_TIEP_NHAN_OPTIONS}
                placeholder="-- Chọn phương thức tiếp nhận --"
                canCreate={false}
                testId="field-phuongThucTiepNhan"
              />
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
              <PhoneInput value={formData.sdtNguoiToGiac} onValueChange={(v) => update("sdtNguoiToGiac", v)}
                className={inputClass} placeholder="09xx xxx xxx" data-testid="field-sdtNguoiToGiac" />
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
          <div className="flex items-center gap-2">
            <input type="checkbox" id="laCongNgheCaoVV" checked={formData.laCongNgheCaoVV}
              onChange={(e) => setFormData((prev) => ({ ...prev, laCongNgheCaoVV: e.target.checked }))}
              className="w-4 h-4 text-blue-600 border-slate-300 rounded" data-testid="field-laCongNgheCaoVV" />
            <label htmlFor="laCongNgheCaoVV" className="text-sm font-medium text-slate-700">Vụ việc công nghệ cao (CNC)</label>
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

        {/* Section 3: Ket qua giai quyet — PR 5 v0.38.4.0 theo Wireframe 5 plan */}
        <CollapsibleSection
          title="Kết quả xử lý vụ việc"
          expanded={section3Open}
          onToggle={() => setSection3Open(!section3Open)}
          testId="section-ket-qua"
        >
          {/* Loại kết quả (chuẩn hóa enum) + Số quyết định */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Loại kết quả</label>
              <select
                value={formData.loaiKetQua}
                onChange={(e) => update("loaiKetQua", e.target.value)}
                className={inputClass}
                data-testid="field-loaiKetQua"
              >
                <option value="">-- Chọn loại kết quả --</option>
                <option value="KHOI_TO">Khởi tố vụ án</option>
                <option value="KHONG_KHOI_TO">Không khởi tố</option>
                <option value="TAM_DINH_CHI">Tạm đình chỉ</option>
                <option value="CHUYEN_HO_SO">Chuyển hồ sơ cấp khác</option>
                <option value="DINH_CHI">Đình chỉ</option>
                <option value="KHAC">Khác</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Loại kết quả chuẩn hóa cho báo cáo TT28/2020/TT-BCA.
              </p>
            </div>
            <div>
              <label className={labelClass}>Số quyết định</label>
              <input type="text" value={formData.soQuyetDinh} onChange={(e) => update("soQuyetDinh", e.target.value)}
                className={inputClass} placeholder="VD: QD-2026-042" data-testid="field-soQuyetDinh" />
            </div>
            {/* Field-parity hệ thống cũ (giai đoạn nguồn tin) */}
            <div>
              <label className={labelClass}>Số QĐ phân công giải quyết nguồn tin</label>
              <input type="text" value={formData.soQDPhanCongNguonTin} onChange={(e) => update("soQDPhanCongNguonTin", e.target.value)}
                className={inputClass} placeholder="Số QĐ phân công giải quyết nguồn tin" data-testid="field-soQDPhanCongNguonTin" />
            </div>
            <div>
              <label className={labelClass}>Ngày QĐ phân công giải quyết nguồn tin</label>
              <input type="date" value={formData.ngayQDPhanCongNguonTin} onChange={(e) => update("ngayQDPhanCongNguonTin", e.target.value)}
                className={inputClass} data-testid="field-ngayQDPhanCongNguonTin" />
            </div>
            <div>
              <label className={labelClass}>Căn cứ không khởi tố</label>
              <input type="text" value={formData.canCuKhongKhoiTo} onChange={(e) => update("canCuKhongKhoiTo", e.target.value)}
                className={inputClass} placeholder="Căn cứ pháp lý ra QĐ không khởi tố" data-testid="field-canCuKhongKhoiTo" />
            </div>
            <div>
              <label className={labelClass}>Căn cứ tạm đình chỉ nguồn tin</label>
              <input type="text" value={formData.canCuTamDinhChi} onChange={(e) => update("canCuTamDinhChi", e.target.value)}
                className={inputClass} placeholder="Căn cứ tạm đình chỉ nguồn tin" data-testid="field-canCuTamDinhChi" />
            </div>
            <div>
              <label className={labelClass}>Phân loại dân sự (thông báo)</label>
              <input type="text" value={formData.phanLoaiDanSuText} onChange={(e) => update("phanLoaiDanSuText", e.target.value)}
                className={inputClass} placeholder="Số, ngày thông báo phân loại dân sự" data-testid="field-phanLoaiDanSuText" />
            </div>
          </div>

          {/* Mô tả chi tiết (free-form text — giữ field ketQuaXuLy cũ, đổi caption) */}
          <div>
            <label className={labelClass}>Mô tả chi tiết kết quả (tùy chọn)</label>
            <textarea
              value={formData.ketQuaXuLy}
              onChange={(e) => update("ketQuaXuLy", e.target.value)}
              className={inputClass}
              rows={3}
              placeholder="VD: Đã đủ căn cứ khởi tố vụ án theo tin báo từ cá nhân Nguyễn Văn X..."
              data-testid="field-ketQuaXuLy"
            />
            <p className="mt-1 text-xs text-slate-500">
              Bổ sung mô tả chi tiết, ngữ cảnh, ghi chú nội bộ.
            </p>
          </div>

          {/* Ngày + Người ra quyết định */}
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

          {/* 📌 Sub-group Tham chiếu pháp lý — Wireframe 5 plan */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-sm font-medium text-slate-700 mb-3">📌 Tham chiếu pháp lý (tùy chọn — ghi nhận khi cần audit)</p>

            {/* Căn cứ khởi tố (Đ.143 BLTTHS) — code khớp CaseProvenance enum */}
            <FKSelect
              label="Căn cứ khởi tố vụ án (Đ.143 BLTTHS) — nếu khởi tố"
              value={formData.canCuKhoiToCode}
              onChange={(v) => update("canCuKhoiToCode", v)}
              directoryType="CAN_CU_KHOI_TO"
              placeholder="-- Chọn căn cứ (nếu có) --"
              canCreate={false}
              testId="field-canCuKhoiToCode"
            />
            <p className="mt-1 mb-4 text-xs text-slate-500">
              7 căn cứ chuẩn theo BLTTHS Đ.143. Có thể bỏ trống. Khi convert vụ việc → vụ án, giá trị này tự transfer sang Case.caseProvenance.
            </p>

            {/* Lý do không khởi tố Đ.157 — giữ field hiện tại, anh override luôn hiển thị */}
            <FKSelect
              label="Lý do không khởi tố (Điều 157 BLTTHS) — nếu không khởi tố"
              value={formData.lyDoKhongKhoiTo}
              onChange={(v) => update("lyDoKhongKhoiTo", v)}
              options={LY_DO_KHONG_KHOI_TO_OPTIONS}
              placeholder="-- Chọn căn cứ (nếu có) --"
              canCreate={false}
              testId="field-lyDoKhongKhoiTo"
            />
            <p className="mt-1 text-xs text-slate-500">
              8 căn cứ chuẩn theo BLTTHS Đ.157. Luôn hiển thị (pháp lý quan trọng).
            </p>
          </div>

          {/* Entry path 3 — Button "Khởi tố thành vụ án" (anh confirm) */}
          {!isEditMode || !id ? null : (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-sm text-slate-600 mb-3">
                ℹ️ Nếu đã quyết định khởi tố, click nút bên dưới để tạo hồ sơ vụ án:
              </p>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(
                    "Khởi tố vụ án từ vụ việc này?\n\n" +
                    "Sẽ tạo vụ án mới liên kết với vụ việc " + (formData.name || id) + ".\n" +
                    "Bạn có thể bổ sung thông tin chi tiết ở bước sau."
                  )) {
                    // HOTFIX (codex P1): include expectedIncidentUpdatedAt cho optimistic lock
                    const updatedAt = recordUpdatedAt ?? new Date().toISOString();
                    navigate(`/cases/new?linkedIncidentId=${id}&caseProvenance=FROM_INCIDENT&expectedIncidentUpdatedAt=${encodeURIComponent(updatedAt)}`);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium"
                data-testid="incident-form-prosecute-btn"
              >
                <Target className="w-4 h-4" />
                Khởi tố thành vụ án
              </button>
            </div>
          )}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Số QĐ tạm đình chỉ vụ việc</label>
              <input type="text" value={formData.soQuyetDinhTamDinhChiVV} onChange={(e) => update("soQuyetDinhTamDinhChiVV", e.target.value)}
                className={inputClass} placeholder="Số quyết định tạm đình chỉ" data-testid="field-soQuyetDinhTamDinhChiVV" />
            </div>
            <div>
              <label className={labelClass}>Ngày QĐ tạm đình chỉ</label>
              <input type="date" value={formData.ngayTamDinhChiVV} onChange={(e) => update("ngayTamDinhChiVV", e.target.value)}
                className={inputClass} data-testid="field-ngayTamDinhChiVV" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Số QĐ phục hồi vụ việc</label>
              <input type="text" value={formData.soQuyetDinhPhucHoiVV} onChange={(e) => update("soQuyetDinhPhucHoiVV", e.target.value)}
                className={inputClass} placeholder="Số quyết định phục hồi điều tra" data-testid="field-soQuyetDinhPhucHoiVV" />
            </div>
            <div>
              <label className={labelClass}>Ngày QĐ phục hồi</label>
              <input type="date" value={formData.ngayPhucHoiVV} onChange={(e) => update("ngayPhucHoiVV", e.target.value)}
                className={inputClass} data-testid="field-ngayPhucHoiVV" />
            </div>
          </div>
          <div>
            <label className={labelClass}>Tiến độ khắc phục TĐC</label>
            <textarea value={formData.tienDoKhacPhucTDC} onChange={(e) => update("tienDoKhacPhucTDC", e.target.value)} rows={3}
              className={inputClass} placeholder="Mô tả tiến độ khắc phục tạm đình chỉ" data-testid="field-tienDoKhacPhucTDC" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Lý do/biện pháp khắc phục TĐC</label>
              <input type="text" value={formData.tdcKhacPhucLyDoBienPhap} onChange={(e) => update("tdcKhacPhucLyDoBienPhap", e.target.value)}
                className={inputClass} placeholder="Biện pháp khắc phục" data-testid="field-tdcKhacPhucLyDoBienPhap" />
            </div>
            <div>
              <label className={labelClass}>Biên bản khắc phục TĐC</label>
              <input type="text" value={formData.tdcKhacPhucBienBan} onChange={(e) => update("tdcKhacPhucBienBan", e.target.value)}
                className={inputClass} placeholder="Số/ngày biên bản xác nhận khắc phục" data-testid="field-tdcKhacPhucBienBan" />
            </div>
          </div>
        </CollapsibleSection>

        {/* Tài liệu — luôn hiển thị; EntityDocumentsTab tự guard khi chưa có incidentId */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <EntityDocumentsTab entityKind="incident" entityId={id} />
        </div>

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
