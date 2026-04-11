import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { ArrowLeft, Save, AlertCircle, Calendar, FileText, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { FKSelect } from "@/components/FKSelect";
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
  // New fields
  sdtNguoiToGiac: string;
  diaChiNguoiToGiac: string;
  cmndNguoiToGiac: string;
  diaChiXayRa: string;
  canBoNhap: string;
  investigatorName: string;
  ketQuaGiaiQuyet: string;
  soQuyetDinh: string;
  ngayQuyetDinh: string;
  nguoiRaQuyetDinh: string;
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
  canBoNhap: "",
  investigatorName: "",
  ketQuaGiaiQuyet: "",
  soQuyetDinh: "",
  ngayQuyetDinh: "",
  nguoiRaQuyetDinh: "",
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

  // Section expanded states - compute defaults based on mode and status
  const currentPhase = getPhaseForStatus(currentStatus);
  const [section1Open, setSection1Open] = useState(true);
  const [section2Open, setSection2Open] = useState(false);
  const [section3Open, setSection3Open] = useState(false);
  const [section4Open, setSection4Open] = useState(false);

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
            canBoNhap: (d.canBoNhap as string) ?? "",
            investigatorName: (d.investigatorName as string) ?? "",
            ketQuaGiaiQuyet: (d.ketQuaGiaiQuyet as string) ?? "",
            soQuyetDinh: (d.soQuyetDinh as string) ?? "",
            ngayQuyetDinh: d.ngayQuyetDinh ? String(d.ngayQuyetDinh).split("T")[0] : "",
            nguoiRaQuyetDinh: (d.nguoiRaQuyetDinh as string) ?? "",
            lyDoKhongKhoiTo: (d.lyDoKhongKhoiTo as string) ?? "",
            lyDoTamDinhChi: (d.lyDoTamDinhChi as string) ?? "",
            tinhTrangThoiHieu: (d.tinhTrangThoiHieu as string) ?? "",
            tinhTrangHoSo: (d.tinhTrangHoSo as string) ?? "",
          });
          // Auto-expand sections based on phase
          const phase = getPhaseForStatus(status);
          setSection2Open(true); // always expand in edit mode
          setSection3Open(phase === "ket-qua");
          setSection4Open(phase === "tam-dinh-chi");
        }
      })
      .catch(() => {
        setErrors(["Kh\u00F4ng th\u1EC3 t\u1EA3i d\u1EEF li\u1EC7u v\u1EE5 vi\u1EC7c"]);
      })
      .finally(() => setIsLoadingData(false));
  }, [id, isEditMode]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];
    if (!formData.name.trim() || formData.name.length < 5) newErrors.push("T\u00EAn v\u1EE5 vi\u1EC7c ph\u1EA3i c\u00F3 \u00EDt nh\u1EA5t 5 k\u00FD t\u1EF1");
    if (formData.fromDate && formData.toDate && new Date(formData.fromDate) > new Date(formData.toDate)) newErrors.push("T\u1EEB ng\u00E0y kh\u00F4ng \u0111\u01B0\u1EE3c l\u1EDBn h\u01A1n \u0110\u1EBFn ng\u00E0y (EC-05)");
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateForm()) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        fromDate: formData.fromDate || undefined,
        toDate: formData.toDate || undefined,
        deadline: formData.deadline || undefined,
        ngayDeXuat: formData.ngayDeXuat || undefined,
        ngayQuyetDinh: formData.ngayQuyetDinh || undefined,
        doiTuongCaNhan: formData.doiTuongCaNhan || undefined,
        doiTuongToChuc: formData.doiTuongToChuc || undefined,
        loaiDonVu: formData.loaiDonVu || undefined,
        benVu: formData.benVu || undefined,
        donViGiaiQuyet: formData.donViGiaiQuyet || undefined,
      };
      if (isEditMode) await api.put(`/incidents/${id}`, payload);
      else await api.post('/incidents', payload);
      navigate("/vu-viec");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      if (Array.isArray(msg)) setErrors(msg); else if (typeof msg === "string") setErrors([msg]); else setErrors(["C\u00F3 l\u1ED7i x\u1EA3y ra"]);
    } finally { setIsSubmitting(false); }
  };

  const handleCancel = () => { if (confirm("B\u1EA1n c\u00F3 ch\u1EAFc mu\u1ED1n h\u1EE7y? D\u1EEF li\u1EC7u ch\u01B0a l\u01B0u s\u1EBD m\u1EA5t.")) navigate("/vu-viec"); };
  const update = (field: keyof FormData, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  const inputClass = "w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-slate-700 mb-2";

  if (isLoadingData) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-3 animate-spin" />
          <p className="text-slate-500 font-medium">\u0110ang t\u1EA3i d\u1EEF li\u1EC7u v\u1EE5 vi\u1EC7c...</p>
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
            <h1 className="text-2xl font-bold text-slate-800">{isEditMode ? "C\u1EADp nh\u1EADt V\u1EE5 vi\u1EC7c" : "Th\u00EAm m\u1EDBi V\u1EE5 vi\u1EC7c"}</h1>
            <p className="text-slate-600 text-sm mt-1">{isEditMode ? `Ch\u1EC9nh s\u1EEDa v\u1EE5 vi\u1EC7c ${id}` : "Nh\u1EADp th\u00F4ng tin v\u1EE5 vi\u1EC7c m\u1EDBi"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleCancel} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50" data-testid="btn-cancel-top">H\u1EE7y</button>
          <button onClick={() => void handleSubmit()} disabled={isSubmitting} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50" data-testid="btn-save-top">
            <Save className="w-4 h-4" />{isEditMode ? "C\u1EADp nh\u1EADt" : "L\u01B0u v\u1EE5 vi\u1EC7c"}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="validation-errors">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div><h3 className="font-medium text-red-800 mb-2">Vui l\u00F2ng ki\u1EC3m tra:</h3><ul className="list-disc list-inside">{errors.map((e, i) => <li key={i} className="text-sm text-red-700">{e}</li>)}</ul></div>
          </div>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* Section 1: Tiep nhan nguon tin */}
        <CollapsibleSection
          title="Ti\u1EBFp nh\u1EADn ngu\u1ED3n tin"
          expanded={section1Open}
          onToggle={() => setSection1Open(!section1Open)}
          testId="section-tiep-nhan"
        >
          <div>
            <label className={labelClass}>T\u00EAn v\u1EE5 vi\u1EC7c <span className="text-red-500">*</span></label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={formData.name} onChange={(e) => update("name", e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nh\u1EADp t\u00EAn v\u1EE5 vi\u1EC7c" data-testid="field-name" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FKSelect
                label="Lo\u1EA1i v\u1EE5 vi\u1EC7c"
                masterClassType="01"
                value={formData.incidentType}
                onChange={(v) => update("incidentType", v)}
                placeholder="Ch\u1ECDn lo\u1EA1i v\u1EE5 vi\u1EC7c"
                testId="field-incidentType"
              />
            </div>
            <div>
              <label className={labelClass}>Lo\u1EA1i ngu\u1ED3n tin</label>
              <input type="text" value={formData.loaiDonVu} onChange={(e) => update("loaiDonVu", e.target.value)}
                className={inputClass} placeholder="T\u1ED1 gi\u00E1c / Tin b\u00E1o / Ki\u1EBFn ngh\u1ECB kh\u1EDFi t\u1ED1" data-testid="field-loaiDonVu" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ng\u01B0\u1EDDi t\u1ED1 gi\u00E1c/b\u00E1o tin</label>
              <input type="text" value={formData.benVu} onChange={(e) => update("benVu", e.target.value)}
                className={inputClass} placeholder="H\u1ECD t\u00EAn ng\u01B0\u1EDDi t\u1ED1 gi\u00E1c ho\u1EB7c \u0111\u1EA1i di\u1EC7n c\u01A1 quan b\u00E1o tin" data-testid="field-benVu" />
            </div>
            <div>
              <label className={labelClass}>S\u0110T ng\u01B0\u1EDDi t\u1ED1 gi\u00E1c</label>
              <input type="text" value={formData.sdtNguoiToGiac} onChange={(e) => update("sdtNguoiToGiac", e.target.value)}
                className={inputClass} placeholder="S\u1ED1 \u0111i\u1EC7n tho\u1EA1i" data-testid="field-sdtNguoiToGiac" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>\u0110\u1ECBa ch\u1EC9 ng\u01B0\u1EDDi t\u1ED1 gi\u00E1c</label>
              <input type="text" value={formData.diaChiNguoiToGiac} onChange={(e) => update("diaChiNguoiToGiac", e.target.value)}
                className={inputClass} placeholder="\u0110\u1ECBa ch\u1EC9 th\u01B0\u1EDDng tr\u00FA" data-testid="field-diaChiNguoiToGiac" />
            </div>
            <div>
              <label className={labelClass}>CCCD ng\u01B0\u1EDDi t\u1ED1 gi\u00E1c</label>
              <input type="text" value={formData.cmndNguoiToGiac} onChange={(e) => update("cmndNguoiToGiac", e.target.value)}
                className={inputClass} placeholder="S\u1ED1 CCCD/CMND" data-testid="field-cmndNguoiToGiac" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>\u0110\u1ED1i t\u01B0\u1EE3ng b\u1ECB t\u1ED1 gi\u00E1c</label>
              <input type="text" value={formData.doiTuongCaNhan} onChange={(e) => update("doiTuongCaNhan", e.target.value)}
                className={inputClass} placeholder="H\u1ECD t\u00EAn, \u0111\u1EB7c \u0111i\u1EC3m nh\u1EADn d\u1EA1ng \u0111\u1ED1i t\u01B0\u1EE3ng" data-testid="field-doiTuongCaNhan" />
            </div>
            <div>
              <label className={labelClass}>T\u1ED5 ch\u1EE9c li\u00EAn quan</label>
              <input type="text" value={formData.doiTuongToChuc} onChange={(e) => update("doiTuongToChuc", e.target.value)}
                className={inputClass} placeholder="T\u00EAn t\u1ED5 ch\u1EE9c li\u00EAn quan (n\u1EBFu c\u00F3)" data-testid="field-doiTuongToChuc" />
            </div>
          </div>
          <div>
            <label className={labelClass}>T\u00F3m t\u1EAFt n\u1ED9i dung v\u1EE5 vi\u1EC7c</label>
            <textarea value={formData.description} onChange={(e) => update("description", e.target.value)} rows={4}
              className={inputClass} placeholder="T\u00F3m t\u1EAFt n\u1ED9i dung, di\u1EC5n bi\u1EBFn v\u1EE5 vi\u1EC7c" data-testid="field-description" />
          </div>
          <div>
            <label className={labelClass}>\u0110\u1ECBa \u0111i\u1EC3m x\u1EA3y ra</label>
            <input type="text" value={formData.diaChiXayRa} onChange={(e) => update("diaChiXayRa", e.target.value)}
              className={inputClass} placeholder="\u0110\u1ECBa \u0111i\u1EC3m x\u1EA3y ra v\u1EE5 vi\u1EC7c" data-testid="field-diaChiXayRa" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Ng\u00E0y x\u1EA3y ra</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" value={formData.fromDate} onChange={(e) => update("fromDate", e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-fromDate" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Ng\u00E0y ph\u00E1t hi\u1EC7n</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" value={formData.toDate} onChange={(e) => update("toDate", e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-toDate" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Ng\u00E0y ti\u1EBFp nh\u1EADn</label>
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
          title="Ph\u00E2n c\u00F4ng & X\u00E1c minh"
          expanded={section2Open}
          onToggle={() => setSection2Open(!section2Open)}
          testId="section-phan-cong"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>\u0110\u01A1n v\u1ECB th\u1EE5 l\u00FD</label>
              <input type="text" value={formData.donViGiaiQuyet} onChange={(e) => update("donViGiaiQuyet", e.target.value)}
                className={inputClass} placeholder="Nh\u1EADp \u0111\u01A1n v\u1ECB th\u1EE5 l\u00FD" data-testid="field-donViGiaiQuyet" />
            </div>
            <div>
              <label className={labelClass}>\u0110i\u1EC1u tra vi\u00EAn</label>
              <input type="text" value={formData.investigatorName} onChange={(e) => update("investigatorName", e.target.value)}
                className={inputClass} placeholder="T\u00EAn \u0111i\u1EC1u tra vi\u00EAn" data-testid="field-investigatorName" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Th\u1EDDi h\u1EA1n gi\u1EA3i quy\u1EBFt</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" value={formData.deadline} onChange={(e) => update("deadline", e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-deadline" />
              </div>
            </div>
            <div>
              <label className={labelClass}>C\u00E1n b\u1ED9 nh\u1EADp</label>
              <input type="text" value={formData.canBoNhap} onChange={(e) => update("canBoNhap", e.target.value)}
                className={inputClass} placeholder="C\u00E1n b\u1ED9 nh\u1EADp li\u1EC7u" data-testid="field-canBoNhap" />
            </div>
          </div>
        </CollapsibleSection>

        {/* Section 3: Ket qua giai quyet */}
        <CollapsibleSection
          title="K\u1EBFt qu\u1EA3 gi\u1EA3i quy\u1EBFt"
          expanded={section3Open}
          onToggle={() => setSection3Open(!section3Open)}
          testId="section-ket-qua"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>K\u1EBFt qu\u1EA3 gi\u1EA3i quy\u1EBFt</label>
              <input type="text" value={formData.ketQuaGiaiQuyet} onChange={(e) => update("ketQuaGiaiQuyet", e.target.value)}
                className={inputClass} placeholder="K\u1EBFt qu\u1EA3 gi\u1EA3i quy\u1EBFt v\u1EE5 vi\u1EC7c" data-testid="field-ketQuaGiaiQuyet" />
            </div>
            <div>
              <label className={labelClass}>S\u1ED1 quy\u1EBFt \u0111\u1ECBnh</label>
              <input type="text" value={formData.soQuyetDinh} onChange={(e) => update("soQuyetDinh", e.target.value)}
                className={inputClass} placeholder="S\u1ED1 quy\u1EBFt \u0111\u1ECBnh" data-testid="field-soQuyetDinh" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Ng\u00E0y ra quy\u1EBFt \u0111\u1ECBnh</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="date" value={formData.ngayQuyetDinh} onChange={(e) => update("ngayQuyetDinh", e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-ngayQuyetDinh" />
              </div>
            </div>
            <div>
              <label className={labelClass}>Ng\u01B0\u1EDDi ra quy\u1EBFt \u0111\u1ECBnh</label>
              <input type="text" value={formData.nguoiRaQuyetDinh} onChange={(e) => update("nguoiRaQuyetDinh", e.target.value)}
                className={inputClass} placeholder="Ng\u01B0\u1EDDi ra quy\u1EBFt \u0111\u1ECBnh" data-testid="field-nguoiRaQuyetDinh" />
            </div>
          </div>
          <div>
            <label className={labelClass}>L\u00FD do kh\u00F4ng kh\u1EDFi t\u1ED1</label>
            <textarea value={formData.lyDoKhongKhoiTo} onChange={(e) => update("lyDoKhongKhoiTo", e.target.value)} rows={3}
              className={inputClass} placeholder="L\u00FD do kh\u00F4ng kh\u1EDFi t\u1ED1 (n\u1EBFu c\u00F3)" data-testid="field-lyDoKhongKhoiTo" />
          </div>
        </CollapsibleSection>

        {/* Section 4: Tam dinh chi & Phuc hoi */}
        <CollapsibleSection
          title="T\u1EA1m \u0111\u00ECnh ch\u1EC9 & Ph\u1EE5c h\u1ED3i"
          expanded={section4Open}
          onToggle={() => setSection4Open(!section4Open)}
          testId="section-tam-dinh-chi"
        >
          <div>
            <label className={labelClass}>L\u00FD do t\u1EA1m \u0111\u00ECnh ch\u1EC9</label>
            <textarea value={formData.lyDoTamDinhChi} onChange={(e) => update("lyDoTamDinhChi", e.target.value)} rows={3}
              className={inputClass} placeholder="L\u00FD do t\u1EA1m \u0111\u00ECnh ch\u1EC9 v\u1EE5 vi\u1EC7c" data-testid="field-lyDoTamDinhChi" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>T\u00ECnh tr\u1EA1ng th\u1EDDi hi\u1EC7u</label>
              <input type="text" value={formData.tinhTrangThoiHieu} onChange={(e) => update("tinhTrangThoiHieu", e.target.value)}
                className={inputClass} placeholder="T\u00ECnh tr\u1EA1ng th\u1EDDi hi\u1EC7u" data-testid="field-tinhTrangThoiHieu" />
            </div>
            <div>
              <label className={labelClass}>T\u00ECnh tr\u1EA1ng h\u1ED3 s\u01A1</label>
              <input type="text" value={formData.tinhTrangHoSo} onChange={(e) => update("tinhTrangHoSo", e.target.value)}
                className={inputClass} placeholder="T\u00ECnh tr\u1EA1ng h\u1ED3 s\u01A1" data-testid="field-tinhTrangHoSo" />
            </div>
          </div>
        </CollapsibleSection>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <button type="button" onClick={handleCancel} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50" data-testid="btn-cancel">H\u1EE7y</button>
          <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50" data-testid="btn-save">
            <Save className="w-4 h-4" />{isSubmitting ? "\u0110ang l\u01B0u..." : isEditMode ? "C\u1EADp nh\u1EADt" : "L\u01B0u v\u1EE5 vi\u1EC7c"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default IncidentFormPage;
