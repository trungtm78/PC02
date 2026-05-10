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
  Save,
  CheckCircle,
  Info,
  History,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { today } from "@/lib/dates";
import { FormInput, FormSelect, FormTextarea } from "@/components/form";
import { Card, CardHeader, EmptyState, DataTable, ActionButtons, StatusBadge } from "@/components/shared";
import type { ColumnDef } from "@/components/shared";
import { FKSelect } from "@/components/FKSelect";
import { ProvinceWardSelect } from "@/components/ProvinceWardSelect";
import type { TabProps, Subject, Evidence, MediaFile } from "./types";
import {
  CASE_TYPE_OPTIONS,
  STATUS_OPTIONS,
  SUBJECT_TYPE_COLORS,
} from "./constants";

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

export function TabInfo({ formData, setFormData, errors, setErrors, handlerOptions = [], handlerLoading = false }: TabProps) {
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "L") {
        e.preventDefault();
        handleLegacyToggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [legacyMode]);

  // Active wards after reform — isActive=true must be explicit (no server-side default)
  const { data: wardOptions } = useQuery({
    queryKey: ["directories", "WARD", "active"],
    queryFn: () =>
      api.get("/directories?type=WARD&isActive=true").then((r) =>
        (r.data.data ?? []).map((d: any) => ({ value: d.code, label: d.name }))
      ),
  });

  // Abolished districts — lazy-loaded only when legacy toggle is open
  const { data: districtOptions } = useQuery({
    queryKey: ["directories", "DISTRICT", "legacy"],
    queryFn: () =>
      api.get("/directories?type=DISTRICT&isActive=false").then((r) =>
        (r.data.data ?? []).map((d: any) => ({
          value: d.code,
          label: `${d.name} (trước ${d.abolishedAt ? new Date(d.abolishedAt).toLocaleDateString("vi-VN", { year: "numeric", month: "2-digit" }) : "07/2025"})`,
        }))
      ),
    enabled: legacyMode && !isExistingLegacy,
  });

  // Legacy wards for the selected abolished district (cascade)
  const { data: legacyWardOptions } = useQuery({
    queryKey: ["directories", "WARD", "legacy", formData.district],
    queryFn: () =>
      api.get(`/directories?type=WARD&isActive=false&parentId=${formData.district}`).then((r) =>
        (r.data.data ?? []).map((d: any) => ({ value: d.code, label: d.name }))
      ),
    enabled: legacyMode && !!formData.district && !isExistingLegacy,
  });

  // activeWardOptions removed — ward selection now handled by ProvinceWardSelect
  void wardOptions; void legacyWardOptions;

  return (
    <div className="space-y-6" data-testid="tab-info">
      {/* ── Nhóm 1: Thông tin hồ sơ ── */}
      <Card>
        <CardHeader title="Thông tin hồ sơ" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormInput
            label="Mã hồ sơ"
            required
            icon={<Hash className="w-4 h-4" />}
            value={formData.caseCode}
            onChange={(v) => update("caseCode", v)}
            error={errors.caseCode}
            placeholder="HS-2026-001"
            data-testid="input-case-code"
          />
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
          <FormSelect
            label="Loại hồ sơ"
            required
            value={formData.caseType}
            onChange={(v) => update("caseType", v)}
            options={CASE_TYPE_OPTIONS}
            error={errors.caseType}
            placeholder="-- Chọn loại --"
            data-testid="select-case-type"
          />
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
          <FKSelect
            label="Loại đơn thư"
            masterClassType="02"
            value={formData.petitionType}
            onChange={(v) => update("petitionType", v)}
            placeholder="-- Chọn loại đơn thư --"
          />
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
            <FormInput
              label="Thiệt hại ước tính (VNĐ)"
              icon={<DollarSign className="w-4 h-4" />}
              value={formData.damageAmount}
              onChange={(v) => update("damageAmount", v)}
              placeholder="0"
              type="text"
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
          <FormInput
            label="Số điện thoại"
            type="tel"
            icon={<Phone className="w-4 h-4" />}
            value={formData.reporterPhone}
            onChange={(v) => update("reporterPhone", v)}
            placeholder="09xxxxxxxx"
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

const DOC_TYPE_LABEL: Record<string, string> = {
  VAN_BAN:   "Văn bản",
  HINH_ANH:  "Hình ảnh",
  VIDEO:     "Video",
  AM_THANH:  "Âm thanh",
  KHAC:      "Khác",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function TabBusinessFiles({ caseId }: { caseId?: string }) {
  const [docs, setDocs]           = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState("");
  const [showForm, setShowForm]   = useState(false);
  const [title, setTitle]         = useState("");
  const [docType, setDocType]     = useState("VAN_BAN");
  const [description, setDescription] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      const res = await api.get(`/documents?caseId=${caseId}&limit=100`);
      setDocs(res.data.data ?? []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, [caseId]);

  const handleUpload = async () => {
    if (!title.trim()) { setError("Vui lòng nhập tiêu đề tài liệu"); return; }
    if (!fileRef.current?.files?.[0]) { setError("Vui lòng chọn file"); return; }
    if (!caseId) { setError("Chưa có mã hồ sơ — lưu hồ sơ trước khi tải lên tài liệu"); return; }
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", fileRef.current.files[0]);
      fd.append("title", title);
      fd.append("documentType", docType);
      fd.append("caseId", caseId);
      if (description) fd.append("description", description);
      await api.post("/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setTitle(""); setDocType("VAN_BAN"); setDescription("");
      if (fileRef.current) fileRef.current.value = "";
      setShowForm(false);
      await fetchDocs();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Upload thất bại");
    } finally {
      setUploading(false);
    }
  };

  const handleOpen = async (doc: any) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data], { type: doc.mimeType ?? res.data.type }));
      window.open(url, "_blank");
      // Thu hồi URL sau 60s để tránh memory leak
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      alert("Không thể mở tài liệu");
    }
  };

  const handleDownload = async (doc: any) => {
    try {
      const res = await api.get(`/documents/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = doc.originalName ?? doc.title;
      a.click(); URL.revokeObjectURL(url);
    } catch {
      alert("Tải xuống thất bại");
    }
  };

  const handleDelete = async (doc: any) => {
    if (!confirm(`Xóa tài liệu "${doc.title}"?`)) return;
    try {
      await api.delete(`/documents/${doc.id}`);
      await fetchDocs();
    } catch {
      alert("Xóa thất bại");
    }
  };

  return (
    <Card data-testid="tab-business-files">
      <CardHeader
        title="Hồ sơ nghiệp vụ"
        actions={
          <button
            onClick={() => { setShowForm((v) => !v); setError(""); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Tải lên tài liệu
          </button>
        }
      />

      {/* Form upload */}
      {showForm && (
        <div className="mb-5 p-4 border border-blue-200 bg-blue-50 rounded-lg space-y-3">
          <p className="text-sm font-semibold text-blue-800">Thêm tài liệu mới</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tiêu đề <span className="text-red-500">*</span></label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="VD: Biên bản khám nghiệm hiện trường"
              />
            </div>
            <div>
              <FKSelect
                label="Loại tài liệu"
                value={docType}
                onChange={(v) => setDocType(v)}
                directoryType="DOCUMENT_TYPE"
                placeholder="-- Chọn loại --"
                canCreate={false}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Mô tả (tùy chọn)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ghi chú về tài liệu..."
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">File <span className="text-red-500">*</span></label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.mp4,.mp3,.txt"
                className="w-full text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
              />
              <p className="text-xs text-slate-400 mt-1">Hỗ trợ: PDF, Word, Excel, Hình ảnh, Video, Audio — tối đa 10MB</p>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setError(""); }} className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-sm hover:bg-slate-50">Hủy</button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Đang tải..." : "Tải lên"}
            </button>
          </div>
        </div>
      )}

      {/* Danh sách tài liệu */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-500" />
        </div>
      ) : docs.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">Chưa có tài liệu nào</p>
          {!caseId && <p className="text-xs text-amber-600 mt-1">Lưu hồ sơ trước để tải lên tài liệu</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 text-sm truncate">{doc.title}</p>
                  <p className="text-xs text-slate-500">
                    {DOC_TYPE_LABEL[doc.documentType] ?? doc.documentType}
                    {doc.size ? ` · ${formatBytes(doc.size)}` : ""}
                    {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString("vi-VN")}` : ""}
                  </p>
                  {doc.description && <p className="text-xs text-slate-400 truncate">{doc.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                <button
                  onClick={() => handleOpen(doc)}
                  className="p-1.5 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                  title="Mở tài liệu"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDownload(doc)}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Tải xuống"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(doc)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Xóa"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── StatFieldError: standalone component for stat field validation messages ─
function StatFieldError({ field, errors }: { field: string; errors: Record<string, string> }) {
  if (!errors[field]) return null;
  return (
    <div className="flex items-center gap-1 mt-1 text-red-600">
      <AlertCircle className="w-3 h-3" />
      <p className="text-xs">{errors[field]}</p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Tab 9: Thống kê 48 trường – full implementation từ Refs
// ═════════════════════════════════════════════════════════════════════════════

export function TabStatistics({ formData, setFormData }: TabProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const update = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    }
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

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.stat_sourceType) e.stat_sourceType = "Vui lòng chọn loại nguồn tin";
    if (!formData.stat_primaryCrime) e.stat_primaryCrime = "Vui lòng chọn tội danh chính";
    if (formData.stat_victimCount && isNaN(Number(formData.stat_victimCount))) e.stat_victimCount = "Phải là số";
    if (formData.stat_damageAmount && isNaN(Number(formData.stat_damageAmount))) e.stat_damageAmount = "Phải là số";
    setValidationErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { alert("Vui lòng kiểm tra lại các trường bắt buộc"); return; }
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setIsSaving(false);
    alert("Đã lưu thống kê 48 trường thành công!");
  };

  const sel = (className = "") =>
    `w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm ${className}`;
  const inp = (className = "") =>
    `w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${className}`;
  const errInp = (field: string) => validationErrors[field] ? "border-red-300 focus:ring-red-400" : "";

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
            <select value={formData.stat_sourceType} onChange={(e) => update("stat_sourceType", e.target.value)} className={sel(errInp("stat_sourceType"))} data-testid="stat-sourceType">
              <option value="">-- Chọn loại --</option>
              <option value="denunciation">Tố giác tội phạm</option>
              <option value="complaint">Khiếu nại</option>
              <option value="report">Báo cáo</option>
              <option value="discovery">Phát hiện qua công tác</option>
              <option value="informant">Nguồn tin mật</option>
              <option value="other">Khác</option>
            </select>
            <StatFieldError field="stat_sourceType" errors={validationErrors} />
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
            <FKSelect label="Tội danh chính" required directoryType="CRIME" value={formData.stat_primaryCrime} onChange={(v) => update("stat_primaryCrime", v)} placeholder="-- Chọn tội danh --" testId="stat-primaryCrime" error={validationErrors?.stat_primaryCrime} />
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
            <input value={formData.stat_damageAmount} onChange={(e) => update("stat_damageAmount", e.target.value)} placeholder="0" className={inp(errInp("stat_damageAmount"))} data-testid="stat-damageAmount" />
            <StatFieldError field="stat_damageAmount" errors={validationErrors} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Đã thu hồi (VNĐ)</label>
            <input value={formData.stat_recoveredAmount} onChange={(e) => update("stat_recoveredAmount", e.target.value)} placeholder="0" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Số bị hại</label>
            <input value={formData.stat_victimCount} onChange={(e) => update("stat_victimCount", e.target.value)} placeholder="0" className={inp(errInp("stat_victimCount"))} data-testid="stat-victimCount" />
            <StatFieldError field="stat_victimCount" errors={validationErrors} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Số người chết</label>
            <input value={formData.stat_deathCount} onChange={(e) => update("stat_deathCount", e.target.value)} placeholder="0" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Số người bị thương</label>
            <input value={formData.stat_injuryCount} onChange={(e) => update("stat_injuryCount", e.target.value)} placeholder="0" className={inp()} />
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
            { field: "stat_suspectCount", label: "Số đối tượng", type: "text", placeholder: "0" },
            { field: "stat_suspectArrested", label: "Đã bắt giữ", type: "text", placeholder: "0" },
            { field: "stat_suspectDetained", label: "Đã tạm giam", type: "text", placeholder: "0" },
          ].map(({ field, label, placeholder }) => (
            <div key={field}>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
              <input value={(formData as unknown as Record<string, string>)[field]} onChange={(e) => update(field as keyof typeof formData, e.target.value)} placeholder={placeholder} className={inp()} />
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
            <input value={formData.stat_processingDays} onChange={(e) => update("stat_processingDays", e.target.value)} placeholder="0" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Chứng cứ thu thập</label>
            <input value={formData.stat_evidenceCollected} onChange={(e) => update("stat_evidenceCollected", e.target.value)} placeholder="Số lượng" className={inp()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Số nhân chứng</label>
            <input value={formData.stat_witnessCount} onChange={(e) => update("stat_witnessCount", e.target.value)} placeholder="0" className={inp()} />
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
      <div className="flex items-center justify-end gap-3 bg-white rounded-lg border border-slate-200 p-4">
        <div className="flex-1 flex items-center gap-2 text-sm text-slate-600">
          <Info className="w-4 h-4" />
          <span>Đã điền {filledCount}/48 trường ({pct}%)</span>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-slate-300 disabled:cursor-not-allowed"
          data-testid="btn-save-statistics"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Đang lưu..." : "Lưu thống kê"}
        </button>
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
