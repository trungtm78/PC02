import {
  Hash,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  FileText,
  Users,
  Package,
  Plus,
  Eye,
  Download,
  Upload,
  Video,
  Scale,
  Mail,
  DollarSign,
  AlertCircle,
  Radio,
  Trash2,
  CheckCircle,
  Info,
  History,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { today, formatVNDate } from "@/lib/dates";
import { useShortcut } from "@/hooks/useShortcut";
import { FormInput, FormSelect, FormTextarea, FormCurrency, FormPhone, FormInteger } from "@/components/form";
import { DocNumberPreviewField } from "@/components/DocNumberPreviewField";
import { CurrencyInput } from "@/components/inputs/CurrencyInput";
import { IntegerInput } from "@/components/inputs/IntegerInput";
import { Card, CardHeader, EmptyState, DataTable, ActionButtons, StatusBadge } from "@/components/shared";
import type { ColumnDef } from "@/components/shared";
import { FKSelect } from "@/components/FKSelect";
import { ProvinceWardSelect } from "@/components/ProvinceWardSelect";
import type { TabProps, Subject, Evidence, MediaFile } from "./types";
import { EntityDocumentsTab } from "@/components/documents/EntityDocumentsTab";
import {
  STATUS_OPTIONS,
  SUBJECT_TYPE_COLORS,
  CASE_PROVENANCE_OPTIONS,
} from "./constants";
import { CaseProvenancePicker } from "./CaseProvenancePicker";
import { LinkedIncidentCard } from "./LinkedIncidentCard";
import { CaseFormTab1UyThac } from "./CaseFormTab1UyThac";
import { CaseProvenance } from "../../../shared/enums/generated";

// Branch-3 provenances that trigger Incident auto-create (module-level, not inside render)
const DIRECT_PROVENANCES = new Set([
  CaseProvenance.DIRECT_DISCOVERY,
  CaseProvenance.TRANSFERRED,
  CaseProvenance.SELF_SURRENDER,
  CaseProvenance.PROSECUTOR_PROPOSAL,
  CaseProvenance.OTHER_LEGAL_SOURCE,
]);

// ─── Helper ──────────────────────────────────────────────────────────────────

function useFieldUpdater(
  _formData: TabProps["formData"],
  setFormData: TabProps["setFormData"],
  errors: TabProps["errors"],
  setErrors: TabProps["setErrors"]
) {
  return (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 1: Thông tin (50+ trường nghiệp vụ)
// ═════════════════════════════════════════════════════════════════════════════

export function TabInfo({ formData, setFormData, errors, setErrors, handlerOptions = [], handlerLoading = false, isDraftCodeLoading = false }: TabProps) {
  const update = useFieldUpdater(formData, setFormData, errors, setErrors);

  // ── Administrative reform: 2-tier address (Province → Ward) ──
  // Records loaded from DB that already have a district are "existing legacy" — show read-only badge
  const isExistingLegacy = !!formData.district;
  const [legacyMode, setLegacyMode] = useState(!!formData.district);

  const handleLegacyToggle = () => {
    if (legacyMode && !isExistingLegacy) {
      // Only clear district if user set it in this session — never clear DB-loaded values
      update("district", "");
    }
    setLegacyMode((prev) => !prev);
  };

  // Migrated to centralized shortcut registry (Ctrl+Shift+L default).
  useShortcut('toggleLegacyMode', handleLegacyToggle);

  // Abolished districts — lazy-loaded only when legacy toggle is open
  // Note: ward selection (post-reform) handled by ProvinceWardSelect below. The
  // dead `wardOptions` + `legacyWardOptions` queries were removed in v0.34.0.2
  // — they pulled 10k entries from /directories on every form mount.
  const { data: districtOptions } = useQuery({
    queryKey: ["directories", "DISTRICT", "legacy"],
    queryFn: () =>
      api.get("/directories?type=DISTRICT&isActive=false").then((r) =>
        (r.data.data ?? []).map((d: any) => ({
          value: d.code,
          label: `${d.name} (trước ${d.abolishedAt ? new Date(d.abolishedAt).toLocaleDateString("vi-VN", { year: "numeric", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }) : "07/2025"})`,
        }))
      ),
    enabled: legacyMode && !isExistingLegacy,
  });

  // Decision 6A 10/10 (a11y): aria-live region announces conditional field appearance for screen readers.
  const provenanceAnnouncement = formData.caseProvenance === 'FROM_PETITION'
    ? 'Đã hiển thị thêm trường: Chọn Đơn thư gốc'
    : formData.caseProvenance === 'FROM_INCIDENT'
    ? 'Đã hiển thị thêm trường: Chọn Vụ việc gốc'
    : formData.caseProvenance
    ? 'Đã hiển thị thêm trường: Ghi chú nguồn'
    : '';

  return (
    <div className="space-y-6" data-testid="tab-info">
      {/* Decision 6A 10/10 — aria-live region (visually hidden, screen-reader only) */}
      <div aria-live="polite" className="sr-only" data-testid="provenance-announce">
        {provenanceAnnouncement}
      </div>

      {/* ── v0.37.1: Nguồn vụ án Card (BLTTHS Đ.143) ─────────────────────── */}
      {/* Decision 1A 10/10: separate Card at top of form to maximize visual */}
      {/* hierarchy for legal provenance. Source-first per nghiệp vụ. */}
      <Card>
        <CardHeader title="Nguồn vụ án (BLTTHS Đ.143)" />
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Theo Điều 143 BLTTHS 2015: nguồn tin về tội phạm gồm tố giác, tin báo,
            kiến nghị khởi tố, tự thú, hoặc CQĐT phát hiện trực tiếp. Chọn nguồn
            phù hợp để hệ thống ghi nhận đúng căn cứ pháp lý.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <FormSelect
              label="Nguồn vụ án"
              required
              autoFocus
              value={formData.caseProvenance}
              onChange={(v) => update("caseProvenance", v)}
              options={CASE_PROVENANCE_OPTIONS}
              error={errors.caseProvenance}
              placeholder="-- Chọn nguồn --"
              data-testid="select-case-provenance"
            />
            {/* Conditional picker/textarea — sub-6 Decisions 2A/2B/2C 10/10 */}
            <div className="md:col-span-2">
              <CaseProvenancePicker
                provenance={formData.caseProvenance}
                linkedPetitionId={formData.linkedPetitionId}
                linkedIncidentId={formData.linkedIncidentId}
                sourceDocumentNote={formData.sourceDocumentNote}
                expectedPetitionUpdatedAt={formData.expectedPetitionUpdatedAt}
                expectedIncidentUpdatedAt={formData.expectedIncidentUpdatedAt}
                errors={errors}
                update={update}
              />
            </div>
          </div>
          {/* Helper text — show selected option's legal-basis description */}
          {formData.caseProvenance && (
            <p className="text-xs text-gray-500 italic">
              {CASE_PROVENANCE_OPTIONS.find((o) => o.value === formData.caseProvenance)?.helperText}
            </p>
          )}
        </div>
      </Card>

      {/* ── Nhóm 1: Thông tin hồ sơ ── */}
      <Card>
        <CardHeader title="Thông tin hồ sơ" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {formData.caseProvenance === 'UY_THAC_DIEU_TRA' ? 'Số ủy thác' : 'Mã hồ sơ'}
            </label>
            <DocNumberPreviewField
              inputMode="AUTO"
              value={formData.caseCode}
              onChange={(v) => update("caseCode", v)}
              loading={isDraftCodeLoading}
              placeholder={formData.caseProvenance === 'UY_THAC_DIEU_TRA' ? 'UTDT-2026-00001' : 'HS-2026-001'}
            />
            {errors.caseCode && (
              <p className="text-xs text-red-600 mt-1">{errors.caseCode}</p>
            )}
          </div>
          <FormInput
            label="Ngày tiếp nhận"
            required
            type="date"
            icon={<Calendar className="w-4 h-4" />}
            value={formData.receiveDate}
            onChange={(v) => update("receiveDate", v)}
            error={errors.receiveDate}
            data-testid="input-receive-date"
          />
          <FormInput
            label="Giờ tiếp nhận"
            type="time"
            icon={<Clock className="w-4 h-4" />}
            value={formData.receiveTime}
            onChange={(v) => update("receiveTime", v)}
          />
          {/* v0.37.1: "Loại hồ sơ" FormSelect removed (vestigial). Replaced by "Nguồn vụ án" Card at top of form (sub-5). */}
          <FKSelect
            label="Phân loại vụ án"
            value={formData.caseClassification}
            onChange={(v) => update("caseClassification", v)}
            directoryType="CASE_CLASSIFICATION"
            placeholder="-- Chọn phân loại --"
            canCreate={false}
          />
          <FormSelect
            label="Trạng thái"
            value={formData.status}
            onChange={(v) => update("status", v)}
            options={STATUS_OPTIONS}
            placeholder="-- Chọn trạng thái --"
          />
          <FKSelect
            label="Mức độ ưu tiên"
            value={formData.priority}
            onChange={(v) => update("priority", v)}
            directoryType="PRIORITY"
            placeholder="-- Chọn mức độ --"
            canCreate={false}
          />
          <FormSelect
            label="Mức độ tội phạm (BLHS 2015 Điều 9)"
            value={formData.capDoToiPham ?? ""}
            onChange={(v) => update("capDoToiPham", v)}
            options={[
              { value: "IT_NGHIEM_TRONG", label: "Ít nghiêm trọng (đến 3 năm)" },
              { value: "NGHIEM_TRONG", label: "Nghiêm trọng (đến 7 năm)" },
              { value: "RAT_NGHIEM_TRONG", label: "Rất nghiêm trọng (đến 15 năm)" },
              { value: "DAC_BIET_NGHIEM_TRONG", label: "Đặc biệt nghiêm trọng (trên 15 năm / tử hình)" },
            ]}
            placeholder="-- Chọn mức độ tội phạm --"
          />
          <FKSelect
            label="Điều tra viên chính"
            required
            value={formData.handler}
            onChange={(v) => update("handler", v)}
            options={handlerOptions}
            loading={handlerLoading}
            error={errors.handler}
            placeholder="Tìm kiếm ĐTV..."
            canCreate={false}
            testId="fk-handler"
          />
          <FKSelect
            label="Đơn vị thụ lý"
            value={formData.supervisingUnit}
            onChange={(v) => update("supervisingUnit", v)}
            directoryType="UNIT"
            placeholder="-- Chọn đơn vị --"
            canCreate={false}
            testId="fk-unit"
          />
          {/* v0.37.1: "Loại đơn thư" (petitionType LoaiDon) removed — now property of linked Petition record, not Case. Captured via Petition picker in Nguồn vụ án Card (sub-6). */}
        </div>
      </Card>

      {/* ── Nhóm 2: Tiêu đề & Mô tả ── */}
      <Card>
        <CardHeader title="Nội dung hồ sơ" />
        <div className="space-y-4">
          <FormInput
            label="Tiêu đề hồ sơ"
            required
            value={formData.caseTitle}
            onChange={(v) => update("caseTitle", v)}
            error={errors.caseTitle}
            placeholder="Nhập tiêu đề ngắn gọn về vụ án/vụ việc"
            data-testid="input-case-title"
          />
          <FormTextarea
            label="Mô tả chi tiết"
            value={formData.description}
            onChange={(v) => update("description", v)}
            placeholder="Mô tả tóm tắt diễn biến và nội dung hồ sơ..."
            rows={4}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormCurrency
              label="Thiệt hại ước tính (VNĐ)"
              icon={<DollarSign className="w-4 h-4" />}
              value={formData.damageAmount}
              onChange={(v) => update("damageAmount", v)}
              placeholder="0"
            />
            <FormTextarea
              label="Mô tả thiệt hại"
              value={formData.damageDescription}
              onChange={(v) => update("damageDescription", v)}
              placeholder="Chi tiết thiệt hại về người và tài sản..."
              rows={2}
            />
          </div>
          <FormInput
            label="Mã vụ án liên quan"
            icon={<Hash className="w-4 h-4" />}
            value={formData.relatedCaseCode}
            onChange={(v) => update("relatedCaseCode", v)}
            placeholder="Nhập mã vụ án liên quan (nếu có)"
          />
          <FormTextarea
            label="Ghi chú"
            value={formData.note}
            onChange={(v) => update("note", v)}
            placeholder="Các lưu ý đặc biệt, cảnh báo nghiệp vụ..."
            rows={2}
          />
        </div>
      </Card>

      {/* ── Nhóm 3: Thông tin điều tra ── */}
      <Card>
        <CardHeader title="Thông tin điều tra" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="Ngày bắt đầu điều tra"
            type="date"
            icon={<Calendar className="w-4 h-4" />}
            value={formData.investigationStartDate}
            onChange={(v) => update("investigationStartDate", v)}
          />
          <FormInput
            label="Hạn điều tra"
            type="date"
            icon={<Clock className="w-4 h-4" />}
            value={formData.investigationDeadline}
            onChange={(v) => update("investigationDeadline", v)}
          />
          <FKSelect
            label="VKS được phân công"
            value={formData.prosecutionOfficeAssigned}
            onChange={(v) => update("prosecutionOfficeAssigned", v)}
            directoryType="PROSECUTION_OFFICE"
            placeholder="-- Chọn VKS --"
            canCreate={false}
            testId="fk-prosecution-assigned"
          />
        </div>
      </Card>

      {/* ── Nhóm 4: Người tố cáo/báo tin ── */}
      <Card>
        <CardHeader title="Người tố cáo / Báo tin" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Họ và tên"
            icon={<User className="w-4 h-4" />}
            value={formData.reporter}
            onChange={(v) => update("reporter", v)}
            placeholder="Họ và tên người báo tin"
            data-testid="input-reporter-name"
          />
          <FormInput
            label="Số CCCD/CMND"
            icon={<Hash className="w-4 h-4" />}
            value={formData.reporterIdNumber}
            onChange={(v) => update("reporterIdNumber", v)}
            placeholder="Số CCCD/CMND"
          />
          <FormInput
            label="Ngày sinh"
            type="date"
            icon={<Calendar className="w-4 h-4" />}
            value={formData.reporterDateOfBirth}
            onChange={(v) => update("reporterDateOfBirth", v)}
          />
          <FormSelect
            label="Giới tính"
            value={formData.reporterGender}
            onChange={(v) => update("reporterGender", v)}
            options={[
              { value: "nam", label: "Nam" },
              { value: "nu", label: "Nữ" },
              { value: "khac", label: "Khác" },
            ]}
            placeholder="-- Chọn giới tính --"
          />
          <FormPhone
            label="Số điện thoại"
            icon={<Phone className="w-4 h-4" />}
            value={formData.reporterPhone}
            onChange={(v) => update("reporterPhone", v)}
            placeholder="09xx xxx xxx"
          />
          <FormInput
            label="Email"
            type="email"
            icon={<Mail className="w-4 h-4" />}
            value={formData.reporterEmail}
            onChange={(v) => update("reporterEmail", v)}
            placeholder="email@example.com"
          />
          <FormInput
            label="Quốc tịch"
            value={formData.reporterNationality}
            onChange={(v) => update("reporterNationality", v)}
            placeholder="Việt Nam"
          />
          <FormInput
            label="Nghề nghiệp"
            value={formData.reporterOccupation}
            onChange={(v) => update("reporterOccupation", v)}
            placeholder="Nghề nghiệp"
          />
          <FormInput
            label="Địa chỉ thường trú"
            icon={<MapPin className="w-4 h-4" />}
            value={formData.reporterAddress}
            onChange={(v) => update("reporterAddress", v)}
            placeholder="Địa chỉ liên hệ"
            colSpan={2}
          />
          <FormSelect
            label="Quan hệ với vụ án"
            value={formData.reporterRelationToCase}
            onChange={(v) => update("reporterRelationToCase", v)}
            options={[
              { value: "bi-hai", label: "Bị hại" },
              { value: "nguoi-than", label: "Người thân bị hại" },
              { value: "nhan-chung", label: "Nhân chứng" },
              { value: "co-quan", label: "Cơ quan, tổ chức" },
              { value: "khac", label: "Khác" },
            ]}
            placeholder="-- Chọn quan hệ --"
            colSpan={2}
          />
        </div>
      </Card>

      {/* ── Nhóm 5: Khu vực xảy ra ── */}
      <Card>
        <CardHeader title="Khu vực xảy ra" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ProvinceWardSelect
            provinceCode={formData.province ?? ''}
            ward={formData.ward ?? ''}
            onProvinceChange={(code) => update("province", code)}
            onWardChange={(w) => update("ward", w)}
            errors={{ province: errors?.province, ward: errors?.ward }}
            testIdPrefix="case-address"
          />
          {/* Legacy district — existing records show read-only badge; new records show toggle */}
          <div className="md:col-span-2">
            {isExistingLegacy ? (
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border bg-amber-50 border-amber-300 text-amber-700">
                  <History className="w-3.5 h-3.5" />
                  Địa chỉ cũ — {formData.district} (trước 01/07/2025)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={handleLegacyToggle}
                  aria-pressed={legacyMode}
                  title="Ctrl+Shift+L để bật/tắt"
                  className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors ${
                    legacyMode
                      ? "bg-amber-50 border-amber-300 text-amber-700"
                      : "border-gray-200 text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  {legacyMode ? "Dữ liệu cũ (có quận)" : "Nhập dữ liệu cũ"}
                </button>
              </div>
            )}
            {legacyMode && !isExistingLegacy && (
              <div className="mb-3">
                <FKSelect
                  label="Quận / Huyện (địa chỉ cũ — trước 01/07/2025)"
                  value={formData.district}
                  onChange={(v) => update("district", v)}
                  options={districtOptions ?? []}
                  placeholder="-- Chọn quận/huyện --"
                  canCreate={false}
                  testId="fk-district"
                />
              </div>
            )}
          </div>
          {/* Ward is now handled by ProvinceWardSelect above */}
          <FormInput
            label="Địa chỉ cụ thể"
            icon={<MapPin className="w-4 h-4" />}
            value={formData.specificAddress}
            onChange={(v) => update("specificAddress", v)}
            placeholder="Số nhà, tên đường..."
          />
        </div>
      </Card>

    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 2: Vụ việc
// ═════════════════════════════════════════════════════════════════════════════

export function TabIncident({ formData, setFormData, errors, setErrors }: TabProps) {
  const update = useFieldUpdater(formData, setFormData, errors, setErrors);

  const fromIncidentId = formData.linkedIncidentId;
  const autoLinkedId = formData.autoLinkedIncidentId;
  const hasLinkedIncident =
    (fromIncidentId && formData.caseProvenance === CaseProvenance.FROM_INCIDENT) ||
    (autoLinkedId && DIRECT_PROVENANCES.has(formData.caseProvenance));

  if (hasLinkedIncident) {
    return (
      <Card data-testid="tab-incident">
        <CardHeader title="Thông tin vụ việc (đã liên kết)" />
        <LinkedIncidentCard
          incidentId={(fromIncidentId || autoLinkedId) as string}
          canUnlink={formData.caseProvenance === CaseProvenance.FROM_INCIDENT}
          onUnlink={() => {
            setFormData((prev) => ({
              ...prev,
              linkedIncidentId: "",
              autoLinkedIncidentId: "",
              expectedIncidentUpdatedAt: "",
              // Only reset caseProvenance for FROM_INCIDENT — Branch 3 keeps its provenance
              ...(prev.caseProvenance === CaseProvenance.FROM_INCIDENT ? { caseProvenance: "" } : {}),
            }));
          }}
        />
      </Card>
    );
  }

  return (
    <Card data-testid="tab-incident">
      <CardHeader title="Thông tin vụ việc" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Mã vụ việc"
          icon={<Hash className="w-4 h-4" />}
          value={formData.incidentCode}
          onChange={(v) => update("incidentCode", v)}
          placeholder="VV-2026-001"
        />
        <FormInput
          label="Ngày xảy ra"
          type="date"
          icon={<Calendar className="w-4 h-4" />}
          value={formData.incidentDate}
          onChange={(v) => update("incidentDate", v)}
        />
        <FormInput
          label="Giờ xảy ra"
          type="time"
          icon={<Clock className="w-4 h-4" />}
          value={formData.incidentTime}
          onChange={(v) => update("incidentTime", v)}
        />
        <FKSelect
          label="Loại vụ việc"
          value={formData.incidentType}
          onChange={(v) => update("incidentType", v)}
          directoryType="INCIDENT_TYPE"
          placeholder="-- Chọn loại --"
          canCreate={false}
        />
        <FKSelect
          label="Mức độ nghiêm trọng"
          value={formData.incidentLevel}
          onChange={(v) => update("incidentLevel", v)}
          directoryType="INCIDENT_LEVEL"
          placeholder="-- Chọn mức độ --"
          canCreate={false}
        />
        <FormInput
          label="Địa điểm xảy ra"
          icon={<MapPin className="w-4 h-4" />}
          value={formData.incidentLocation}
          onChange={(v) => update("incidentLocation", v)}
          placeholder="Địa điểm cụ thể"
          colSpan={2}
        />
        <FormTextarea
          label="Nguyên nhân"
          value={formData.incidentCause}
          onChange={(v) => update("incidentCause", v)}
          placeholder="Nguyên nhân dẫn đến vụ việc..."
          rows={3}
          colSpan={2}
        />
        <FormTextarea
          label="Phương thức thủ đoạn"
          value={formData.incidentMethod}
          onChange={(v) => update("incidentMethod", v)}
          placeholder="Mô tả phương thức, thủ đoạn thực hiện..."
          rows={3}
          colSpan={2}
        />
        <FormTextarea
          label="Diễn biến vụ việc"
          value={formData.incidentDescription}
          onChange={(v) => update("incidentDescription", v)}
          placeholder="Mô tả chi tiết diễn biến vụ việc..."
          rows={5}
          colSpan={2}
        />
      </div>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 3: Vụ án
// ═════════════════════════════════════════════════════════════════════════════

export function TabCase({ formData, setFormData, errors, setErrors }: TabProps) {
  const update = useFieldUpdater(formData, setFormData, errors, setErrors);

  return (
    <Card data-testid="tab-case">
      <CardHeader title="Thông tin vụ án" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Mã vụ án"
          icon={<Hash className="w-4 h-4" />}
          value={formData.criminalCode}
          onChange={(v) => update("criminalCode", v)}
          placeholder="VA-2026-001"
        />
        <FormInput
          label="Ngày khởi tố"
          type="date"
          icon={<Calendar className="w-4 h-4" />}
          value={formData.criminalDate}
          onChange={(v) => update("criminalDate", v)}
        />
        <FKSelect
          label="Tội danh chính"
          value={formData.criminalType}
          onChange={(v) => update("criminalType", v)}
          masterClassType="07"
          placeholder="Tìm kiếm tội danh..."
          canCreate={false}
          testId="fk-criminal-type"
        />
        <FKSelect
          label="Tội danh phụ"
          value={formData.criminalSecondaryType}
          onChange={(v) => update("criminalSecondaryType", v)}
          masterClassType="07"
          placeholder="Tội danh phụ (nếu có)..."
          canCreate={false}
          testId="fk-criminal-secondary"
        />
        <FKSelect
          label="Viện kiểm sát"
          value={formData.prosecutionOffice}
          onChange={(v) => update("prosecutionOffice", v)}
          directoryType="PROSECUTION_OFFICE"
          placeholder="-- Chọn VKS --"
          canCreate={false}
          testId="fk-prosecution"
        />
        <FormInput
          label="Tên tòa án"
          icon={<Scale className="w-4 h-4" />}
          value={formData.courtName}
          onChange={(v) => update("courtName", v)}
          placeholder="Tên tòa án có thẩm quyền"
        />
        <FormInput
          label="Ngày xét xử"
          type="date"
          icon={<Calendar className="w-4 h-4" />}
          value={formData.courtHearingDate}
          onChange={(v) => update("courtHearingDate", v)}
        />
        <FormInput
          label="Địa điểm xảy ra vụ án"
          icon={<MapPin className="w-4 h-4" />}
          value={formData.criminalLocation}
          onChange={(v) => update("criminalLocation", v)}
          placeholder="Địa điểm cụ thể"
          colSpan={2}
        />
        <FormTextarea
          label="Căn cứ khởi tố"
          value={formData.accusation}
          onChange={(v) => update("accusation", v)}
          placeholder="Căn cứ pháp lý và sự kiện để khởi tố vụ án..."
          rows={4}
          colSpan={2}
        />
        <FormInput
          label="Phán quyết / Bản án"
          value={formData.verdict}
          onChange={(v) => update("verdict", v)}
          placeholder="Kết quả phán quyết tòa án"
        />
        <FormInput
          label="Mức án"
          value={formData.sentence}
          onChange={(v) => update("sentence", v)}
          placeholder="VD: 5 năm tù giam"
        />
        <FormInput
          label="Số kết luận điều tra"
          value={formData.soKLDT}
          onChange={(v) => update("soKLDT", v)}
          placeholder="Số KLĐT"
        />
        <FormInput
          label="Ngày kết luận điều tra"
          type="date"
          icon={<Calendar className="w-4 h-4" />}
          value={formData.ngayKLDT}
          onChange={(v) => update("ngayKLDT", v)}
        />
        <FormInput
          label="Số QĐ điều tra lại"
          value={formData.soQDDieuTraLai}
          onChange={(v) => update("soQDDieuTraLai", v)}
          placeholder="Số QĐ điều tra lại"
        />
        <FormInput
          label="Ngày QĐ điều tra lại"
          type="date"
          icon={<Calendar className="w-4 h-4" />}
          value={formData.ngayQDDieuTraLai}
          onChange={(v) => update("ngayQDDieuTraLai", v)}
        />
      </div>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 4: ĐTBS
// ═════════════════════════════════════════════════════════════════════════════

export function TabSubjects({
  subjects,
  onAdd,
  onEdit,
  onDelete,
}: {
  subjects: Subject[];
  onAdd: () => void;
  onEdit: (subject: Subject) => void;
  onDelete: (id: string) => void;
}) {
  const columns: ColumnDef<Subject>[] = [
    {
      key: "type",
      header: "Loại đối tượng",
      render: (item) => (
        <StatusBadge
          label={item.type}
          color={SUBJECT_TYPE_COLORS[item.type] || "bg-slate-100 text-slate-700"}
        />
      ),
    },
    { key: "name", header: "Họ và tên", cellClassName: "px-4 py-3 text-sm text-slate-800 font-medium" },
    { key: "idNumber", header: "CCCD/CMND" },
    { key: "dateOfBirth", header: "Ngày sinh" },
    { key: "address", header: "Địa chỉ", cellClassName: "px-4 py-3 text-sm text-slate-700 max-w-xs truncate" },
    { key: "phone", header: "SĐT" },
    {
      key: "actions",
      header: "Thao tác",
      width: "w-24",
      render: (item) => (
        <ActionButtons
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      ),
    },
  ];

  return (
    <Card data-testid="tab-subjects">
      <CardHeader
        title="Đối tượng, Bị can, Bị hại, Luật sư"
        actions={
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            data-testid="btn-add-subject"
          >
            <Plus className="w-4 h-4" />
            Thêm đối tượng
          </button>
        }
      />
      <DataTable
        columns={columns}
        data={subjects}
        rowKey={(s) => s.id}
        emptyState={
          <EmptyState
            icon={Users}
            message="Chưa có đối tượng nào"
            subMessage='Nhấn "Thêm đối tượng" để bắt đầu'
          />
        }
      />
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 5: Vụ việc TĐC
// ═════════════════════════════════════════════════════════════════════════════

export function TabIncidentTDC({ formData, setFormData, errors, setErrors }: TabProps) {
  const update = useFieldUpdater(formData, setFormData, errors, setErrors);

  return (
    <Card data-testid="tab-incident-tdc">
      <CardHeader title="Vụ việc – Tố giác, Tin báo tội phạm" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Mã vụ việc TĐC"
          icon={<Hash className="w-4 h-4" />}
          value={formData.tdcIncidentCode}
          onChange={(v) => update("tdcIncidentCode", v)}
          placeholder="TDC-VV-2026-001"
        />
        <FKSelect
          label="Nguồn tiếp nhận"
          value={formData.tdcSource}
          onChange={(v) => update("tdcSource", v)}
          directoryType="TDC_SOURCE"
          placeholder="-- Chọn nguồn --"
          canCreate={false}
        />
        <FormInput
          label="Ngày tiếp nhận"
          type="date"
          icon={<Calendar className="w-4 h-4" />}
          value={formData.tdcReceiveDate}
          onChange={(v) => update("tdcReceiveDate", v)}
        />
        <FormInput
          label="Ngày chuyển xử lý"
          type="date"
          icon={<Calendar className="w-4 h-4" />}
          value={formData.tdcTransferDate}
          onChange={(v) => update("tdcTransferDate", v)}
        />
        <FormTextarea
          label="Nội dung tố giác / tin báo"
          value={formData.tdcContent}
          onChange={(v) => update("tdcContent", v)}
          placeholder="Nội dung chi tiết tố giác hoặc tin báo tội phạm..."
          rows={5}
          colSpan={2}
        />
        <FormTextarea
          label="Kết quả xử lý"
          value={formData.tdcResult}
          onChange={(v) => update("tdcResult", v)}
          placeholder="Kết quả xử lý ban đầu..."
          rows={3}
          colSpan={2}
        />
      </div>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 6: Vụ án TĐC
// ═════════════════════════════════════════════════════════════════════════════

export function TabCaseTDC({ formData, setFormData, errors, setErrors }: TabProps) {
  const update = useFieldUpdater(formData, setFormData, errors, setErrors);

  return (
    <Card data-testid="tab-case-tdc">
      <CardHeader title="Vụ án từ Tố giác, Tin báo tội phạm" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormInput
          label="Mã vụ án TĐC"
          icon={<Hash className="w-4 h-4" />}
          value={formData.tdcCaseCode}
          onChange={(v) => update("tdcCaseCode", v)}
          placeholder="TDC-VA-2026-001"
        />
        <FKSelect
          label="Loại vụ án TĐC"
          value={formData.tdcCaseType}
          onChange={(v) => update("tdcCaseType", v)}
          directoryType="TDC_CASE_TYPE"
          placeholder="-- Chọn loại --"
          canCreate={false}
        />
        <FormInput
          label="Ngày kết thúc"
          type="date"
          icon={<Calendar className="w-4 h-4" />}
          value={formData.tdcClosedDate}
          onChange={(v) => update("tdcClosedDate", v)}
        />
        <FormTextarea
          label="Kết quả xử lý"
          value={formData.tdcProcessingResult}
          onChange={(v) => update("tdcProcessingResult", v)}
          placeholder="Kết quả xử lý vụ án TĐC..."
          rows={5}
          colSpan={2}
        />
      </div>
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 7: Vật chứng
// ═════════════════════════════════════════════════════════════════════════════

export function TabEvidence({
  evidences,
  onAdd,
  onEdit,
  onDelete,
}: {
  evidences: Evidence[];
  onAdd: () => void;
  onEdit: (evidence: Evidence) => void;
  onDelete: (id: string) => void;
}) {
  const columns: ColumnDef<Evidence>[] = [
    { key: "code", header: "Mã VC", cellClassName: "px-4 py-3 text-sm font-medium text-blue-600" },
    { key: "name", header: "Tên vật chứng", cellClassName: "px-4 py-3 text-sm text-slate-800 font-medium" },
    { key: "description", header: "Mô tả", cellClassName: "px-4 py-3 text-sm text-slate-700 max-w-xs truncate" },
    {
      key: "quantity",
      header: "Số lượng",
      render: (item) => <>{item.quantity} {item.unit}</>,
    },
    { key: "storageLocation", header: "Nơi lưu trữ" },
    {
      key: "status",
      header: "Trạng thái",
      render: (item) => <StatusBadge label={item.status} color="green" />,
    },
    {
      key: "actions",
      header: "Thao tác",
      width: "w-24",
      render: (item) => (
        <ActionButtons
          onEdit={() => onEdit(item)}
          onDelete={() => onDelete(item.id)}
        />
      ),
    },
  ];

  return (
    <Card data-testid="tab-evidence">
      <CardHeader
        title="Danh sách vật chứng"
        actions={
          <button
            onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            data-testid="btn-add-evidence"
          >
            <Plus className="w-4 h-4" />
            Thêm vật chứng
          </button>
        }
      />
      <DataTable
        columns={columns}
        data={evidences}
        rowKey={(e) => e.id}
        emptyState={
          <EmptyState
            icon={Package}
            message="Chưa có vật chứng nào"
            subMessage='Nhấn "Thêm vật chứng" để bắt đầu'
          />
        }
      />
    </Card>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 8: Hồ sơ nghiệp vụ — upload/download tài liệu thật qua API
// ═════════════════════════════════════════════════════════════════════════════

// v0.52 Cycle 8 — TabBusinessFiles is now a thin wrapper around EntityDocumentsTab.
// All upload/list/download logic moved to components/documents/EntityDocumentsTab.tsx
// for reuse by Petition + Incident tabs.
export function TabBusinessFiles({ caseId }: { caseId?: string }) {
  return <EntityDocumentsTab entityKind="case" entityId={caseId} />;
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 9: Thống kê 48 trường – full implementation từ Refs
// ═════════════════════════════════════════════════════════════════════════════

// Helper input nhỏ cho case_statistics (text/date/number/bool).
const CS_LABEL = "block text-xs font-medium text-slate-600 mb-1";
const CS_INPUT = "w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
function CSText({ label, v, on, t }: { label: string; v: string; on: (x: string) => void; t: string }) {
  return (<div><label className={CS_LABEL}>{label}</label><input type="text" value={v} onChange={(e) => on(e.target.value)} className={CS_INPUT} data-testid={t} /></div>);
}
function CSNum({ label, v, on, t }: { label: string; v: string; on: (x: string) => void; t: string }) {
  return (<div><label className={CS_LABEL}>{label}</label><input type="number" min={0} value={v} onChange={(e) => on(e.target.value)} className={CS_INPUT} data-testid={t} /></div>);
}
function CSDate({ label, v, on, t }: { label: string; v: string; on: (x: string) => void; t: string }) {
  return (<div><label className={CS_LABEL}>{label}</label><input type="date" value={v} onChange={(e) => on(e.target.value)} className={CS_INPUT} data-testid={t} /></div>);
}
function CSBool({ label, v, on, t }: { label: string; v: boolean; on: (x: boolean) => void; t: string }) {
  return (<label className="flex items-center gap-2 text-sm text-slate-700 mt-5"><input type="checkbox" checked={v} onChange={(e) => on(e.target.checked)} className="w-4 h-4" data-testid={t} />{label}</label>);
}

export function TabStatistics({ formData, setFormData }: TabProps) {
  const update = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };
  // Cập nhật field nested trong case_statistics (hybrid).
  const cs = formData.statistic;
  const updateStat = (field: keyof typeof cs, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, statistic: { ...prev.statistic, [field]: value } }));
  };

  const filledCount = [
    "stat_sourceType","stat_sourceOrigin","stat_informantType","stat_receiveMethod",
    "stat_urgencyLevel","stat_reportingUnit","stat_incidentDate","stat_incidentTime",
    "stat_incidentProvince","stat_incidentDistrict","stat_incidentWard","stat_initialClassification",
    "stat_primaryCrime","stat_secondaryCrime","stat_crimeField","stat_crimeMethod",
    "stat_damageAmount","stat_recoveredAmount","stat_victimCount","stat_deathCount",
    "stat_injuryCount","stat_propertyDamage","stat_organizedCrime","stat_repeatOffender",
    "stat_suspectCount","stat_suspectArrested","stat_suspectDetained","stat_suspectGender",
    "stat_suspectAge","stat_suspectEthnicity","stat_suspectNationality","stat_suspectOccupation",
    "stat_suspectEducation","stat_suspectCriminalRecord","stat_suspectDrugRelated","stat_suspectWeaponUsed",
    "stat_processingStatus","stat_investigationResult","stat_prosecutionResult","stat_trialResult",
    "stat_sentencingResult","stat_closedDate","stat_processingDays","stat_evidenceCollected",
    "stat_witnessCount","stat_propertySeized","stat_caseTransferred","stat_reportSubmitted",
  ].filter((k) => (formData as unknown as Record<string, string>)[k] !== "").length;

  const pct = Math.round((filledCount / 48) * 100);

  const sel = (className = "") =>
    `w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${className}`;
  const inp = (className = "") =>
    `w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${className}`;
  return (
    <div className="space-y-6" data-testid="tab-statistics">
      {/* Warning */}
      <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-900 mb-1">Lưu ý quan trọng</p>
          <p className="text-sm text-amber-800">
            Các trường này dùng để báo cáo lên cấp trên theo quy định Bộ Công an. Vui lòng điền đầy đủ, chính xác.
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-lg border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Tiến độ hoàn thành</p>
            <p className="text-xs text-slate-500 mt-0.5">Đã điền {filledCount}/48 trường</p>
          </div>
          <p className="text-2xl font-bold text-blue-600">{pct}%</p>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
          <div className="bg-blue-600 h-full transition-all duration-300 rounded-full" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Nhóm 1 */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-200">
          <Radio className="w-5 h-5 text-blue-600" />
          Nhóm 1: Chỉ tiêu nguồn tin (12 trường)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Loại nguồn tin <span className="text-red-500">*</span></label>
            <select value={formData.stat_sourceType} onChange={(e) => update("stat_sourceType", e.target.value)} className={sel()} data-testid="stat-sourceType">
              <option value="">-- Chọn loại --</option>
              <option value="denunciation">Tố giác tội phạm</option>
              <option value="complaint">Khiếu nại</option>
              <option value="report">Báo cáo</option>
              <option value="discovery">Phát hiện qua công tác</option>
              <option value="informant">Nguồn tin mật</option>
              <option value="other">Khác</option>
            </select>

          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nguồn gốc</label>
            <select value={formData.stat_sourceOrigin} onChange={(e) => update("stat_sourceOrigin", e.target.value)} className={sel()}>
              <option value="">-- Chọn nguồn gốc --</option>
              <option value="citizen">Công dân</option>
              <option value="agency">Cơ quan nhà nước</option>
              <option value="organization">Tổ chức</option>
              <option value="police">Lực lượng công an</option>
              <option value="anonymous">Ẩn danh</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Loại người báo tin</label>
            <select value={formData.stat_informantType} onChange={(e) => update("stat_informantType", e.target.value)} className={sel()}>
              <option value="">-- Chọn loại --</option>
              <option value="victim">Bị hại</option>
              <option value="witness">Người chứng kiến</option>
              <option value="relative">Người thân</option>
              <option value="informant">Người cung cấp tin</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Hình thức tiếp nhận</label>
            <select value={formData.stat_receiveMethod} onChange={(e) => update("stat_receiveMethod", e.target.value)} className={sel()}>
              <option value="">-- Chọn hình thức --</option>
              <option value="direct">Trực tiếp</option>
              <option value="phone">Điện thoại</option>
              <option value="mail">Thư tín</option>
              <option value="email">Email</option>
              <option value="online">Trực tuyến</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mức độ khẩn</label>
            <select value={formData.stat_urgencyLevel} onChange={(e) => update("stat_urgencyLevel", e.target.value)} className={sel()}>
              <option value="">-- Chọn mức độ --</option>
              <option value="normal">Bình thường</option>
              <option value="urgent">Khẩn</option>
              <option value="very-urgent">Thượng khẩn</option>
              <option value="emergency">Hỏa tốc</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Đơn vị tiếp báo</label>
            <input value={formData.stat_reportingUnit} onChange={(e) => update("stat_reportingUnit", e.target.value)} placeholder="Tên đơn vị..." className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Ngày xảy ra vụ việc</label>
            <input type="date" value={formData.stat_incidentDate} onChange={(e) => update("stat_incidentDate", e.target.value)} className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Giờ xảy ra</label>
            <input type="time" value={formData.stat_incidentTime} onChange={(e) => update("stat_incidentTime", e.target.value)} className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tỉnh/TP</label>
            <input value={formData.stat_incidentProvince} onChange={(e) => update("stat_incidentProvince", e.target.value)} placeholder="TP. Hồ Chí Minh" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Quận/Huyện</label>
            <input value={formData.stat_incidentDistrict} onChange={(e) => update("stat_incidentDistrict", e.target.value)} placeholder="Quận 1" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phường/Xã</label>
            <input value={formData.stat_incidentWard} onChange={(e) => update("stat_incidentWard", e.target.value)} placeholder="Phường 1" className={inp()} />
          </div>
          <div>
            <FKSelect label="Phân loại ban đầu" masterClassType="07" value={formData.stat_initialClassification} onChange={(v) => update("stat_initialClassification", v)} placeholder="-- Chọn phân loại --" />
          </div>
        </div>
      </div>

      {/* Nhóm 2 */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-200">
          <Scale className="w-5 h-5 text-red-600" />
          Nhóm 2: Chỉ tiêu tội phạm (12 trường)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <FKSelect label="Tội danh chính" required directoryType="CRIME" value={formData.stat_primaryCrime} onChange={(v) => update("stat_primaryCrime", v)} placeholder="-- Chọn tội danh --" testId="stat-primaryCrime" />
          </div>
          <div>
            <FKSelect label="Tội danh phụ" directoryType="CRIME" value={formData.stat_secondaryCrime} onChange={(v) => update("stat_secondaryCrime", v)} placeholder="-- Chọn tội danh phụ --" />
          </div>
          <div>
            <FKSelect label="Lĩnh vực" masterClassType="07" value={formData.stat_crimeField} onChange={(v) => update("stat_crimeField", v)} placeholder="-- Chọn lĩnh vực --" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Phương thức thủ đoạn</label>
            <input value={formData.stat_crimeMethod} onChange={(e) => update("stat_crimeMethod", e.target.value)} placeholder="Mô tả phương thức..." className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Thiệt hại (VNĐ)</label>
            <CurrencyInput value={formData.stat_damageAmount} onValueChange={(v) => update("stat_damageAmount", v)} placeholder="0 ₫" className={inp()} data-testid="stat-damageAmount" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Đã thu hồi (VNĐ)</label>
            <CurrencyInput value={formData.stat_recoveredAmount} onValueChange={(v) => update("stat_recoveredAmount", v)} placeholder="0 ₫" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Số bị hại</label>
            <IntegerInput value={formData.stat_victimCount} onValueChange={(v) => update("stat_victimCount", v)} placeholder="0" className={inp()} data-testid="stat-victimCount" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Số người chết</label>
            <IntegerInput value={formData.stat_deathCount} onValueChange={(v) => update("stat_deathCount", v)} placeholder="0" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Số người bị thương</label>
            <IntegerInput value={formData.stat_injuryCount} onValueChange={(v) => update("stat_injuryCount", v)} placeholder="0" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Thiệt hại tài sản</label>
            <input value={formData.stat_propertyDamage} onChange={(e) => update("stat_propertyDamage", e.target.value)} placeholder="Mô tả thiệt hại..." className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tội phạm có tổ chức</label>
            <select value={formData.stat_organizedCrime} onChange={(e) => update("stat_organizedCrime", e.target.value)} className={sel()}>
              <option value="">-- Chọn --</option><option value="yes">Có</option><option value="no">Không</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tái phạm</label>
            <select value={formData.stat_repeatOffender} onChange={(e) => update("stat_repeatOffender", e.target.value)} className={sel()}>
              <option value="">-- Chọn --</option><option value="yes">Có</option><option value="no">Không</option>
            </select>
          </div>
        </div>
      </div>

      {/* Nhóm 3 */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-200">
          <Users className="w-5 h-5 text-green-600" />
          Nhóm 3: Chỉ tiêu đối tượng (12 trường)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { field: "stat_suspectCount", label: "Số đối tượng", placeholder: "0" },
            { field: "stat_suspectArrested", label: "Đã bắt giữ", placeholder: "0" },
            { field: "stat_suspectDetained", label: "Đã tạm giam", placeholder: "0" },
          ].map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
              <IntegerInput value={(formData as unknown as Record<string, string>)[field]} onValueChange={(v) => update(field as keyof typeof formData, v)} placeholder={placeholder} className={inp()} />
            </div>
          ))}
          <div>
            <FKSelect label="Giới tính" masterClassType="00" value={formData.stat_suspectGender} onChange={(v) => update("stat_suspectGender", v)} placeholder="-- Chọn --" />
          </div>
          <div>
            <FKSelect label="Độ tuổi" masterClassType="04" value={formData.stat_suspectAge} onChange={(v) => update("stat_suspectAge", v)} placeholder="-- Chọn --" />
          </div>
          {[
            { field: "stat_suspectEthnicity", label: "Dân tộc", placeholder: "Kinh" },
            { field: "stat_suspectNationality", label: "Quốc tịch", placeholder: "Việt Nam" },
            { field: "stat_suspectOccupation", label: "Nghề nghiệp", placeholder: "Nghề nghiệp..." },
          ].map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
              <input value={(formData as unknown as Record<string, string>)[field]} onChange={(e) => update(field as keyof typeof formData, e.target.value)} placeholder={placeholder} className={inp()} />
            </div>
          ))}
          <div>
            <FKSelect label="Trình độ học vấn" masterClassType="05" value={formData.stat_suspectEducation} onChange={(v) => update("stat_suspectEducation", v)} placeholder="-- Chọn --" />
          </div>
          {[
            { field: "stat_suspectCriminalRecord", label: "Tiền án tiền sự" },
            { field: "stat_suspectDrugRelated", label: "Liên quan ma túy" },
            { field: "stat_suspectWeaponUsed", label: "Sử dụng vũ khí" },
          ].map(({ field, label }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
              <select value={(formData as unknown as Record<string, string>)[field]} onChange={(e) => update(field as keyof typeof formData, e.target.value)} className={sel()}>
                <option value="">-- Chọn --</option><option value="yes">Có</option><option value="no">Không</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Nhóm 4 */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h4 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-200">
          <CheckCircle className="w-5 h-5 text-purple-600" />
          Nhóm 4: Chỉ tiêu kết quả (12 trường)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Trạng thái xử lý</label>
            <select value={formData.stat_processingStatus} onChange={(e) => update("stat_processingStatus", e.target.value)} className={sel()}>
              <option value="">-- Chọn --</option>
              <option value="investigating">Đang điều tra</option>
              <option value="prosecuting">Đang truy tố</option>
              <option value="trial">Đang xét xử</option>
              <option value="closed">Đã kết thúc</option>
              <option value="suspended">Tạm đình chỉ</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Kết quả điều tra</label>
            <select value={formData.stat_investigationResult} onChange={(e) => update("stat_investigationResult", e.target.value)} className={sel()}>
              <option value="">-- Chọn --</option>
              <option value="completed">Hoàn thành</option><option value="incomplete">Chưa hoàn thành</option><option value="suspended">Đình chỉ</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Kết quả truy tố</label>
            <select value={formData.stat_prosecutionResult} onChange={(e) => update("stat_prosecutionResult", e.target.value)} className={sel()}>
              <option value="">-- Chọn --</option>
              <option value="prosecuted">Đã truy tố</option><option value="not-prosecuted">Không truy tố</option><option value="pending">Đang xem xét</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Kết quả xét xử</label>
            <select value={formData.stat_trialResult} onChange={(e) => update("stat_trialResult", e.target.value)} className={sel()}>
              <option value="">-- Chọn --</option>
              <option value="convicted">Kết án</option><option value="acquitted">Tuyên trắng án</option><option value="pending">Chưa xét xử</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Mức án</label>
            <input value={formData.stat_sentencingResult} onChange={(e) => update("stat_sentencingResult", e.target.value)} placeholder="VD: 5 năm tù" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Ngày kết thúc</label>
            <input type="date" value={formData.stat_closedDate} onChange={(e) => update("stat_closedDate", e.target.value)} className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Số ngày xử lý</label>
            <IntegerInput value={formData.stat_processingDays} onValueChange={(v) => update("stat_processingDays", v)} placeholder="0" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Chứng cứ thu thập</label>
            <IntegerInput value={formData.stat_evidenceCollected} onValueChange={(v) => update("stat_evidenceCollected", v)} placeholder="Số lượng" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Số nhân chứng</label>
            <IntegerInput value={formData.stat_witnessCount} onValueChange={(v) => update("stat_witnessCount", v)} placeholder="0" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Tài sản thu giữ</label>
            <input value={formData.stat_propertySeized} onChange={(e) => update("stat_propertySeized", e.target.value)} placeholder="Mô tả tài sản..." className={inp()} />
          </div>
          {[
            { field: "stat_caseTransferred", label: "Chuyển vụ án" },
            { field: "stat_reportSubmitted", label: "Đã báo cáo" },
          ].map(({ field, label }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
              <select value={(formData as unknown as Record<string, string>)[field]} onChange={(e) => update(field as keyof typeof formData, e.target.value)} className={sel()}>
                <option value="">-- Chọn --</option><option value="yes">Có</option><option value="no">Không</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Footer save */}
      {/* ── Thống kê mở rộng (hybrid — lưu bảng case_statistics, query được cho KPI) ── */}
      <details className="bg-white rounded-lg border border-slate-200" data-testid="cs-section">
        <summary className="px-4 py-3 font-semibold text-slate-800 cursor-pointer">
          Thống kê mở rộng (báo cáo) — ghi âm/ghi hình, VPHC, vũ khí, mốc thời gian, hồ sơ nghiệp vụ
        </summary>
        <div className="p-4 space-y-5">
          {/* Hồ sơ nghiệp vụ */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-700 mb-2">Hồ sơ nghiệp vụ</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <CSText label="Số đăng ký hồ sơ" v={cs.soDangKyHoSo} on={(x)=>updateStat("soDangKyHoSo",x)} t="cs-soDangKyHoSo" />
              <CSDate label="Ngày đăng ký hồ sơ" v={cs.ngayDangKyHoSo} on={(x)=>updateStat("ngayDangKyHoSo",x)} t="cs-ngayDangKyHoSo" />
              <CSText label="Số hồ sơ lưu" v={cs.hoSoLuu} on={(x)=>updateStat("hoSoLuu",x)} t="cs-hoSoLuu" />
              <CSDate label="Ngày nộp lưu hồ sơ" v={cs.ngayNopLuuHoSo} on={(x)=>updateStat("ngayNopLuuHoSo",x)} t="cs-ngayNopLuuHoSo" />
              <CSText label="Đơn vị bảo quản hồ sơ" v={cs.donViBaoQuanHoSo} on={(x)=>updateStat("donViBaoQuanHoSo",x)} t="cs-donViBaoQuanHoSo" />
            </div>
          </fieldset>
          {/* Ghi âm, ghi hình */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-700 mb-2">Ghi âm, ghi hình</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <CSBool label="Có ghi âm/ghi hình" v={cs.coGhiAmGhiHinh} on={(x)=>updateStat("coGhiAmGhiHinh",x)} t="cs-coGhiAmGhiHinh" />
              <CSNum label="Tổng BB ghi lời khai" v={cs.tongSoBienBanGhiLoiKhai} on={(x)=>updateStat("tongSoBienBanGhiLoiKhai",x)} t="cs-tongSoBienBanGhiLoiKhai" />
              <CSNum label="BB ghi lời khai có ghi âm/hình" v={cs.soBienBanGhiLoiKhaiCoGhiAm} on={(x)=>updateStat("soBienBanGhiLoiKhaiCoGhiAm",x)} t="cs-soBienBanGhiLoiKhaiCoGhiAm" />
              <CSBool label="Vụ án có ghi âm/ghi hình" v={cs.laVuAnGhiAmGhiHinh} on={(x)=>updateStat("laVuAnGhiAmGhiHinh",x)} t="cs-laVuAnGhiAmGhiHinh" />
              <CSNum label="Tổng BB hỏi cung bị can" v={cs.tongSoBienBanHoiCung} on={(x)=>updateStat("tongSoBienBanHoiCung",x)} t="cs-tongSoBienBanHoiCung" />
              <CSNum label="BB hỏi cung có ghi âm/hình" v={cs.tongSoBienBanHoiCungCoGhiAm} on={(x)=>updateStat("tongSoBienBanHoiCungCoGhiAm",x)} t="cs-tongSoBienBanHoiCungCoGhiAm" />
              <CSNum label="Số bị can có ghi âm/hình" v={cs.soBiCanCoGhiAm} on={(x)=>updateStat("soBiCanCoGhiAm",x)} t="cs-soBiCanCoGhiAm" />
              <CSBool label="VKS yêu cầu ghi âm/hình" v={cs.vksYeuCauGhiAm} on={(x)=>updateStat("vksYeuCauGhiAm",x)} t="cs-vksYeuCauGhiAm" />
              <CSNum label="Số bị can VKS yêu cầu" v={cs.soBiCanVksYeuCauGhiAm} on={(x)=>updateStat("soBiCanVksYeuCauGhiAm",x)} t="cs-soBiCanVksYeuCauGhiAm" />
            </div>
          </fieldset>
          {/* VPHC */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-700 mb-2">Vi phạm hành chính</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <CSBool label="Có VPHC" v={cs.coVPHC} on={(x)=>updateStat("coVPHC",x)} t="cs-coVPHC" />
              <CSNum label="Số đối tượng VPHC" v={cs.soDoiTuongVPHC} on={(x)=>updateStat("soDoiTuongVPHC",x)} t="cs-soDoiTuongVPHC" />
              <CSNum label="Số người bị phạt tiền" v={cs.soNguoiBiPhatTien} on={(x)=>updateStat("soNguoiBiPhatTien",x)} t="cs-soNguoiBiPhatTien" />
              <CSNum label="Tổng tiền phạt HC (triệu)" v={cs.tongTienPhatHanhChinh} on={(x)=>updateStat("tongTienPhatHanhChinh",x)} t="cs-tongTienPhatHanhChinh" />
            </div>
          </fieldset>
          {/* Đối tượng / vũ khí / băng nhóm */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-700 mb-2">Đối tượng / vũ khí / băng nhóm</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <CSNum label="Số đối tượng đã bắt" v={cs.soDoiTuongDaBat} on={(x)=>updateStat("soDoiTuongDaBat",x)} t="cs-soDoiTuongDaBat" />
              <CSNum label="Số ĐT bị bắt vụ án khác" v={cs.soDoiTuongBiBatVuAnKhac} on={(x)=>updateStat("soDoiTuongBiBatVuAnKhac",x)} t="cs-soDoiTuongBiBatVuAnKhac" />
              <CSNum label="Điều tra mở rộng (số vụ)" v={cs.dieuTraMoRong} on={(x)=>updateStat("dieuTraMoRong",x)} t="cs-dieuTraMoRong" />
              <CSText label="Sử dụng vũ khí nóng" v={cs.suDungVuKhiNong} on={(x)=>updateStat("suDungVuKhiNong",x)} t="cs-suDungVuKhiNong" />
              <CSBool label="Có băng nhóm" v={cs.coBangNhom} on={(x)=>updateStat("coBangNhom",x)} t="cs-coBangNhom" />
              <CSNum label="Số băng nhóm bắt được" v={cs.soBangNhomBatDuoc} on={(x)=>updateStat("soBangNhomBatDuoc",x)} t="cs-soBangNhomBatDuoc" />
              <CSNum label="Số súng thu hồi" v={cs.soSungThuHoi} on={(x)=>updateStat("soSungThuHoi",x)} t="cs-soSungThuHoi" />
              <CSNum label="Số thuốc nổ thu hồi" v={cs.soThuocNoThuHoi} on={(x)=>updateStat("soThuocNoThuHoi",x)} t="cs-soThuocNoThuHoi" />
              <CSNum label="Số ĐT sưu tra/hiềm nghi" v={cs.soDoiTuongSuuTraHiemNghi} on={(x)=>updateStat("soDoiTuongSuuTraHiemNghi",x)} t="cs-soDoiTuongSuuTraHiemNghi" />
            </div>
          </fieldset>
          {/* Bị hại, thiệt hại, xét xử — field-parity hệ thống cũ */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-700 mb-2">Bị hại &amp; Thiệt hại</legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <CSNum label="Số lượng bị hại" v={cs.soLuongBiHai} on={(x)=>updateStat("soLuongBiHai",x)} t="cs-soLuongBiHai" />
              <CSNum label="Số người bị thương" v={cs.soNguoiBiThuong} on={(x)=>updateStat("soNguoiBiThuong",x)} t="cs-soNguoiBiThuong" />
              <CSNum label="Số lượng người chết" v={cs.soLuongNguoiChet} on={(x)=>updateStat("soLuongNguoiChet",x)} t="cs-soLuongNguoiChet" />
              <CSNum label="Tiền bị thiệt hại (VNĐ)" v={cs.soTienBiThietHai} on={(x)=>updateStat("soTienBiThietHai",x)} t="cs-soTienBiThietHai" />
              <CSNum label="Tiền thu hồi (VNĐ)" v={cs.soTienThuHoi} on={(x)=>updateStat("soTienThuHoi",x)} t="cs-soTienThuHoi" />
              <CSBool label="Vụ án đã được xét xử" v={cs.vuAnDaDuocXetXu} on={(x)=>updateStat("vuAnDaDuocXetXu",x)} t="cs-vuAnDaDuocXetXu" />
            </div>
          </fieldset>
          {/* Mốc thời gian thống kê */}
          <fieldset>
            <legend className="text-sm font-medium text-slate-700 mb-2">Mốc thời gian thống kê</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <CSDate label="Ngày tổng hợp thống kê" v={cs.ngayThongKe} on={(x)=>updateStat("ngayThongKe",x)} t="cs-ngayThongKe" />
              <CSDate label="Ngày phân công GQ tố giác" v={cs.ngayPhanCongGiaiQuyetToGiac} on={(x)=>updateStat("ngayPhanCongGiaiQuyetToGiac",x)} t="cs-ngayPhanCongGiaiQuyetToGiac" />
              <CSDate label="Ngày tiếp nhận tin" v={cs.ngayTiepNhanTin} on={(x)=>updateStat("ngayTiepNhanTin",x)} t="cs-ngayTiepNhanTin" />
              <CSDate label="Ngày đầu thú/tự thú" v={cs.ngayDauThu} on={(x)=>updateStat("ngayDauThu",x)} t="cs-ngayDauThu" />
              <CSDate label="Ngày phạm tội quả tang" v={cs.ngayPhamToiQuaTang} on={(x)=>updateStat("ngayPhamToiQuaTang",x)} t="cs-ngayPhamToiQuaTang" />
              <CSDate label="Ngày bị bắt khẩn cấp" v={cs.ngayBatKhanCap} on={(x)=>updateStat("ngayBatKhanCap",x)} t="cs-ngayBatKhanCap" />
              <CSDate label="Ngày CQĐT phát hiện dấu hiệu" v={cs.ngayPhatHienDauHieu} on={(x)=>updateStat("ngayPhatHienDauHieu",x)} t="cs-ngayPhatHienDauHieu" />
            </div>
          </fieldset>
        </div>
      </details>

      <div className="flex items-center justify-end gap-3 bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex-1 flex items-center gap-2 text-sm text-slate-600">
          <Info className="w-4 h-4" />
          <span>Đã điền {filledCount}/48 trường ({pct}%)</span>
        </div>
        <p className="text-sm text-slate-500 italic">
          Dữ liệu thống kê được lưu cùng khi bấm &ldquo;Lưu hồ sơ&rdquo; bên trên.
        </p>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 10: Ghi âm, ghi hình – upgraded với drag-drop từ Refs
// ═════════════════════════════════════════════════════════════════════════════

export function TabMedia({
  mediaFiles,
  onUpload,
  onDelete,
}: {
  mediaFiles: MediaFile[];
  onUpload: (file: File) => void;
  onDelete: (id: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [recordDate, setRecordDate] = useState(today());

  const allowedTypes = ["mp3", "mp4", "avi", "wav", "mov", "wmv"];

  const handleFiles = (files: File[]) => {
    files.forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !allowedTypes.includes(ext)) {
        alert(`File "${file.name}" không đúng định dạng. Chỉ nhận: ${allowedTypes.join(", ").toUpperCase()}`);
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        alert(`File "${file.name}" vượt quá 100MB`);
        return;
      }
      onUpload(file);
    });
  };

  return (
    <Card data-testid="tab-media">
      <CardHeader title="Tài liệu ghi âm, ghi hình" />

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 mb-4">
        <Video className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">File ghi âm/ghi hình là chứng cứ quan trọng. Dung lượng tối đa 100MB/file. Định dạng: MP3, MP4, AVI, WAV, MOV, WMV.</p>
      </div>

      {/* Record date */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Ngày ghi <span className="text-red-500">*</span></label>
        <div className="relative max-w-xs">
          <input
            type="date"
            value={recordDate}
            max={today()}
            onChange={(e) => setRecordDate(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => document.getElementById("media-upload-input-tab")?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all mb-4 ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
        }`}
        data-testid="media-dropzone"
      >
        <input
          id="media-upload-input-tab"
          type="file"
          accept=".mp3,.mp4,.avi,.wav,.mov,.wmv"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(Array.from(e.target.files))}
          data-testid="media-upload-input"
        />
        <Upload className="w-8 h-8 text-blue-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-700">Kéo thả file vào đây hoặc click để chọn</p>
        <p className="text-xs text-slate-500 mt-1">MP3, MP4, AVI, WAV, MOV, WMV (Tối đa 100MB)</p>
      </div>

      {mediaFiles.length === 0 ? (
        <EmptyState icon={Video} message="Chưa có file ghi âm/ghi hình nào" subMessage='Tải lên file để bắt đầu' />
      ) : (
        <div className="space-y-3">
          {mediaFiles.map((file) => (
            <div key={file.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors" data-testid={`media-file-${file.id}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Video className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{file.name}</p>
                  <p className="text-sm text-slate-600">{file.size} • Tải lên: {file.uploadDate} • {file.uploader}</p>
                </div>
              </div>
              <ActionButtons onView={() => {}} onDownload={() => {}} onDelete={() => onDelete(file.id)} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export { CaseFormTab1UyThac as TabUyThac } from './CaseFormTab1UyThac';
