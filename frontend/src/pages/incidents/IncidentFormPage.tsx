import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { ArrowLeft, AlertCircle, Calendar, FileText, Loader2, ChevronDown, ChevronRight, Target } from "lucide-react";
import { DynamicLegacyFields } from "@/components/DynamicLegacyFields";
import { LegacyParityFields } from "@/components/LegacyParityFields";
import { LEGACY_PARITY_FIELDS } from "@/shared/legacy/legacyParityFields.generated";
import { LegacyRawPanel } from "@/components/LegacyRawPanel";
import { SaveSplitButton } from "@/features/petitions/components/SaveSplitButton";
import { DynamicExportDocumentsModal } from "@/features/document-templates/components/DynamicExportDocumentsModal";
import { DocNumberPreviewField } from "@/components/DocNumberPreviewField";
import { documentNumbersApi } from "@/features/document-numbers/api";
import { FKSelect, type FKOption } from "@/components/FKSelect";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CatalogSelect } from "@/components/CatalogSelect";
import { CrimeSelect } from "@/components/CrimeSelect";
import { getPhaseForStatus } from "@/constants/incident-phases";
import {
  LOAI_NGUON_TIN_OPTIONS,
  NGUON_PHAT_TIN_BY_LOAI,
  PHUONG_THUC_TIEP_NHAN_OPTIONS,
  getNguonPhatTinOptions,
} from "@/shared/enums/status-labels";
import type { LoaiNguonTin, NguonPhatTin } from "@/shared/enums/generated";
import { useFormDefaults } from "@/hooks/useFormDefaults";
import { useFormShortcuts } from "@/hooks/useFormShortcuts";
import { useFormErrorNavigation } from "@/hooks/useFormErrorNavigation";
import { useDeleteResourceModalSafe } from "@/features/_shared/modals/DeleteResourceModalProvider";
import { IncidentStatus } from "@/shared/enums/generated";
import { EntityDocumentsTab } from "@/components/documents/EntityDocumentsTab";
import { buildIncidentPayload } from './buildIncidentPayload';
import { mergeIncidentApiToFormData } from './mergeIncidentApiToFormData';
import { computeIncidentErrors } from './validate-incident';
import { LegacyTabBody } from "@/components/legacy-form/LegacyTabBody";
import { LEGACY_TAB_LABEL, type LegacyTabId } from "@/features/cases/legacy-form-layout.def";
import { INCIDENT_LEGACY_SPEC, KHOA_NHANH_PHU } from "@/features/incidents/legacy-form-binding";
import { INITIAL_INCIDENT_FORM, type IncidentFormData } from './incident-form.types';
import { TINH_TRANG_OPTIONS, optionsGiuGiaTriLa } from '@/shared/legacy/tinhTrangOptions';


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
  const [legacyRaw, setLegacyRaw] = useState<Record<string, unknown> | null>(null);
  const [metaState, setMetaState] = useState<Record<string, unknown>>({});
  // Cột typed field-parity (di trú hệ cũ) — đọc/ghi cột thật, khác metaState (metadata JSON).
  const [parityState, setParityState] = useState<Record<string, unknown>>({});
  const [formData, setFormData] = useState<IncidentFormData>(INITIAL_INCIDENT_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [tabDangMo, setTabDangMo] = useState<LegacyTabId>("info");

  /**
   * Thay ô chữ trần bằng ô riêng cho hai chỗ hệ mới mạnh hơn hẳn.
   *
   * Bố cục hệ cũ quyết NHÃN, THỨ TỰ và CHỖ ĐỨNG — ba thứ anh yêu cầu giống hệ cũ. Nhưng tội
   * danh của hệ mới tra được bảng 316 điều BLHS, và số điện thoại có kiểm định dạng. Xoá
   * chúng đi để giống hệ cũ là hạ cấp năng lực; giữ đúng chỗ, đúng nhãn, chỉ đổi ruột.
   */
  const oRieng: Partial<Record<string, (label: string) => React.ReactNode>> = {
    crimeChinhId: (label) => (
      <CrimeSelect
        label={label}
        value={formData.crimeChinhId}
        onChange={(v) => update("crimeChinhId", v)}
        testId="field-crimeChinhId"
      />
    ),
    /**
     * Hai ô chọn-nhiều đi theo DANH MỤC ĐỘNG (`CatalogSelect`), không phải danh sách viết
     * cứng: nhãn pháp lý lấy từ registry, thêm căn cứ mới thì ô tự có. Ô chọn-nhiều mặc định
     * của bố cục chỉ dựng được danh sách tĩnh, nên gỡ chúng đi là hạ cấp năng lực — giữ đúng
     * chỗ, đúng nhãn hệ cũ, chỉ đổi ruột.
     */
    lyDoKhongKhoiTo: (label) => (
      <div data-testid="field-lyDoKhongKhoiTo">
        <label className={labelClass}>{label}</label>
        <CatalogSelect
          catalogKey="LY_DO_KHONG_KHOI_TO"
          value={formData.lyDoKhongKhoiTo}
          onChange={(v) => update("lyDoKhongKhoiTo", v as string[])}
        />
      </div>
    ),
    lyDoTamDinhChiVuViec: (label) => (
      <div data-testid="field-lyDoTamDinhChiVuViec">
        <label className={labelClass}>{label}</label>
        <CatalogSelect
          catalogKey="LY_DO_TAM_DINH_CHI_VU_VIEC"
          value={formData.lyDoTamDinhChiVuViec}
          onChange={(v) => update("lyDoTamDinhChiVuViec", v as string[])}
        />
      </div>
    ),
    sdtNguoiToGiac: (label) => (
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
        <PhoneInput
          value={formData.sdtNguoiToGiac}
          onValueChange={(v: string) => update("sdtNguoiToGiac", v)}
          data-testid="field-sdtNguoiToGiac"
        />
      </div>
    ),
  };
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Trạng thái bản ghi (edit) — để gate phím tắt Xóa (F3) theo rule danh sách (chỉ TIEP_NHAN).
  const [recordStatus, setRecordStatus] = useState("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [userOptions, setUserOptions] = useState<FKOption[]>([]);
  const [recordUpdatedAt, setRecordUpdatedAt] = useState<string | null>(null);
  const [draftIncidentCode, setDraftIncidentCode] = useState('');
  const [isDraftLoading, setIsDraftLoading] = useState(!isEditMode);
  // Export chứng từ động (epic vụ việc/vụ án PR3).
  const [exportForId, setExportForId] = useState<string | null>(null);
  const [exportNavigateOnClose, setExportNavigateOnClose] = useState(false);
  // Guard in-flight đồng bộ chống double-submit (đối xứng CaseFormPage, codex P2).
  const savingRef = useRef(false);

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
          setLegacyRaw((d.legacyRaw as Record<string, unknown>) ?? null);
          // Tach doi metadata: khoa nao bo cuc he cu da co o trong tab thi thuoc `legacyExtra`,
          // con lai de panel dong. Cung giu mot khoa o hai vung thi luc gop lai vung ghi sau de
          // vung kia - can bo sua o panel dong, bam Luu, khong doi gi.
          setMetaState(
            Object.fromEntries(
              Object.entries((d.metadata as Record<string, unknown>) ?? {}).filter(
                ([k]) => !KHOA_NHANH_PHU.has(k),
              ),
            ),
          );
          const ps: Record<string, unknown> = {};
          for (const f of LEGACY_PARITY_FIELDS.incident) if (d[f.col] != null) ps[f.col] = d[f.col];
          setParityState(ps);
          setFormData(mergeIncidentApiToFormData(d));
          setRecordUpdatedAt((d.updatedAt as string) ?? null);
          setRecordStatus((d.status as string) ?? "");
          // Auto-expand sections based on phase (fix: dùng status của record vừa tải, không phải biến ngoài rỗng)
          const phase = getPhaseForStatus((d.status as string) ?? "");
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

  // Lỗi kèm testid theo THỨ TỰ hiển thị → dùng chung cho msgs + điều hướng ô lỗi.
  const buildErrors = () => computeIncidentErrors(formData);
  const validateForm = (): boolean => {
    const { msgs } = buildErrors();
    setErrors(msgs);
    return msgs.length === 0;
  };
  // Focus ô lỗi đầu khi lưu + phím "Lỗi tiếp theo" (Shift+Enter) nhảy ô lỗi kế.
  const { focusFirstError, handleFormKeyDown } = useFormErrorNavigation(() => buildErrors().fields);

  // Tách phần LƯU (không điều hướng) → trả { ok, id } để onSave/onSaveAndExport
  // quyết định điều hướng hay mở popup xuất chứng từ động.
  const doSave = async (): Promise<{ ok: boolean; id: string | null }> => {
    if (savingRef.current) return { ok: false, id: null }; // chống lưu chồng lấn
    if (!validateForm()) { if (!focusFirstError()) window.scrollTo({ top: 0, behavior: "smooth" }); return { ok: false, id: null }; }
    savingRef.current = true;
    setIsSubmitting(true);
    try {
      const payload = buildIncidentPayload(formData, {
        isEditMode,
        metaState,
        parityState,
      });
      let savedId: string | null;
      let savedUpdatedAt: string | undefined;
      if (isEditMode) {
        const res = await api.put(`/incidents/${id}`, { ...payload, expectedUpdatedAt: recordUpdatedAt ?? undefined });
        savedId = id ?? null;
        savedUpdatedAt = (res?.data as { data?: { updatedAt?: string } } | undefined)?.data?.updatedAt;
      } else {
        const res = await api.post('/incidents', payload);
        // Envelope {success, data:{id,updatedAt}} (incidents.service.create) → bắt id + updatedAt.
        const data = (res?.data as { data?: { id?: string; updatedAt?: string } } | undefined)?.data;
        savedId = data?.id ?? null;
        savedUpdatedAt = data?.updatedAt;
      }
      // Refresh optimistic-lock baseline từ response → lưu lần 2 không gửi recordUpdatedAt cũ gây 409.
      if (savedUpdatedAt) setRecordUpdatedAt(savedUpdatedAt);
      return { ok: true, id: savedId };
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setErrors(["Vụ việc đã được chỉnh sửa bởi người dùng khác. Vui lòng tải lại trang để xem phiên bản mới nhất trước khi chỉnh sửa."]);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setErrors(extractApiError(err).messages);
      }
      return { ok: false, id: null };
    } finally { setIsSubmitting(false); savingRef.current = false; }
  };

  // "Lưu" thường → lưu xong về danh sách (hành vi cũ).
  const onSave = async () => {
    const r = await doSave();
    if (r.ok) navigate("/vu-viec");
  };

  // "Lưu và xuất file" → lưu xong mở popup xuất chứng từ động (không điều hướng tới khi đóng popup).
  const onSaveAndExport = async () => {
    const r = await doSave();
    if (!r.ok) return;
    if (r.id) { setExportNavigateOnClose(true); setExportForId(r.id); }
    else navigate("/vu-viec"); // không lấy được id → về danh sách (degrade an toàn)
  };

  // Form submit (phím Enter) → lưu thường.
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    void onSave();
  };

  const handleCancel = () => { if (confirm("Bạn có chắc muốn hủy? Dữ liệu chưa lưu sẽ mất.")) navigate("/vu-viec"); };

  // Phím tắt form: F2 Lưu, Esc Hủy, F4 In chứng từ, F3 Xóa (chỉ khi SỬA).
  const deleteModal = useDeleteResourceModalSafe();
  useFormShortcuts({
    onSave: () => void onSave(),
    onCancel: handleCancel,
    onExportDocs: () => {
      if (id) { setExportNavigateOnClose(false); setExportForId(id); }
      else void onSaveAndExport();
    },
    onDelete: () => {
      if (id && deleteModal) {
        deleteModal.open({ resourceType: "incidents", recordId: id, onSuccess: () => navigate("/vu-viec") });
      }
    },
    // Đồng bộ rule với danh sách: chỉ xóa khi trạng thái = Tiếp nhận (incidents/row-actions.ts).
    canDelete: isEditMode && recordStatus === IncidentStatus.TIEP_NHAN,
    onReset: () => {
      // EDIT → route tạo mới (tránh ghi đè bản ghi cũ); CREATE → reload để sạch mọi state.
      if (!confirm("Làm trống form và nhập lại từ đầu? Dữ liệu chưa lưu sẽ mất.")) return;
      if (isEditMode) navigate("/vu-viec/new");
      else window.location.reload();
    },
  });
  const update = <K extends keyof IncidentFormData>(field: K, value: IncidentFormData[K]) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

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
          {isEditMode && id && (
            <button
              type="button"
              onClick={() => { setExportNavigateOnClose(false); setExportForId(id); }}
              className="flex items-center gap-2 px-4 py-2.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 font-medium"
              data-testid="btn-print-docs"
            >
              <FileText className="w-4 h-4" />In chứng từ
            </button>
          )}
          <SaveSplitButton
            onSave={onSave}
            onSaveAndExport={onSaveAndExport}
            isSubmitting={isSubmitting}
            label={isEditMode ? "Cập nhật" : "Lưu vụ việc"}
            idPrefix="btn-save-top"
            mainTestId="btn-save-top"
          />
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

      <form onSubmit={(e) => void handleSubmit(e)} onKeyDown={handleFormKeyDown} className="space-y-6">
        {/* Truy nguyên hệ cũ — STT + STT cũ (vụ việc di trú) */}
        {isEditMode && legacyRaw && Boolean(legacyRaw.stt || legacyRaw.stt_cu) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
            <span className="font-semibold">Mã hồ sơ gốc (hệ cũ):</span>{" "}
            {legacyRaw.stt ? `STT ${String(legacyRaw.stt)}` : ""}
            {legacyRaw.stt_cu ? ` · STT cũ ${String(legacyRaw.stt_cu)}` : ""}
            <span className="text-amber-600"> — để tra lại dữ liệu hệ thống cũ</span>
          </div>
        )}
        {/* Submit ẩn: giữ hành vi Enter-to-submit của <form> sau khi nút Lưu chuyển sang
            SaveSplitButton (type=button). Không hiển thị, không phá layout. */}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} disabled={isSubmitting} />

        {/* Thanh tab theo đúng bộ 10 tab của hệ cũ — đúng tên, đúng thứ tự.
            Hệ cũ dùng chung form `/doi-1/Them` cho Đơn thư, Vụ việc và Vụ án; đo lại
            27/08/2026 thì nút "Thêm mới" trên màn vụ việc trỏ thẳng tới đó. */}
        <div className="flex flex-wrap gap-1 border-b border-slate-200" data-testid="thanh-tab-vu-viec">
          {(Object.keys(LEGACY_TAB_LABEL) as LegacyTabId[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTabDangMo(t)}
              data-testid={`tab-nut-${t}`}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tabDangMo === t
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              {LEGACY_TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {tabDangMo !== "info" && (
          <LegacyTabBody
            spec={INCIDENT_LEGACY_SPEC}
            tabId={tabDangMo}
            formData={formData}
            setFormData={setFormData}
            renderOverride={oRieng}
          />
        )}

        {/* Tab Thông tin luôn ở trong cây — ẩn bằng CSS chứ không tháo, để trạng thái ô nhập
            và ô tải tệp không bị dựng lại mỗi lần đổi tab. */}
        <div className={tabDangMo === "info" ? "space-y-6" : "hidden"}>
          <LegacyTabBody
            spec={INCIDENT_LEGACY_SPEC}
            tabId="info"
            formData={formData}
            setFormData={setFormData}
            renderOverride={oRieng}
          >
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
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Tổ chức liên quan</label>
              <input type="text" value={formData.doiTuongToChuc} onChange={(e) => update("doiTuongToChuc", e.target.value)}
                className={inputClass} placeholder="Tên tổ chức liên quan (nếu có)" data-testid="field-doiTuongToChuc" />
            </div>
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
          </div>

          {/* Mô tả chi tiết (free-form text — giữ field ketQuaXuLy cũ, đổi caption) */}

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

            {/* Lý do không khởi tố Đ.157 — PR-8 MULTI: chọn nhiều căn cứ */}
            <p className="mt-1 text-xs text-slate-500">
              7 căn cứ chuẩn theo BLTTHS Đ.157. Luôn hiển thị (pháp lý quan trọng).
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
            <label className={labelClass}>Lý do tạm đình chỉ (ghi chú thêm)</label>
            <textarea value={formData.lyDoTamDinhChi} onChange={(e) => update("lyDoTamDinhChi", e.target.value)} rows={3}
              className={inputClass} placeholder="Ghi chú thêm về lý do tạm đình chỉ" data-testid="field-lyDoTamDinhChi" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Tình trạng thời hiệu</label>
              <input type="text" value={formData.tinhTrangThoiHieu} onChange={(e) => update("tinhTrangThoiHieu", e.target.value)}
                className={inputClass} placeholder="Tình trạng thời hiệu" data-testid="field-tinhTrangThoiHieu" />
            </div>
            <div>
              {/* Ô CHỌN, không phải ô gõ: hệ cũ vốn là `<select>` lưu bằng mã. Để ô gõ thì cán
                  bộ nhập chữ tự do và cột lại lẫn số với chữ như trước 28/08/2026.
                  `optionsGiuGiaTriLa` giữ 118 hồ sơ đang mang chữ ngoài danh sách — thiếu nó là
                  lần lưu kế tiếp xoá mất chữ ấy mà không ai biết. */}
              <label className={labelClass} htmlFor="field-tinhTrangHoSo">Tình trạng hồ sơ</label>
              <select id="field-tinhTrangHoSo" value={formData.tinhTrangHoSo}
                onChange={(e) => update("tinhTrangHoSo", e.target.value)}
                className={inputClass} data-testid="field-tinhTrangHoSo">
                <option value="">-- Chưa chọn --</option>
                {optionsGiuGiaTriLa(TINH_TRANG_OPTIONS.VU_VIEC, formData.tinhTrangHoSo).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          </div>
        </CollapsibleSection>


          </LegacyTabBody>
        </div>
        {/* Tài liệu — luôn hiển thị; EntityDocumentsTab tự guard khi chưa có incidentId */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <EntityDocumentsTab entityKind="incident" entityId={id} />
        </div>

        {/* Actions */}
        {/* Cột typed field-parity (di trú) — ô nhập chính thức, ghi thẳng cột */}
        {isEditMode && (
          <LegacyParityFields
            entity="incident"
            values={parityState}
            onChange={(col, v) => setParityState((prev) => ({ ...prev, [col]: v }))}
          />
        )}
        {/* Trường hệ cũ chỉnh sửa được (mọi field cũ) + panel tham khảo đầy đủ */}
        {isEditMode && (
          <DynamicLegacyFields
            entity="incident"
            values={metaState}
            onChange={(k, v) => setMetaState((prev) => ({ ...prev, [k]: v }))}
          />
        )}
        {isEditMode && <LegacyRawPanel raw={legacyRaw} />}

        <div className="flex items-center justify-end gap-3 bg-white rounded-lg border border-slate-200 shadow-sm p-6">
          <button type="button" onClick={handleCancel} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50" data-testid="btn-cancel">Hủy</button>
          {isEditMode && id && (
            <button
              type="button"
              onClick={() => { setExportNavigateOnClose(false); setExportForId(id); }}
              className="flex items-center gap-2 px-6 py-2.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 font-medium"
              data-testid="btn-print-docs-bottom"
            >
              <FileText className="w-4 h-4" />In chứng từ
            </button>
          )}
          <SaveSplitButton
            onSave={onSave}
            onSaveAndExport={onSaveAndExport}
            isSubmitting={isSubmitting}
            label={isEditMode ? "Cập nhật" : "Lưu vụ việc"}
            idPrefix="btn-save"
            mainTestId="btn-save"
          />
        </div>
      </form>

      {/* Epic vụ việc/vụ án PR3 — popup xuất chứng từ động (mẫu admin upload) */}
      {exportForId && (
        <DynamicExportDocumentsModal
          entity="incidents"
          entityId={exportForId}
          onClose={() => {
            setExportForId(null);
            if (exportNavigateOnClose) navigate("/vu-viec");
          }}
        />
      )}
    </div>
  );
}

export default IncidentFormPage;
