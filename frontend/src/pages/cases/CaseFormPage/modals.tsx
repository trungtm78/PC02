import { useState } from "react";
import { FormModal } from "@/components/shared";
import { FormInput, FormSelect, FormTextarea } from "@/components/form";
import { FKSelect } from "@/components/FKSelect";
import type { Subject, Evidence } from "./types";
import { SUBJECT_TYPE_OPTIONS, EVIDENCE_STATUS_OPTIONS } from "./constants";

// ═══════════════════════════════════════════════════════════════════════════
// Subject Modal – Thêm/Sửa đối tượng (Bị can, Bị hại, Luật sư, Nhân chứng)
// ═══════════════════════════════════════════════════════════════════════════

interface SubjectModalProps {
  subject: Subject | null;
  onClose: () => void;
  onSave: (subject: Subject) => void;
}

export function SubjectModal({ subject, onClose, onSave }: SubjectModalProps) {
  const [formData, setFormData] = useState<Subject>(
    subject || {
      id: "",
      type: "Bị can",
      name: "",
      idNumber: "",
      dateOfBirth: "",
      address: "",
      phone: "",
      gender: "",
      nationality: "Việt Nam",
      occupation: "",
      criminalRecord: "",
      detentionStatus: "",
    }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.name.trim()) e.name = "Vui lòng nhập họ tên";
    if (!formData.idNumber.trim()) e.idNumber = "Vui lòng nhập số CCCD/CMND";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (validate()) onSave(formData);
  };

  const update = (field: keyof Subject, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <FormModal
      open
      onClose={onClose}
      onSave={handleSave}
      title={subject ? "Chỉnh sửa đối tượng" : "Thêm đối tượng mới"}
    >
      <FormSelect
        label="Loại đối tượng"
        required
        value={formData.type}
        onChange={(v) => update("type", v as Subject["type"])}
        options={SUBJECT_TYPE_OPTIONS}
      />
      <FormInput
        label="Họ và tên"
        required
        value={formData.name}
        onChange={(v) => update("name", v)}
        placeholder="Họ và tên đầy đủ"
        error={errors.name}
        data-testid="input-subject-name"
      />
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Số CCCD/CMND"
          required
          value={formData.idNumber}
          onChange={(v) => update("idNumber", v)}
          placeholder="Số CCCD/CMND"
          error={errors.idNumber}
          data-testid="input-subject-id"
        />
        <FormInput
          label="Ngày sinh"
          type="date"
          value={formData.dateOfBirth}
          onChange={(v) => update("dateOfBirth", v)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FKSelect
          label="Giới tính"
          masterClassType="00"
          value={formData.gender ?? ""}
          onChange={(v) => update("gender", v)}
          placeholder="-- Chọn --"
        />
        <FormInput
          label="Quốc tịch"
          value={formData.nationality ?? "Việt Nam"}
          onChange={(v) => update("nationality", v)}
        />
      </div>
      <FormInput
        label="Nghề nghiệp"
        value={formData.occupation ?? ""}
        onChange={(v) => update("occupation", v)}
        placeholder="Nghề nghiệp hiện tại"
      />
      <FormInput
        label="Địa chỉ thường trú"
        value={formData.address}
        onChange={(v) => update("address", v)}
        placeholder="Địa chỉ đầy đủ"
      />
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Số điện thoại"
          type="tel"
          value={formData.phone}
          onChange={(v) => update("phone", v)}
          placeholder="09xxxxxxxx"
        />
        <FormSelect
          label="Tiền án tiền sự"
          value={formData.criminalRecord ?? ""}
          onChange={(v) => update("criminalRecord", v)}
          options={[
            { value: "khong", label: "Không" },
            { value: "co", label: "Có" },
          ]}
          placeholder="-- Chọn --"
        />
      </div>
      {formData.type === "Bị can" && (
        <FormSelect
          label="Tình trạng giam giữ"
          value={formData.detentionStatus ?? ""}
          onChange={(v) => update("detentionStatus", v)}
          options={[
            { value: "dang-dieu-tra", label: "Đang điều tra" },
            { value: "tam-giam", label: "Tạm giam" },
            { value: "tu-do", label: "Tự do" },
          ]}
          placeholder="-- Chọn --"
        />
      )}
    </FormModal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Evidence Modal – Thêm/Sửa vật chứng
// ═══════════════════════════════════════════════════════════════════════════

interface EvidenceModalProps {
  evidence: Evidence | null;
  onClose: () => void;
  onSave: (evidence: Evidence) => void;
}

export function EvidenceModal({ evidence, onClose, onSave }: EvidenceModalProps) {
  const [formData, setFormData] = useState<Evidence>(
    evidence || {
      id: "",
      code: "",
      name: "",
      description: "",
      quantity: 1,
      unit: "cái",
      storageLocation: "",
      receivedDate: "",
      status: "dang-luu-giu",
      evidenceType: "",
      entryOrder: "",
      warehouseReceipt: "",
    }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.code.trim()) e.code = "Vui lòng nhập mã vật chứng";
    if (!formData.name.trim()) e.name = "Vui lòng nhập tên vật chứng";
    if (!formData.quantity || formData.quantity < 1) e.quantity = "Số lượng phải ≥ 1";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (validate()) onSave(formData);
  };

  const update = (field: keyof Evidence, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[String(field)]) setErrors((prev) => ({ ...prev, [String(field)]: "" }));
  };

  return (
    <FormModal
      open
      onClose={onClose}
      onSave={handleSave}
      title={evidence ? "Chỉnh sửa vật chứng" : "Thêm vật chứng mới"}
    >
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Mã vật chứng"
          required
          value={formData.code}
          onChange={(v) => update("code", v)}
          placeholder="VD: VC-001"
          error={errors.code}
          data-testid="input-evidence-code"
        />
        <FKSelect
          label="Loại vật chứng"
          masterClassType="06"
          value={formData.evidenceType ?? ""}
          onChange={(v) => update("evidenceType", v)}
          placeholder="-- Chọn loại --"
        />
      </div>
      <FormInput
        label="Tên vật chứng"
        required
        value={formData.name}
        onChange={(v) => update("name", v)}
        placeholder="Tên gọi vật chứng"
        error={errors.name}
        data-testid="input-evidence-name"
      />
      <FormTextarea
        label="Mô tả đặc điểm"
        value={formData.description}
        onChange={(v) => update("description", v)}
        placeholder="Đặc điểm, màu sắc, kích thước, số serial..."
        rows={3}
      />
      <div className="grid grid-cols-3 gap-4">
        <FormInput
          label="Số lượng"
          type="number"
          required
          value={formData.quantity}
          onChange={(v) => update("quantity", Number(v))}
          error={errors.quantity}
          min={1}
        />
        <FormInput
          label="Đơn vị"
          value={formData.unit}
          onChange={(v) => update("unit", v)}
          placeholder="cái, bản, kg..."
        />
        <FormSelect
          label="Trạng thái"
          value={formData.status}
          onChange={(v) => update("status", v)}
          options={EVIDENCE_STATUS_OPTIONS}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Ngày thu giữ"
          type="date"
          value={formData.receivedDate}
          onChange={(v) => update("receivedDate", v)}
        />
        <FormInput
          label="Số lệnh nhập"
          value={formData.entryOrder ?? ""}
          onChange={(v) => update("entryOrder", v)}
          placeholder="LN-001/2026"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormInput
          label="Phiếu nhập kho"
          value={formData.warehouseReceipt ?? ""}
          onChange={(v) => update("warehouseReceipt", v)}
          placeholder="PNK-001/2026"
        />
        <FormInput
          label="Nơi lưu trữ"
          value={formData.storageLocation}
          onChange={(v) => update("storageLocation", v)}
          placeholder="Kho lưu trữ, vị trí cụ thể..."
        />
      </div>
    </FormModal>
  );
}
