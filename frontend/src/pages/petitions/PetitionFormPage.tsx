/**
 * PetitionFormPage - Thêm mới / Chỉnh sửa Đơn thư
 * TASK-ID: TASK-2026-260202
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import {
  ArrowLeft, AlertCircle, Calendar, User,
  FileText, MapPin, Phone, Mail, ChevronDown,
} from "lucide-react";
import { FKSelect } from "@/components/FKSelect";
import { CrimeSelect } from "@/components/CrimeSelect";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { DocNumberPreviewField } from "@/components/DocNumberPreviewField";
import { documentNumbersApi } from "@/features/document-numbers/api";
import { SaveSplitButton } from "@/features/petitions/components/SaveSplitButton";
import { DynamicExportDocumentsModal } from "@/features/document-templates/components/DynamicExportDocumentsModal";
import { useFormDefaults } from "@/hooks/useFormDefaults";
import { today, toDateInput } from "@/lib/dates";
import { LOAI_DON_OPTIONS } from "@/shared/enums/status-labels";
import { LoaiDon } from "@/shared/enums/generated";
import { EntityDocumentsTab } from "@/components/documents/EntityDocumentsTab";
import { PetitionCreateDocumentsStage, type PetitionStageHandle } from "@/features/petitions/components/PetitionCreateDocumentsStage";
import { PetitionAssignmentSection } from "./PetitionAssignmentSection";
import { ConvertPetitionModal, type ConvertToIncidentPayload, type ConvertToCasePayload } from "./ConvertPetitionModal";

const VALID_PETITION_TYPES = Object.values(LoaiDon) as string[];

interface UserOption {
  id: string;
  firstName?: string;
  lastName?: string;
  username: string;
}

interface FormData {
  stt: string; receivedDate: string; unit: string; assignedTeamId: string;
  senderName: string;
  senderBirthYear: string; senderAddress: string; senderPhone: string;
  senderEmail: string; suspectedPerson: string; suspectedAddress: string;
  petitionType: string; priority: string; summary: string;
  detailContent: string; attachmentsNote: string; deadline: string;
  assignedToId: string; notes: string;
  // v0.47 PR3.1 — Nội dung phiếu đề xuất (T11)
  nhanThay: string;
  deXuat: string;
  raSoatTrung: string;
  baoCaoBanGiamDoc: boolean;
  // Field-parity hệ thống cũ (giai đoạn tiếp nhận)
  senderIdNumber: string;
  senderIdIssueDate: string;
  senderIdIssuePlace: string;
  senderIsAnonymous: boolean;
  loaiThongTin: string;
  soPhieuChuyen: string;
  ngayPhieuChuyen: string;
  ngayTiepNhanNguonTin: string;
  toiDanhBanDau: string;
  crimeChinhId: string;
  noiXayRa: string;
  noiXayRaPhuongXa: string;
  ngayXayRa: string;
  loaiToiPham: string;
  phuongThucThuDoan: string;
  ngayGiaoDonViGiaiQuyet: string;
  laCongNgheCao: boolean;
  lanhDaoToTung: string;
  ketQuaXuLyKhac: string;
  thoiHanUTDT: string;
  // Field-parity bổ sung tab "Thông tin" form cũ /doi-1/Them (2026-06-26)
  nguonDon: string;
  petitionDate: string;
  ngayDeXuat: string;
  phanLoaiNguonTin: string;
  dieuTraVien: string;
  donViGiaiQuyet: string;
}

const INITIAL_FORM: FormData = {
  stt: "", receivedDate: today(), unit: "", assignedTeamId: "",
  senderName: "", senderBirthYear: "", senderAddress: "", senderPhone: "",
  senderEmail: "", suspectedPerson: "", suspectedAddress: "", petitionType: "",
  priority: "", summary: "", detailContent: "", attachmentsNote: "",
  deadline: "", assignedToId: "", notes: "",
  nhanThay: "", deXuat: "", raSoatTrung: "Không", baoCaoBanGiamDoc: false,
  senderIdNumber: "", senderIdIssueDate: "", senderIdIssuePlace: "",
  senderIsAnonymous: false, loaiThongTin: "", soPhieuChuyen: "",
  ngayPhieuChuyen: "", ngayTiepNhanNguonTin: "", toiDanhBanDau: "",
  crimeChinhId: "", noiXayRa: "", noiXayRaPhuongXa: "", ngayXayRa: "",
  loaiToiPham: "", phuongThucThuDoan: "", ngayGiaoDonViGiaiQuyet: "",
  laCongNgheCao: false, lanhDaoToTung: "", ketQuaXuLyKhac: "", thoiHanUTDT: "",
  nguonDon: "", petitionDate: "", ngayDeXuat: "", phanLoaiNguonTin: "", dieuTraVien: "", donViGiaiQuyet: "",
};

function displayName(u: UserOption): string {
  const full = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return full || u.username;
}

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
  const [errors, setErrors] = useState<string[]>([]);
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

  const [suspectQuery, setSuspectQuery] = useState("");
  const [suspectResults, setSuspectResults] = useState<SuspectResult[]>([]);
  const [showSuspectDropdown, setShowSuspectDropdown] = useState(false);
  const [dupQuery, setDupQuery] = useState("");
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
    }));
  }, [isEditMode, defaults.isLoaded, defaults.today, defaults.primaryTeamId, defaults.primaryTeamName]);

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
    const newErrors: string[] = [];
    if (!formData.receivedDate) {
      newErrors.push("Ngày tiếp nhận là bắt buộc");
    } else if (formData.receivedDate > today()) {
      // So sánh chuỗi YYYY-MM-DD theo today() (giờ VN) — nhất quán với `max={today()}` của input
      // + default receivedDate. Tránh lệch biên múi giờ khi runtime TZ sau VN (vd CI chạy UTC).
      newErrors.push("Ngày tiếp nhận không được là ngày tương lai");
    }
    const anon = formData.senderIsAnonymous;
    if (!anon && !formData.senderName.trim()) newErrors.push("Tên người gửi là bắt buộc");
    if (!anon && !formData.senderAddress.trim()) newErrors.push("Địa chỉ người gửi là bắt buộc");
    if (!formData.petitionType || !VALID_PETITION_TYPES.includes(formData.petitionType)) {
      newErrors.push("Loại đơn thư là bắt buộc");
    }
    // priority là optional theo backend DTO (@IsOptional)
    if (!formData.summary.trim()) newErrors.push("Tóm tắt nội dung là bắt buộc");
    if (!formData.detailContent.trim()) newErrors.push("Nội dung chi tiết là bắt buộc");
    if (formData.senderEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.senderEmail))
      newErrors.push("Email không đúng định dạng");
    if (formData.senderPhone && !/^0\d{9}$/.test(formData.senderPhone))
      newErrors.push("Số điện thoại không đúng định dạng (10 số, bắt đầu bằng 0)");
    // Required-on-create (trừ nặc danh): SĐT nguyên đơn + Tội danh chính (theo hệ thống cũ).
    // effectiveEdit: sau khi đã tạo (createdId) thì coi như edit → không bắt lại field create-only.
    if (!effectiveEdit && !anon) {
      if (!formData.senderPhone.trim()) newErrors.push("Số điện thoại nguyên đơn là bắt buộc (trừ đơn nặc danh)");
      if (!formData.crimeChinhId) newErrors.push("Tội danh chính là bắt buộc (trừ đơn nặc danh)");
    }
    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Tách phần LƯU (không điều hướng) → trả { ok, id } để onSave/onSaveAndExport
  // quyết định điều hướng hay mở popup xuất chứng từ. [F2] create bắt id từ response.
  const saveOnly = async (): Promise<{ ok: boolean; id: string | null; uploadFailed?: number }> => {
    if (savingRef.current) return { ok: false, id: null }; // đang lưu → bỏ qua click lặp
    if (!validateForm()) { window.scrollTo({ top: 0, behavior: "smooth" }); return { ok: false, id: null }; }
    savingRef.current = true;
    setIsSubmitting(true);
    try {
      const payload = {
        // Gửi stt CHỈ khi SỬA (edit field stt = MANUAL, cho phép sửa). Khi TẠO mới: KHÔNG gửi —
        // "Số tiếp nhận" tạo mới là số TỰ ĐỘNG (khoá), chỉ là PREVIEW từ draft(). Gửi số preview →
        // backend vào nhánh dto.stt (bỏ qua commitWithTx, counter không tăng) → số kế tiếp TRÙNG →
        // 409 cho create sau. Bỏ → backend tự cấp atomic (commitWithTx re-sync dbMax, không trùng).
        ...(effectiveEdit ? { stt: formData.stt } : {}),
        receivedDate: formData.receivedDate,
        unit: formData.unit || undefined,
        assignedTeamId: formData.assignedTeamId || undefined,
        senderName: formData.senderName,
        senderBirthYear: formData.senderBirthYear || undefined,
        senderAddress: formData.senderAddress || undefined,
        senderPhone: formData.senderPhone || undefined,
        senderEmail: formData.senderEmail || undefined,
        suspectedPerson: formData.suspectedPerson || undefined,
        suspectedAddress: formData.suspectedAddress || undefined,
        petitionType: formData.petitionType || undefined,
        priority: formData.priority || undefined,
        summary: formData.summary || undefined,
        detailContent: formData.detailContent || undefined,
        attachmentsNote: formData.attachmentsNote || undefined,
        deadline: formData.deadline || undefined,
        assignedToId: formData.assignedToId || undefined,
        notes: formData.notes || undefined,
        // v0.47 PR3.1 review fix: send empty strings explicitly so backend can
        // clear previously-saved nội dung phiếu đề xuất when officer wipes a field.
        // (Backend service spreads conditionally on `!== undefined`.)
        nhanThay: formData.nhanThay,
        deXuat: formData.deXuat,
        raSoatTrung: formData.raSoatTrung,
        baoCaoBanGiamDoc: formData.baoCaoBanGiamDoc,
        // Field-parity hệ thống cũ
        senderIdNumber: formData.senderIdNumber || undefined,
        senderIdIssueDate: formData.senderIdIssueDate || undefined,
        senderIdIssuePlace: formData.senderIdIssuePlace || undefined,
        senderIsAnonymous: formData.senderIsAnonymous,
        loaiThongTin: formData.loaiThongTin || undefined,
        soPhieuChuyen: formData.soPhieuChuyen || undefined,
        ngayPhieuChuyen: formData.ngayPhieuChuyen || undefined,
        ngayTiepNhanNguonTin: formData.ngayTiepNhanNguonTin || undefined,
        toiDanhBanDau: formData.toiDanhBanDau || undefined,
        crimeChinhId: formData.crimeChinhId || undefined,
        noiXayRa: formData.noiXayRa || undefined,
        noiXayRaPhuongXa: formData.noiXayRaPhuongXa || undefined,
        ngayXayRa: formData.ngayXayRa || undefined,
        loaiToiPham: formData.loaiToiPham || undefined,
        phuongThucThuDoan: formData.phuongThucThuDoan || undefined,
        ngayGiaoDonViGiaiQuyet: formData.ngayGiaoDonViGiaiQuyet || undefined,
        laCongNgheCao: formData.laCongNgheCao,
        lanhDaoToTung: formData.lanhDaoToTung || undefined,
        ketQuaXuLyKhac: formData.ketQuaXuLyKhac || undefined,
        thoiHanUTDT: formData.thoiHanUTDT || undefined,
        // Field-parity bổ sung tab "Thông tin" form cũ /doi-1/Them (2026-06-26)
        nguonDon: formData.nguonDon || undefined,
        petitionDate: formData.petitionDate || undefined,
        ngayDeXuat: formData.ngayDeXuat || undefined,
        phanLoaiNguonTin: formData.phanLoaiNguonTin || undefined,
        dieuTraVien: formData.dieuTraVien || undefined,
        donViGiaiQuyet: formData.donViGiaiQuyet || undefined,
      };
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

  const update = (field: keyof FormData, value: string | boolean) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  if (isLoadingData) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <p className="text-slate-500">Đang tải dữ liệu...</p>
      </div>
    );
  }

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

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* Section 1: Thông tin tiếp nhận */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-bold text-slate-800">Thông tin tiếp nhận</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ngày tiếp nhận <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="date" value={formData.receivedDate} onChange={(e) => update("receivedDate", e.target.value)} max={today()} className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-receivedDate" />
                </div>
              </div>
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
              <div>
                <FKSelect
                  label="Đơn vị tiếp nhận"
                  directoryType="ORG"
                  value={formData.unit}
                  onChange={(v) => update("unit", v)}
                  placeholder="Chọn đơn vị"
                  testId="field-unit"
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
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={formData.senderName} onChange={(e) => update("senderName", e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nhập họ và tên" data-testid="field-senderName" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Năm sinh</label>
                <input type="text" value={formData.senderBirthYear} onChange={(e) => update("senderBirthYear", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Năm sinh (VD: 1985)" maxLength={4} data-testid="field-senderBirthYear" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Địa chỉ <span className="text-red-500">*</span></label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <textarea value={formData.senderAddress} onChange={(e) => update("senderAddress", e.target.value)} rows={2} className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nhập địa chỉ đầy đủ" data-testid="field-senderAddress" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Số điện thoại</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <PhoneInput value={formData.senderPhone} onValueChange={(v) => update("senderPhone", v)} className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="09xx xxx xxx" data-testid="field-senderPhone" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="email" value={formData.senderEmail} onChange={(e) => update("senderEmail", e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nhập email" data-testid="field-senderEmail" />
                </div>
              </div>
              {/* Giấy tờ tùy thân (CCCD) — field-parity */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Số CCCD nguyên đơn</label>
                <input type="text" value={formData.senderIdNumber} onChange={(e) => update("senderIdNumber", e.target.value)} disabled={formData.senderIsAnonymous} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100" placeholder="Số CCCD/CMND" maxLength={20} data-testid="field-senderIdNumber" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ngày cấp CCCD</label>
                <input type="date" value={formData.senderIdIssueDate} onChange={(e) => update("senderIdIssueDate", e.target.value)} max={today()} disabled={formData.senderIsAnonymous} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100" data-testid="field-senderIdIssueDate" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-2">Nơi cấp CCCD</label>
                <input type="text" value={formData.senderIdIssuePlace} onChange={(e) => update("senderIdIssuePlace", e.target.value)} disabled={formData.senderIsAnonymous} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100" placeholder="Nơi cấp CCCD" data-testid="field-senderIdIssuePlace" />
              </div>
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
              <label className="block text-sm font-medium text-slate-700 mb-2">Phân loại nguồn tin ban đầu</label>
              <select value={formData.phanLoaiNguonTin} onChange={(e) => update("phanLoaiNguonTin", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" data-testid="field-phanLoaiNguonTin">
                <option value="">-- Chọn phân loại --</option>
                <option value="don-cong-van-ban-dau">Đơn, Công văn</option>
                <option value="vu-viec-ban-dau">Vụ việc</option>
                <option value="vu-viec-nguon-tin">Vụ việc (nguồn tin)</option>
                <option value="vu-an-ban-dau">Vụ án</option>
                <option value="tra-ho-so-ban-dau">Trả hồ sơ cho đơn vị chuyển</option>
                <option value="huong-dan-ban-dau">Hướng dẫn nghiệp vụ</option>
                <option value="trao-doi-chuyen-an">Trao đổi chuyển án</option>
                <option value="luat-su">Luật sư</option>
                <option value="uy-thac-dieu-tra">Ủy thác điều tra</option>
                <option value="kien-nghi-vks">Kiến nghị VKS</option>
                <option value="cong-van-don-doc-phuc-hoi-tdc">Công văn đôn đốc phục hồi TĐC</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nguồn đơn</label>
              <input type="text" value={formData.nguonDon} onChange={(e) => update("nguonDon", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Bưu điện, Trực tiếp, PC01 Công an TPHCM,..." data-testid="field-nguonDon" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ngày viết đơn</label>
              <input type="date" value={formData.petitionDate} onChange={(e) => update("petitionDate", e.target.value)} max={today()} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-petitionDate" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ngày đề xuất</label>
              <input type="date" value={formData.ngayDeXuat} onChange={(e) => update("ngayDeXuat", e.target.value)} max={today()} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-ngayDeXuat" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Loại thông tin</label>
              <input type="text" value={formData.loaiThongTin} onChange={(e) => update("loaiThongTin", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tố giác, trình báo, kiến nghị, phản ánh, khiếu nại..." data-testid="field-loaiThongTin" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Số phiếu chuyển / công văn / UTĐT</label>
              <input type="text" value={formData.soPhieuChuyen} onChange={(e) => update("soPhieuChuyen", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Số phiếu chuyển từ đơn vị khác" data-testid="field-soPhieuChuyen" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ngày phiếu chuyển</label>
              <input type="date" value={formData.ngayPhieuChuyen} onChange={(e) => update("ngayPhieuChuyen", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-ngayPhieuChuyen" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ngày tiếp nhận nguồn tin</label>
              <input type="date" value={formData.ngayTiepNhanNguonTin} onChange={(e) => update("ngayTiepNhanNguonTin", e.target.value)} max={today()} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-ngayTiepNhanNguonTin" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nơi xảy ra</label>
              <input type="text" value={formData.noiXayRa} onChange={(e) => update("noiXayRa", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Địa điểm nơi xảy ra" data-testid="field-noiXayRa" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nơi xảy ra (phường/xã)</label>
              <input type="text" value={formData.noiXayRaPhuongXa} onChange={(e) => update("noiXayRaPhuongXa", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Phường/xã nơi xảy ra" data-testid="field-noiXayRaPhuongXa" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ngày xảy ra</label>
              <input type="date" value={formData.ngayXayRa} onChange={(e) => update("ngayXayRa", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-ngayXayRa" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Loại tội phạm</label>
              <select value={formData.loaiToiPham} onChange={(e) => update("loaiToiPham", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" data-testid="field-loaiToiPham">
                <option value="">-- Chọn loại tội phạm --</option>
                <option value="TTXH">TTXH</option>
                <option value="Kinh tế-Ma túy">Kinh tế-Ma túy</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Phương thức, thủ đoạn</label>
              <textarea value={formData.phuongThucThuDoan} onChange={(e) => update("phuongThucThuDoan", e.target.value)} rows={3} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Nhập phương thức thủ đoạn" data-testid="field-phuongThucThuDoan" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ngày giao đơn vị giải quyết</label>
              <input type="date" value={formData.ngayGiaoDonViGiaiQuyet} onChange={(e) => update("ngayGiaoDonViGiaiQuyet", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-ngayGiaoDonViGiaiQuyet" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Tội danh cũ trước đây</label>
              <div className="relative">
                <input
                  type="text"
                  value={suspectQuery !== "" ? suspectQuery : formData.toiDanhBanDau}
                  onChange={(e) => {
                    const v = e.target.value;
                    handleSuspectInput(v);
                  }}
                  onFocus={() => suspectResults.length > 0 && setShowSuspectDropdown(true)}
                  onBlur={() => setTimeout(() => {
                    setShowSuspectDropdown(false);
                    if (suspectQuery !== "") {
                      update("toiDanhBanDau", suspectQuery);
                      setSuspectQuery("");
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
                          setSuspectQuery("");
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
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" value={formData.suspectedPerson} onChange={(e) => update("suspectedPerson", e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Nhập tên đối tượng (nếu có)" data-testid="field-suspectedPerson" />
                </div>
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
                <CrimeSelect
                  label="Tội danh chính (BLHS 2015)"
                  required={!isEditMode && !formData.senderIsAnonymous}
                  value={formData.crimeChinhId}
                  onChange={(v) => update("crimeChinhId", v)}
                  placeholder="Chọn tội danh chính"
                  testId="field-crimeChinhId"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Lãnh đạo phụ trách tố tụng</label>
                <input type="text" value={formData.lanhDaoToTung} onChange={(e) => update("lanhDaoToTung", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tên lãnh đạo phụ trách ký tố tụng" data-testid="field-lanhDaoToTung" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Điều tra viên</label>
                <input type="text" value={formData.dieuTraVien} onChange={(e) => update("dieuTraVien", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tên điều tra viên thụ lý" data-testid="field-dieuTraVien" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đơn vị giải quyết</label>
                <input type="text" value={formData.donViGiaiQuyet} onChange={(e) => update("donViGiaiQuyet", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Đơn vị giải quyết (khác đơn vị tiếp nhận)" data-testid="field-donViGiaiQuyet" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={formData.laCongNgheCao} onChange={(e) => update("laCongNgheCao", e.target.checked)} className="w-4 h-4" data-testid="field-laCongNgheCao" />
              Tội phạm công nghệ cao
            </label>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Tóm tắt nội dung <span className="text-red-500">*</span></label>
              <textarea value={formData.summary} onChange={(e) => update("summary", e.target.value)} rows={2} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Tóm tắt ngắn gọn nội dung đơn thư" data-testid="field-summary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nội dung chi tiết <span className="text-red-500">*</span></label>
              <textarea value={formData.detailContent} onChange={(e) => update("detailContent", e.target.value)} rows={6} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Mô tả chi tiết đầy đủ nội dung đơn thư" data-testid="field-detailContent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <FileText className="inline w-4 h-4 mr-1 text-slate-400" />
                Ghi chú tài liệu đính kèm
              </label>
              <input type="text" value={formData.attachmentsNote} onChange={(e) => update("attachmentsNote", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Liệt kê tài liệu đính kèm dạng ghi chú" data-testid="field-attachmentsNote" />
              <p className="text-xs text-slate-500 mt-1">File thực tế tải lên ở mục "Tài liệu đính kèm thực tế" bên dưới.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Kết quả xử lý, giải quyết khác</label>
              <textarea value={formData.ketQuaXuLyKhac} onChange={(e) => update("ketQuaXuLyKhac", e.target.value)} rows={2} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Các trường hợp xử lý, giải quyết khác" data-testid="field-ketQuaXuLyKhac" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Thời hạn ủy thác điều tra</label>
              <input type="date" value={formData.thoiHanUTDT} onChange={(e) => update("thoiHanUTDT", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="field-thoiHanUTDT" />
              <p className="text-xs text-slate-500 mt-1">Thời hạn thực hiện ủy thác điều tra (nếu có)</p>
            </div>
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
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nhận thấy</label>
                <textarea
                  value={formData.nhanThay}
                  onChange={(e) => update("nhanThay", e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Đánh giá của cán bộ về đơn thư (ví dụ: 'Đơn có dấu hiệu tội phạm theo Đ.123 BLHS...')"
                  data-testid="field-nhanThay"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Đề xuất xử lý</label>
                <textarea
                  value={formData.deXuat}
                  onChange={(e) => update("deXuat", e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 text-base sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Đề xuất hướng giải quyết (ví dụ: 'Đề xuất chuyển PC01 thụ lý theo thẩm quyền...')"
                  data-testid="field-deXuat"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Ghi chú trùng đơn</label>
                <div className="relative">
                  <input
                    type="text"
                    value={dupQuery !== "" ? dupQuery : formData.raSoatTrung}
                    onChange={(e) => {
                      const v = e.target.value;
                      handleDupInput(v);
                    }}
                    onFocus={() => dupResults.length > 0 && setShowDupDropdown(true)}
                    onBlur={() => setTimeout(() => {
                      setShowDupDropdown(false);
                      if (dupQuery !== "") {
                        update("raSoatTrung", dupQuery);
                        setDupQuery("");
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
                            setDupQuery("");
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
              </div>
              <div>
                <label className="inline-flex items-center gap-2 cursor-pointer" data-testid="field-baoCaoBanGiamDoc-wrap">
                  <input
                    type="checkbox"
                    checked={formData.baoCaoBanGiamDoc}
                    onChange={(e) => update("baoCaoBanGiamDoc", e.target.checked)}
                    className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    data-testid="field-baoCaoBanGiamDoc"
                  />
                  <span className="text-sm text-slate-700">Thuộc trường hợp báo cáo Ban Giám đốc</span>
                </label>
              </div>
            </div>
          </div>

        {/* Nhóm I: Phân công cán bộ — edit mode only */}
        {isEditMode && id && (
          <PetitionAssignmentSection petitionId={id} userOptions={userOptions} />
        )}

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
