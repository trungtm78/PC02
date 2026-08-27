/**
 * PetitionFormPage - Thêm mới / Chỉnh sửa Đơn thư
 * TASK-ID: TASK-2026-260202
 */

import { buildPetitionPayload } from "./buildPetitionPayload";
// Kiểu và giá trị khởi tạo tách sang tệp riêng để hàm dựng payload và ca kiểm dùng được
// mà không phải nạp cả trang. Giữ tên cục bộ `FormData`/`INITIAL_FORM` cho phần còn lại.
import {
  INITIAL_PETITION_FORM as INITIAL_FORM,
  type PetitionFormData as FormData,
} from "./types";
import { DynamicLegacyFields } from "@/components/DynamicLegacyFields";
import { LegacyParityFields } from "@/components/LegacyParityFields";
import {
  KHOA_NHANH_PHU,
  PETITION_LEGACY_SPEC,
} from "@/features/petitions/legacy-form-binding";
import { LegacyTabBody } from "@/components/legacy-form/LegacyTabBody";
import { LEGACY_TAB_LABEL, type LegacyTabId } from "@/features/cases/legacy-form-layout.def";
import { LEGACY_PARITY_FIELDS } from "@/shared/legacy/legacyParityFields.generated";
import { LegacyRawPanel } from "@/components/LegacyRawPanel";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import {
  ArrowLeft, AlertCircle, Calendar, User,
  FileText, MapPin, Phone, Mail, ChevronDown,
} from "lucide-react";
import { FKSelect } from "@/components/FKSelect";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { DocNumberPreviewField } from "@/components/DocNumberPreviewField";
import { documentNumbersApi } from "@/features/document-numbers/api";
import { SaveSplitButton } from "@/features/petitions/components/SaveSplitButton";
import { DynamicExportDocumentsModal } from "@/features/document-templates/components/DynamicExportDocumentsModal";
import { useFormDefaults } from "@/hooks/useFormDefaults";
import { useTeamOptions } from "@/hooks/useTeamOptions";
import { useFormShortcuts } from "@/hooks/useFormShortcuts";
import { useFormErrorNavigation } from "@/hooks/useFormErrorNavigation";
import { useDeleteResourceModalSafe } from "@/features/_shared/modals/DeleteResourceModalProvider";
import { today, toDateInput } from "@/lib/dates";
import { LOAI_DON_OPTIONS } from "@/shared/enums/status-labels";
import { EntityDocumentsTab } from "@/components/documents/EntityDocumentsTab";
import { PetitionCreateDocumentsStage, type PetitionStageHandle } from "@/features/petitions/components/PetitionCreateDocumentsStage";
import { PetitionAssignmentSection } from "../PetitionAssignmentSection";
import { ConvertPetitionModal, type ConvertToIncidentPayload, type ConvertToCasePayload } from "../ConvertPetitionModal";

import { computeFormErrors } from "./validate";
import { displayName, type UserOption } from "./userOption";
export function PetitionFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  // PR2 — tạo mới đơn thư có đính file: sau khi POST tạo đơn, giữ id mới ở createdId →
  // (1) lưu lần kế = PUT (không tạo đơn TRÙNG), (2) cho upload/retry file đã stage.
  // effectiveEdit/effectiveId dùng trong saveOnly + validateForm.
  const [createdId, setCreatedId] = useState<string | null>(null);
  const effectiveId = id ?? createdId;
  const effectiveEdit = isEditMode || createdId !== null;
  const stageRef = useRef<PetitionStageHandle>(null);
  // Khoá submit ĐỒNG BỘ (ref, không đợi re-render) — chặn 2 click nhanh/Enter chạy saveOnly
  // song song trước khi createdId render → cả hai POST → tạo 2 đơn TRÙNG (Codex PR2).
  const savingRef = useRef(false);

  const [formData, setFormData] = useState<FormData>(INITIAL_FORM);
  const [legacyRaw, setLegacyRaw] = useState<Record<string, unknown> | null>(null);
  /**
   * Ho so nay den TU HE CU hay khong.
   *
   * Cu the la `legacySourceId`, KHONG phai `legacyRaw`: 161 ho so di tru la vo lien ket - ban
   * tho nam o thuc the anh em cung khoa nguon nen `legacyRaw` cua chinh no de trong. Lay theo
   * `legacyRaw` thi dung nhom ay khong duoc mien va van bi chan Luu.
   */
  const [laHoSoDiTru, setLaHoSoDiTru] = useState(false);
  const [metaState, setMetaState] = useState<Record<string, unknown>>({});
  const [parityState, setParityState] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<string[]>([]);
  // Tab đang mở. Hệ cũ dùng đúng bộ 10 tab này cho cả Đơn thư, Vụ việc và Vụ án.
  const [tabDangMo, setTabDangMo] = useState<LegacyTabId>("info");
  // Options Tổ/Nhóm cho "Đơn vị xử lý" khi thuộc thẩm quyền (YC6).
  const { data: teamOptions = [] } = useTeamOptions();
  // Điều hướng ô lỗi: focus ô lỗi đầu khi lưu + phím "Lỗi tiếp theo" nhảy ô lỗi kế (YC3, hook chung).
  const { focusFirstError, handleFormKeyDown } = useFormErrorNavigation(
    () => computeFormErrors(formData, effectiveEdit, laHoSoDiTru).fields,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Mở popup "Xuất chứng từ" sau "Lưu và xuất file" (giữ petitionId vừa lưu).
  const [exportModalForId, setExportModalForId] = useState<string | null>(null);
  // "Lưu và xuất file" → đóng popup thì về danh sách; nút "In chứng từ" độc lập → ở lại form.
  const [exportNavigateOnClose, setExportNavigateOnClose] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(isEditMode);
  // Snapshot formData đã lưu gần nhất — cập nhật khi save/patch để onPetitionPatched (popup In
  // chứng từ "Lưu bổ sung") không khiến form bị coi là dirty.
  const savedSnapshotRef = useRef<string>(JSON.stringify(INITIAL_FORM));
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [recordUpdatedAt, setRecordUpdatedAt] = useState<string | null>(null);
  const [isDraftLoading, setIsDraftLoading] = useState(!isEditMode);
  // Nhóm II: convert state
  const [linkedIncidentId, setLinkedIncidentId] = useState<string | null>(null);
  const [linkedCaseId, setLinkedCaseId] = useState<string | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const canConvert = isEditMode && !linkedIncidentId && !linkedCaseId;

  // ── Nhóm V: Suspect search combobox ─────────────────────────────────────────
  type SuspectResult = { name: string; idNumber: string; crimes: string[]; sources: Array<{ type: string; stt: string }> };
  type DupResult = { id: string; stt: string; senderName: string; receivedDate: string; summary: string | null };

  const [suspectQuery, setSuspectQuery] = useState<string | null>(null);
  const [suspectResults, setSuspectResults] = useState<SuspectResult[]>([]);
  const [showSuspectDropdown, setShowSuspectDropdown] = useState(false);
  const [dupQuery, setDupQuery] = useState<string | null>(null);
  const [dupResults, setDupResults] = useState<DupResult[]>([]);
  const [showDupDropdown, setShowDupDropdown] = useState(false);
  const suspectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSuspectInput = useCallback((q: string) => {
    setSuspectQuery(q);
    if (suspectTimerRef.current) clearTimeout(suspectTimerRef.current);
    if (!q.trim()) { setSuspectResults([]); setShowSuspectDropdown(false); return; }
    suspectTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.get<SuspectResult[]>("/petitions/suspect-search", { params: { q } });
        setSuspectResults(Array.isArray(res.data) ? res.data : []);
        setShowSuspectDropdown(true);
      } catch { setSuspectResults([]); }
    }, 300);
  }, []);

  const handleDupInput = useCallback((q: string) => {
    setDupQuery(q);
    if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
    if (!q.trim()) { setDupResults([]); setShowDupDropdown(false); return; }
    dupTimerRef.current = setTimeout(async () => {
      try {
        const params: Record<string, string> = { q };
        if (id) params.excludeId = id;
        const res = await api.get<DupResult[]>("/petitions/duplicate-search", { params });
        setDupResults(Array.isArray(res.data) ? res.data : []);
        setShowDupDropdown(true);
      } catch { setDupResults([]); }
    }, 300);
  }, [id]);

  useEffect(() => {

  return () => {
      if (suspectTimerRef.current) clearTimeout(suspectTimerRef.current);
      if (dupTimerRef.current) clearTimeout(dupTimerRef.current);
    };
  }, []);

  const defaults = useFormDefaults();

  // v0.42 — Auto-generate stt via engine in create mode.
  useEffect(() => {
    if (isEditMode) return;
    setIsDraftLoading(true);
    documentNumbersApi.draft('PETITION')
      // Chỉ set preview khi stt CÒN RỖNG — tránh race: nếu user lưu nhanh (create đã set stt THẬT
      // từ response) thì draft resolve muộn KHÔNG được ghi đè số thật bằng preview (codex).
      .then((r) => setFormData((prev) => (prev.stt ? prev : { ...prev, stt: r.previewNumber })))
      .catch((err) => console.error('draft fetch failed:', err))
      .finally(() => setIsDraftLoading(false));
  }, [isEditMode]);

  // Apply defaults on create mode (today, primary team text + FK).
  // assignedToId intentionally NOT defaulted — petition assignment is a dispatcher decision,
  // pre-filling self bypasses the workflow.
  useEffect(() => {
    if (isEditMode || !defaults.isLoaded) return;
    setFormData((prev) => ({
      ...prev,
      receivedDate:   prev.receivedDate   || defaults.today,
      unit:           prev.unit           || defaults.primaryTeamName  || "",
      assignedTeamId: prev.assignedTeamId || defaults.primaryTeamId    || "",
      // Cán bộ đề xuất mặc định = người đang đăng nhập (KHÁC assignedToId ở trên —
      // phân công là quyết định của điều phối, còn đề xuất là người tự ký).
      canBoDeXuatId:  prev.canBoDeXuatId  || defaults.userId           || "",
    }));
  }, [isEditMode, defaults.isLoaded, defaults.today, defaults.primaryTeamId, defaults.primaryTeamName, defaults.userId]);

  // Load users for FKSelect
  useEffect(() => {
    api
      .get<{ success: boolean; data: UserOption[] }>("/admin/users", { params: { limit: 200 } })
      .then((res) => setUserOptions(res.data.data ?? []))
      .catch(() => setUserOptions([]));
  }, []);

  // Load petition data in edit mode
  useEffect(() => {
    if (!isEditMode) return;
    setIsLoadingData(true);
    api
      .get<{ success: boolean; data: Record<string, unknown> }>(`/petitions/${id}`)
      .then((res) => {
        const d = res.data.data;
        setLegacyRaw((d.legacyRaw as Record<string, unknown>) ?? null);
        setLaHoSoDiTru(d.legacySourceId != null || d.legacyRaw != null);
        // Tách đôi metadata đọc về: khoá nào bố cục hệ cũ đã có ô thì thuộc `legacyExtra`,
        // còn lại để `metaState` cho panel động. Cùng giữ một khoá ở hai vùng thì lúc gộp lại
        // vùng ghi sau đè vùng kia — cán bộ sửa ở panel động, bấm Lưu, không đổi gì.
        const metaDoc = (d.metadata as Record<string, unknown>) ?? {};
        const metaConLai: Record<string, unknown> = {};
        const metaTheoBoCuc: Record<string, string | string[] | boolean> = {};
        for (const [k, v] of Object.entries(metaDoc)) {
          if (KHOA_NHANH_PHU.has(k)) metaTheoBoCuc[k] = v as string | string[] | boolean;
          else metaConLai[k] = v;
        }
        setMetaState(metaConLai);
        const ps: Record<string, unknown> = {};
        for (const f of LEGACY_PARITY_FIELDS.petition) if (d[f.col] != null) ps[f.col] = d[f.col];
        setParityState(ps);
        setFormData({
          stt: (d.stt as string) ?? "",
          receivedDate: d.receivedDate
            ? toDateInput(d.receivedDate as string)
            : today(),
          unit: (d.unit as string) ?? "",
          assignedTeamId: (d.assignedTeamId as string) ?? "",
          senderName: (d.senderName as string) ?? "",
          senderBirthYear: d.senderBirthYear ? String(d.senderBirthYear) : "",
          senderAddress: (d.senderAddress as string) ?? "",
          senderPhone: (d.senderPhone as string) ?? "",
          senderEmail: (d.senderEmail as string) ?? "",
          suspectedPerson: (d.suspectedPerson as string) ?? "",
          suspectedAddress: (d.suspectedAddress as string) ?? "",
          petitionType: (d.petitionType as string) ?? "",
          priority: (d.priority as string) ?? "",
          summary: (d.summary as string) ?? "",
          detailContent: (d.detailContent as string) ?? "",
          attachmentsNote: (d.attachmentsNote as string) ?? "",
          deadline: toDateInput(d.deadline as string | null | undefined),
          assignedToId: d.assignedToId ? String(d.assignedToId) : "",
          canBoDeXuatId: d.canBoDeXuatId ? String(d.canBoDeXuatId) : "",
          notes: (d.notes as string) ?? "",
          nhanThay: (d.nhanThay as string) ?? "",
          deXuat: (d.deXuat as string) ?? "",
          raSoatTrung: (d.raSoatTrung as string) ?? "Không",
          baoCaoBanGiamDoc: Boolean(d.baoCaoBanGiamDoc),
          senderIdNumber: (d.senderIdNumber as string) ?? "",
          senderIdIssueDate: toDateInput(d.senderIdIssueDate as string | null | undefined),
          senderIdIssuePlace: (d.senderIdIssuePlace as string) ?? "",
          senderIsAnonymous: Boolean(d.senderIsAnonymous),
          loaiThongTin: (d.loaiThongTin as string) ?? "",
          soPhieuChuyen: (d.soPhieuChuyen as string) ?? "",
          ngayPhieuChuyen: toDateInput(d.ngayPhieuChuyen as string | null | undefined),
          ngayTiepNhanNguonTin: toDateInput(d.ngayTiepNhanNguonTin as string | null | undefined),
          toiDanhBanDau: (d.toiDanhBanDau as string) ?? "",
          crimeChinhId: (d.crimeChinhId as string) ?? "",
          noiXayRa: (d.noiXayRa as string) ?? "",
          noiXayRaPhuongXa: (d.noiXayRaPhuongXa as string) ?? "",
          ngayXayRa: toDateInput(d.ngayXayRa as string | null | undefined),
          loaiToiPham: (d.loaiToiPham as string) ?? "",
          phuongThucThuDoan: (d.phuongThucThuDoan as string) ?? "",
          ngayGiaoDonViGiaiQuyet: toDateInput(d.ngayGiaoDonViGiaiQuyet as string | null | undefined),
          laCongNgheCao: Boolean(d.laCongNgheCao),
          lanhDaoToTung: (d.lanhDaoToTung as string) ?? "",
          ketQuaXuLyKhac: (d.ketQuaXuLyKhac as string) ?? "",
          thoiHanUTDT: toDateInput(d.thoiHanUTDT as string | null | undefined),
          // Field-parity bổ sung tab "Thông tin" form cũ /doi-1/Them (2026-06-26)
          nguonDon: (d.nguonDon as string) ?? "",
          petitionDate: toDateInput(d.petitionDate as string | null | undefined),
          ngayDeXuat: toDateInput(d.ngayDeXuat as string | null | undefined),
          phanLoaiNguonTin: (d.phanLoaiNguonTin as string) ?? "",
          dieuTraVien: (d.dieuTraVien as string) ?? "",
          donViGiaiQuyet: (d.donViGiaiQuyet as string) ?? "",
          thuocThamQuyen: (d.thuocThamQuyen as boolean) ?? true,
          donViXuLy: (d.donViXuLy as string) ?? "",
          // ── Cột hệ cũ thêm 26/08/2026 ──
          baoCaoBanGiamDocText: (d.baoCaoBanGiamDocText as string) ?? "",
          tinhTrang: (d.tinhTrang as string) ?? "",
          soQDPhanCongNguonTin: (d.soQDPhanCongNguonTin as string) ?? "",
          ngayQDPhanCongNguonTin: toDateInput(d.ngayQDPhanCongNguonTin as string | null | undefined),
          soQDTamDinhChiNguonTin: (d.soQDTamDinhChiNguonTin as string) ?? "",
          ngayQDTamDinhChiNguonTin: toDateInput(d.ngayQDTamDinhChiNguonTin as string | null | undefined),
          canCuTamDinhChiNguonTin: (d.canCuTamDinhChiNguonTin as string) ?? "",
          soPhucHoiNguonTin: (d.soPhucHoiNguonTin as string) ?? "",
          ngayPhucHoiNguonTin: toDateInput(d.ngayPhucHoiNguonTin as string | null | undefined),
          ghiChuKhac: (d.ghiChuKhac as string) ?? "",
          phanLoaiToiPhamLinhVuc: (d.phanLoaiToiPhamLinhVuc as string) ?? "",
          yeuCauBoSung: (d.yeuCauBoSung as string) ?? "",
          soTienBiThietHai: d.soTienBiThietHai != null ? String(d.soTienBiThietHai) : "",
          soLuongBiHai: d.soLuongBiHai != null ? String(d.soLuongBiHai) : "",
          sttCu: (d.sttCu as string) ?? "",
          // Ô hệ cũ chưa có cột riêng — nằm trong metadata của máy chủ.
          legacyExtra: metaTheoBoCuc,
        });
        setRecordUpdatedAt((d.updatedAt as string) ?? null);
        // Nhóm II: track linked IDs to show/hide convert button
        setLinkedIncidentId((d.linkedIncidentId as string) ?? null);
        setLinkedCaseId((d.linkedCaseId as string) ?? null);
        // Snapshot the loaded values so isDirty is false until the officer types.
        // Must match the next setFormData state shape — recompute on next render via setTimeout fallback.
        setTimeout(() => {
          setFormData((curr) => {
            savedSnapshotRef.current = JSON.stringify(curr);
            return curr;
          });
        }, 0);
      })
      .catch(() => setErrors(["Không thể tải dữ liệu đơn thư. Vui lòng thử lại."]))
      .finally(() => setIsLoadingData(false));
  }, [id, isEditMode]);

  const validateForm = (): boolean => {
    // priority optional (backend @IsOptional); summary KHÔNG còn bắt buộc (đã ẩn — YC2).
    const { msgs } = computeFormErrors(formData, effectiveEdit, laHoSoDiTru);
    setErrors(msgs);
    return msgs.length === 0;
  };

  // Tách phần LƯU (không điều hướng) → trả { ok, id } để onSave/onSaveAndExport
  // quyết định điều hướng hay mở popup xuất chứng từ. [F2] create bắt id từ response.
  const saveOnly = async (): Promise<{ ok: boolean; id: string | null; uploadFailed?: number }> => {
    if (savingRef.current) return { ok: false, id: null }; // đang lưu → bỏ qua click lặp
    if (!validateForm()) {
      // Mọi ô có thể báo lỗi đều nằm ở tab Thông tin. Đang đứng ở tab khác mà bấm Lưu thì ô
      // lỗi nằm trong khối ẩn — cán bộ thấy thông báo mà không thấy ô nào để sửa. Nhảy về
      // trước, rồi mới đưa con trỏ vào ô.
      setTabDangMo("info");
      // Focus ô lỗi đầu tiên (thay vì chỉ scroll top) — YC3. Chờ một nhịp để tab kịp hiện.
      setTimeout(() => {
        if (!focusFirstError()) window.scrollTo({ top: 0, behavior: "smooth" });
      }, 0);
      return { ok: false, id: null };
    }
    savingRef.current = true;
    setIsSubmitting(true);
    try {
      const payload = buildPetitionPayload(formData, {
        effectiveEdit,
        parityState,
        metaState,
      });
      let savedId: string | null;
      let savedUpdatedAt: string | undefined;
      if (effectiveEdit) {
        const res = await api.put(`/petitions/${effectiveId}`, { ...payload, expectedUpdatedAt: recordUpdatedAt ?? undefined });
        savedId = effectiveId ?? null;
        savedUpdatedAt = (res?.data as { data?: { updatedAt?: string } } | undefined)?.data?.updatedAt;
      } else {
        const res = await api.post("/petitions", payload);
        // Envelope {success, data:{id,updatedAt,stt}} — không auto-unwrap (xem lib/api).
        const data = (res?.data as { data?: { id?: string; updatedAt?: string; stt?: string } } | undefined)?.data;
        savedId = data?.id ?? null;
        savedUpdatedAt = data?.updatedAt;
        // PR2: chuyển sang "effective edit" để lưu lần kế = PUT (không tạo đơn trùng).
        if (savedId) setCreatedId(savedId);
        // Hiển thị SỐ TIẾP NHẬN THẬT do backend cấp (khác preview draft) để form khỏi lệch.
        if (data?.stt) setFormData((p) => ({ ...p, stt: data.stt as string }));
      }
      // Refresh optimistic-lock baseline từ response: nếu không, lưu lần 2 (vd sau "Lưu và xuất
      // file" ở lại form) gửi recordUpdatedAt CŨ → BE P2025 → 409 "đã được chỉnh sửa bởi người
      // dùng khác" dù chỉ mình mình sửa. + snapshot để isDirty không lệch.
      if (savedUpdatedAt) setRecordUpdatedAt(savedUpdatedAt);
      savedSnapshotRef.current = JSON.stringify(formData);
      // PR2: tạo mới có đính file → upload các file đã stage vào đơn vừa tạo (tuần tự).
      // Upload-fail một phần → GIỮ file lỗi trong stage để retry, KHÔNG mất; báo uploadFailed.
      let uploadFailed = 0;
      if (savedId && stageRef.current?.hasStaged()) {
        const r = await stageRef.current.uploadAll(savedId);
        uploadFailed = r.failed.length;
      }
      return { ok: true, id: savedId, uploadFailed };
    } catch (err: unknown) {
      // Luôn hiển thị MESSAGE THẬT của backend: phân biệt đúng "đã được chỉnh sửa bởi người dùng
      // khác" (optimistic-lock P2025) vs "Số tiếp nhận đã tồn tại" (trùng số P2002) — không gán
      // cứng 1 message cho mọi 409 (bug cũ làm tạo-mới hiểu nhầm thành optimistic-lock).
      setErrors(extractApiError(err, "Có lỗi xảy ra khi lưu đơn thư. Vui lòng thử lại.").messages);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return { ok: false, id: null };
    } finally {
      savingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // "Lưu" thường → lưu xong về danh sách (hành vi cũ).
  const onSave = async () => {
    const r = await saveOnly();
    if (!r.ok) return;
    if (r.uploadFailed) {
      // Đơn ĐÃ lưu (createdId set → lưu lại = PUT, không trùng); ở lại để retry upload.
      setErrors([`Đã lưu đơn thư nhưng ${r.uploadFailed} file tải lên lỗi. Bấm "Thử lại tải lên" rồi lưu lại.`]);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    navigate("/petitions");
  };

  // "Lưu và xuất file" → lưu xong mở popup xuất chứng từ (KHÔNG điều hướng tới khi đóng popup).
  const onSaveAndExport = async () => {
    const r = await saveOnly();
    if (!r.ok) return;
    if (r.uploadFailed) {
      setErrors([`Đã lưu đơn thư nhưng ${r.uploadFailed} file tải lên lỗi. Bấm "Thử lại tải lên" trước khi xuất.`]);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (r.id) { setExportNavigateOnClose(true); setExportModalForId(r.id); }
    else navigate("/petitions"); // không lấy được id → về danh sách (degrade an toàn)
  };

  // Form submit (phím Enter) → lưu thường.
  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    void onSave();
  };

  const handleCancel = () => {
    if (confirm("Bạn có chắc chắn muốn hủy? Dữ liệu chưa lưu sẽ bị mất.")) navigate("/petitions");
  };

  // Phím tắt form: F2 Lưu, Esc Hủy, F4 Xuất/In chứng từ, F3 Xóa (chỉ khi SỬA).
  const deleteModal = useDeleteResourceModalSafe();
  useFormShortcuts({
    onSave: () => void onSave(),
    onCancel: handleCancel,
    onExportDocs: () => {
      if (effectiveId) { setExportNavigateOnClose(false); setExportModalForId(effectiveId); }
      else void onSaveAndExport();
    },
    onDelete: () => {
      if (id && deleteModal) {
        deleteModal.open({ resourceType: "petitions", recordId: id, onSuccess: () => navigate("/petitions") });
      }
    },
    canDelete: isEditMode,
    onReset: () => {
      // Init màn hình: làm trống form, nhập lại từ đầu (form tạo mới sạch hoàn toàn).
      // EDIT → sang route tạo mới (tránh ghi đè bản ghi cũ bằng dữ liệu trắng).
      // CREATE → reload để xoá sạch mọi state phụ (kể cả file đã đính) — không sót như reset tay.
      if (!confirm("Làm trống form và nhập lại từ đầu? Dữ liệu chưa lưu sẽ mất.")) return;
      if (isEditMode) navigate("/petitions/new");
      else window.location.reload();
    },
  });

  const update = (field: keyof FormData, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  if (isLoadingData) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <p className="text-slate-500">Đang tải dữ liệu...</p>
      </div>
    );
  }

  /**
   * Ô riêng cho vài trường mà hệ mới mạnh hơn hẳn ô chữ của hệ cũ.
   *
   * Bố cục hệ cũ quyết nhãn, thứ tự và chỗ đứng; ba ô này giữ nguyên chỗ nhưng đổi ruột —
   * số điện thoại có định dạng, "Ghi chú trùng đơn" tra được đơn trùng, "Tội danh cũ trước
   * đây" tra được tiền án. Bỏ chúng đi để giống hệ cũ là hạ cấp năng lực.
   */
  const oRieng: Partial<Record<string, (label: string) => React.ReactNode>> = {
    senderPhone: (label) => (
      <>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <PhoneInput value={formData.senderPhone} onValueChange={(v) => update("senderPhone", v)} className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="09xx xxx xxx" data-testid="field-senderPhone" />
        </div>
      </>
    ),
    toiDanhBanDau: (label) => (
      <>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
                      <div className="relative">
        <input
          type="text"
          value={suspectQuery ?? formData.toiDanhBanDau}
          onChange={(e) => {
            const v = e.target.value;
            handleSuspectInput(v);
          }}
          onFocus={() => suspectResults.length > 0 && setShowSuspectDropdown(true)}
          onBlur={() => setTimeout(() => {
            setShowSuspectDropdown(false);
            if (suspectQuery !== null) {
              update("toiDanhBanDau", suspectQuery);
              setSuspectQuery(null);
            }
          }, 200)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Gõ tên/CCCD để tìm tiền án, hoặc nhập tự do"
          data-testid="suspect-search-input"
        />
        {showSuspectDropdown && suspectResults.length > 0 && (
          <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
            {suspectResults.map((r, i) => (
              <button
                key={`${r.idNumber}-${i}`}
                type="button"
                className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                onMouseDown={() => {
                  const crimes = r.crimes.join(", ");
                  update("toiDanhBanDau", crimes);
                  setSuspectQuery(null);
                  setShowSuspectDropdown(false);
                }}
              >
                <span className="font-medium">{r.name}</span>
                {r.idNumber && <span className="text-slate-500 ml-2 text-xs">CCCD: {r.idNumber}</span>}
                {r.crimes.length > 0 && <div className="text-slate-600 text-xs truncate">{r.crimes.join(", ")}</div>}
              </button>
            ))}
          </div>
        )}
                      </div>
      </>
    ),
    raSoatTrung: (label) => (
      <>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
        <div className="relative">
          <input
            type="text"
            value={dupQuery ?? formData.raSoatTrung}
            onChange={(e) => {
              const v = e.target.value;
              handleDupInput(v);
            }}
            onFocus={() => dupResults.length > 0 && setShowDupDropdown(true)}
            onBlur={() => setTimeout(() => {
              setShowDupDropdown(false);
              if (dupQuery !== null) {
                update("raSoatTrung", dupQuery);
                setDupQuery(null);
              }
            }, 200)}
            className="w-full px-4 py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Gõ tên/STT để tìm đơn trùng, hoặc nhập 'Không'"
            data-testid="duplicate-search-input"
          />
          {showDupDropdown && dupResults.length > 0 && (
            <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
              {dupResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 text-sm"
                  onMouseDown={() => {
                    const label = `${r.stt} - ${r.senderName} (${new Date(r.receivedDate).toLocaleDateString('vi-VN')})`;
                    update("raSoatTrung", label);
                    setDupQuery(null);
                    setShowDupDropdown(false);
                  }}
                >
                  <span className="font-medium">{r.stt}</span>
                  <span className="text-slate-600 ml-2">{r.senderName}</span>
                  {r.summary && <div className="text-slate-500 text-xs truncate">{r.summary}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      </>
    ),
  };

  return (
    <div className="p-6 space-y-6" data-testid="petition-form-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/petitions")} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" data-testid="btn-back">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {isEditMode ? "Cập nhật Đơn thư" : "Thêm mới Đơn thư"}
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              {isEditMode ? `Chỉnh sửa thông tin đơn thư ${id}` : "Nhập thông tin đơn thư mới"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleCancel} className="px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors" data-testid="btn-cancel-top">
            Hủy
          </button>
          {isEditMode && id && (
            <button
              type="button"
              onClick={() => { setExportNavigateOnClose(false); setExportModalForId(id); }}
              className="flex items-center gap-2 px-4 py-2.5 border border-amber-300 text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors font-medium"
              data-testid="btn-print-docs"
            >
              <FileText className="w-4 h-4" />In chứng từ
            </button>
          )}
          <SaveSplitButton
            onSave={onSave}
            onSaveAndExport={onSaveAndExport}
            isSubmitting={isSubmitting}
            label={isEditMode ? "Cập nhật" : "Lưu đơn thư"}
            idPrefix="btn-save-top"
          />
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4" data-testid="validation-errors">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-red-800 mb-2">Vui lòng kiểm tra các lỗi sau:</h3>
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm text-red-700">{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} onKeyDown={handleFormKeyDown} className="space-y-6">
        {/* Truy nguyên hệ cũ — STT + STT cũ (đơn thư di trú) */}
        {isEditMode && legacyRaw && Boolean(legacyRaw.stt || legacyRaw.stt_cu) && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
            <span className="font-semibold">Mã hồ sơ gốc (hệ cũ):</span>{" "}
            {legacyRaw.stt ? `STT ${String(legacyRaw.stt)}` : ""}
            {legacyRaw.stt_cu ? ` · STT cũ ${String(legacyRaw.stt_cu)}` : ""}
            <span className="text-amber-600"> — để tra lại dữ liệu hệ thống cũ</span>
          </div>
        )}
        {/* Thanh tab theo đúng bộ 10 tab của hệ cũ — đúng tên, đúng thứ tự. */}
        <div className="flex flex-wrap gap-1 border-b border-slate-200" data-testid="thanh-tab-don-thu">
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
            spec={PETITION_LEGACY_SPEC}
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
            spec={PETITION_LEGACY_SPEC}
            tabId="info"
            formData={formData}
            setFormData={setFormData}
            renderOverride={oRieng}
            pinnedTop={
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                {/*
                  Ô BẮT BUỘC không được nằm trong khối gập. Hai ô này máy chủ đòi mà bố cục hệ
                  cũ không có, nên chúng phải ở ngoài — gập đi thì cán bộ bấm Lưu, bị chặn bởi
                  một ô không nhìn thấy được và không hiểu vì sao. Đúng lỗi đã bấm trúng trên
                  máy thật ở epic Vụ án (PR #248).
                */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Ngày tiếp nhận <span className="text-red-500">*</span></label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="date" value={formData.receivedDate} onChange={(e) => {
              const v = e.target.value;
              // YC1: "Ngày tiếp nhận nguồn tin" & "Ngày đề xuất" mirror theo Ngày tiếp nhận — cập nhật khi
              // đang trống HOẶC còn khớp giá trị cũ (chưa bị sửa tay); nếu đã sửa tay khác đi thì GIỮ nguyên.
              setFormData((prev) => {
                const mirror = (cur: string) => !cur || cur === prev.receivedDate;
                return {
                  ...prev,
                  receivedDate: v,
                  ngayTiepNhanNguonTin: mirror(prev.ngayTiepNhanNguonTin) ? v : prev.ngayTiepNhanNguonTin,
                  ngayDeXuat: mirror(prev.ngayDeXuat) ? v : prev.ngayDeXuat,
                };
              });
            }} max={today()} className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-receivedDate" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Loại đơn thư <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.petitionType}
            onChange={(e) => update("petitionType", e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            data-testid="field-petitionType"
          >
            <option value="">-- Chọn loại đơn thư --</option>
            {LOAI_DON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
                </div>
              </div>
            }
          >
        {/* Section 1: Thông tin tiếp nhận */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-bold text-slate-800">Thông tin tiếp nhận</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Số tiếp nhận</label>
                <DocNumberPreviewField
                  inputMode={isEditMode ? 'MANUAL' : 'AUTO'}
                  value={formData.stt}
                  onChange={(v) => update('stt', v)}
                  loading={isDraftLoading}
                  placeholder="DT-2026-00001"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Thông tin người gửi */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-bold text-slate-800">Thông tin người gửi đơn</h2>
          </div>
          <div className="p-6 space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={formData.senderIsAnonymous}
                onChange={(e) => {
                  const anon = e.target.checked;
                  setFormData((prev) => ({
                    ...prev,
                    senderIsAnonymous: anon,
                    ...(anon && { senderName: "", senderAddress: "", senderPhone: "", senderIdNumber: "", senderIdIssueDate: "", senderIdIssuePlace: "" }),
                  }));
                }}
                className="w-4 h-4"
                data-testid="field-senderIsAnonymous"
              />
              Đơn nặc danh / không rõ người gửi (bỏ qua bắt buộc SĐT, tội danh)
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Họ và tên <span className="text-red-500">*</span></label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Địa chỉ <span className="text-red-500">*</span></label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={formData.senderEmail} onChange={(e) => update("senderEmail", e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nhập email" data-testid="field-senderEmail" />
                </div>
              </div>
              {/* Giấy tờ tùy thân (CCCD) — field-parity */}
            </div>
          </div>
        </div>

        {/* Section: Tiếp nhận & luân chuyển nguồn tin — field-parity hệ thống cũ */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-bold text-slate-800">Tiếp nhận &amp; luân chuyển nguồn tin</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Loại tội phạm</label>
              <select value={formData.loaiToiPham} onChange={(e) => update("loaiToiPham", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" data-testid="field-loaiToiPham">
                <option value="">-- Chọn loại tội phạm --</option>
                <option value="TTXH">TTXH</option>
                <option value="Kinh tế-Ma túy">Kinh tế-Ma túy</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Thông tin nghi vấn đối tượng */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-bold text-slate-800">Thông tin nghi vấn đối tượng</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tên đối tượng nghi vấn</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Địa chỉ đối tượng</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={formData.suspectedAddress} onChange={(e) => update("suspectedAddress", e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nhập địa chỉ đối tượng (nếu có)" data-testid="field-suspectedAddress" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Nội dung đơn thư */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-bold text-slate-800">Nội dung đơn thư</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <FKSelect
                  label="Mức độ ưu tiên"
                  masterClassType="03"
                  value={formData.priority}
                  onChange={(v) => update("priority", v)}
                  placeholder="Chọn mức độ"
                  testId="field-priority"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đơn vị giải quyết</label>
                <input type="text" value={formData.donViGiaiQuyet} onChange={(e) => update("donViGiaiQuyet", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Đơn vị giải quyết (khác đơn vị tiếp nhận)" data-testid="field-donViGiaiQuyet" />
              </div>
            </div>
            {/* YC2: ẩn ô "Tóm tắt nội dung" — khi lưu tự lấy tóm tắt từ Nội dung. */}
          </div>
        </div>

        {/* Section 4b: Tài liệu thực tế.
            - Edit (đã có id): EntityDocumentsTab (list + upload trực tiếp như cũ).
            - Create (chưa có id): PetitionCreateDocumentsStage — cho ĐÍNH file ngay, tự upload sau khi Lưu.
              Giữ stage suốt phiên create (kể cả sau createdId) để retry upload-fail không mất file. */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          {isEditMode ? (
            <EntityDocumentsTab entityKind="petition" entityId={id} />
          ) : (
            <PetitionCreateDocumentsStage ref={stageRef} />
          )}
        </div>

        {/* Section 5: Phân công xử lý */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-bold text-slate-800">Phân công xử lý</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Hạn xử lý</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={formData.deadline} onChange={(e) => update("deadline", e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-deadline" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Người được giao xử lý</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select value={formData.assignedToId} onChange={(e) => update("assignedToId", e.target.value)} className="w-full pl-9 pr-10 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none" data-testid="field-assignedToId">
                    <option value="">Chưa phân công</option>
                    {userOptions.map((u) => (
                      <option key={u.id} value={u.id}>{displayName(u)}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ghi chú thêm</label>
              <textarea value={formData.notes} onChange={(e) => update("notes", e.target.value)} rows={3} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Các ghi chú bổ sung khác" data-testid="field-notes" />
            </div>
          </div>
        </div>

        {/* v0.47 PR3.1 T11 — Section 6: Nội dung phiếu đề xuất (hiện cả CREATE + EDIT mode, field-parity hệ thống cũ) */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm" data-testid="section-noi-dung-phieu-de-xuat">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="font-bold text-slate-800">Nội dung phiếu đề xuất</h2>
              <p className="text-xs text-slate-500 mt-1">Nội dung nghiệp vụ phục vụ xuất Phiếu đề xuất, Phiếu chuyển, Thông báo. Bắt buộc khi xuất Phiếu đề xuất.</p>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {/* YC6: thẩm quyền + đơn vị xử lý */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-3">
                  <input
                    type="checkbox"
                    checked={formData.thuocThamQuyen}
                    onChange={(e) => {
                      // Đổi nguồn options → xoá lựa chọn cũ (tên tổ ≠ tên đơn vị ngoài).
                      setFormData((prev) => ({ ...prev, thuocThamQuyen: e.target.checked, donViXuLy: "" }));
                    }}
                    className="w-4 h-4"
                    data-testid="field-thuocThamQuyen"
                  />
                  Thuộc thẩm quyền (xử lý nội bộ theo Tổ/Nhóm)
                </label>
                {formData.thuocThamQuyen ? (
                  <FKSelect
                    label="Đơn vị xử lý"
                    options={teamOptions}
                    value={formData.donViXuLy}
                    onChange={(v) => update("donViXuLy", v)}
                    placeholder="Chọn Tổ/Nhóm xử lý"
                    testId="field-donViXuLy"
                  />
                ) : (
                  <FKSelect
                    label="Đơn vị xử lý"
                    directoryType="DON_VI"
                    value={formData.donViXuLy}
                    onChange={(v) => update("donViXuLy", v)}
                    placeholder="Chọn đơn vị xử lý"
                    testId="field-donViXuLy"
                  />
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {formData.thuocThamQuyen
                    ? "Thuộc thẩm quyền: chọn Tổ/Nhóm nội bộ thụ lý."
                    : "Không thuộc thẩm quyền: chọn đơn vị xử lý để chuyển."}
                </p>
              </div>
              {/* Cán bộ ĐỀ XUẤT — người ký mục "Cán bộ đề xuất" trên Phiếu đề xuất.
                  Mặc định người đang đăng nhập, cho phép chọn cán bộ khác (in hộ). */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Cán bộ đề xuất</label>
                <select
                  value={formData.canBoDeXuatId}
                  onChange={(e) => update("canBoDeXuatId", e.target.value)}
                  className="w-full px-4 py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  data-testid="field-canBoDeXuatId"
                >
                  <option value="">-- Chọn cán bộ --</option>
                  {userOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {displayName(u)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  Tên in ở mục "Cán bộ đề xuất" của Phiếu đề xuất. Mặc định là bạn; đổi nếu lập hộ cán bộ khác.
                </p>
              </div>
              <div>
              </div>
            </div>
          </div>

          </LegacyTabBody>
        </div>

        {/* Nhóm I: Phân công cán bộ — edit mode only */}
        {isEditMode && id && (
          <PetitionAssignmentSection petitionId={id} userOptions={userOptions} />
        )}

        {/* Cột typed field-parity (di trú) — ô nhập chính thức, ghi thẳng cột */}
        {isEditMode && (
          <LegacyParityFields
            entity="petition"
            values={parityState}
            onChange={(col, v) => setParityState((prev) => ({ ...prev, [col]: v }))}
          />
        )}
        {/* Dữ liệu gốc hệ cũ — đầy đủ, tham khảo (pháp lý: không sót field) */}
        {isEditMode && (
          <DynamicLegacyFields
            entity="petition"
            values={metaState}
            onChange={(k, v) => setMetaState((prev) => ({ ...prev, [k]: v }))}
          />
        )}
        {isEditMode && <LegacyRawPanel raw={legacyRaw} />}

        <div className="flex items-center justify-end gap-3 bg-white rounded-lg border border-slate-200 shadow-sm p-4 sm:p-6 flex-wrap">
          <button type="button" onClick={handleCancel} className="px-4 sm:px-6 py-2.5 min-h-[44px] border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors" data-testid="btn-cancel">
            Hủy
          </button>
          <SaveSplitButton
            onSave={onSave}
            onSaveAndExport={onSaveAndExport}
            isSubmitting={isSubmitting}
            label={isEditMode ? "Cập nhật" : "Lưu đơn thư"}
            idPrefix="btn-save"
          />
          {canConvert && (
            <button
              type="button"
              data-testid="btn-convert-petition"
              onClick={() => setShowConvertModal(true)}
              className="flex items-center gap-2 px-4 sm:px-6 py-2.5 min-h-[44px] bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
            >
              Chuyển đổi
            </button>
          )}
        </div>
      </form>

      {/* Nhóm II: ConvertPetitionModal */}
      {showConvertModal && id && (
        <ConvertPetitionModal
          petitionUpdatedAt={recordUpdatedAt}
          onClose={() => setShowConvertModal(false)}
          onSubmitIncident={async (payload: ConvertToIncidentPayload) => {
            const res = await api.post(`/petitions/${id}/convert-incident`, payload);
            setShowConvertModal(false);
            const incidentId = res?.data?.data?.incident?.id;
            navigate(incidentId ? `/incidents/${incidentId}/edit` : `/incidents`);
          }}
          onSubmitCase={async (payload: ConvertToCasePayload) => {
            const res = await api.post(`/petitions/${id}/convert-case`, payload);
            setShowConvertModal(false);
            const caseId = res?.data?.data?.case?.id;
            navigate(caseId ? `/cases/${caseId}/edit` : `/cases`);
          }}
        />
      )}

      {/* Popup "Xuất chứng từ" sau "Lưu và xuất file" — đóng popup → về danh sách. */}
      {exportModalForId && (
        <DynamicExportDocumentsModal
          entity="petitions"
          entityId={exportModalForId}
          onClose={() => {
            setExportModalForId(null);
            if (exportNavigateOnClose) navigate("/petitions");
          }}
          onEntityPatched={(updatedAt, fields) => {
            // Popup vừa PUT bổ sung trường thiếu → đồng bộ form: refresh mốc optimistic-lock +
            // các field vừa lưu. Cập nhật LUÔN savedSnapshotRef để form KHÔNG bị coi là dirty
            // (các field đã lưu vào DB) → không chặn nút export cũ (ExportDocumentDropdown) (codex#2).
            if (updatedAt) setRecordUpdatedAt(updatedAt);
            setFormData((prev) => {
              const next = { ...prev, ...(fields as Partial<typeof prev>) };
              savedSnapshotRef.current = JSON.stringify(next);
              return next;
            });
          }}
        />
      )}
    </div>
  );
}

export default PetitionFormPage;
