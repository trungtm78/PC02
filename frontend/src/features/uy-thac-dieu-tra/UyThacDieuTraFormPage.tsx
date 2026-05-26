import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { extractApiError } from "@/lib/api-errors";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { FKSelect } from "@/components/FKSelect";
import {
  LOAI_UY_THAC_OPTIONS,
  TRANG_THAI_PHAN_HOI_LABEL,
  TRANG_THAI_PHAN_HOI_BADGE,
  type TrangThaiPhanHoi,
} from "@/shared/enums/status-labels";
import { CaseType } from "@/shared/enums/generated";
import { toDateInput } from "@/lib/dates";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormData {
  name: string;
  investigatorId: string;
  assignedTeamId: string;
  // Section 1 — Thông tin Ủy Thác
  loaiUyThac: string;
  ngayTiepNhan: string;
  donViGiao: string;
  soQuyetDinhUyThac: string;
  thoiHanUyThac: string;
  loaiThongTin: string;
  // Section 2 — Nguồn Đơn
  nghiVanDoiTuong: string;
  // Section 3 — Kết quả
  ketQuaUyThac: string;
  ngayTraKetQua: string;
  lyDoKhongThucHienDuoc: string;
  ngayThongBaoKhongThucHien: string;
}

const EMPTY: FormData = {
  name: "",
  investigatorId: "",
  assignedTeamId: "",
  loaiUyThac: "",
  ngayTiepNhan: "",
  donViGiao: "",
  soQuyetDinhUyThac: "",
  thoiHanUyThac: "",
  loaiThongTin: "",
  nghiVanDoiTuong: "",
  ketQuaUyThac: "",
  ngayTraKetQua: "",
  lyDoKhongThucHienDuoc: "",
  ngayThongBaoKhongThucHien: "",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-gray-200 pb-2 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full ${className ?? ""}`}
    />
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full resize-none"
    />
  );
}

function SelectInput({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UyThacDieuTraFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Load existing data in edit mode
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/cases/${id}`)
      .then((res) => {
        const c = res.data?.data ?? res.data;
        const meta = (c.metadata as Record<string, string> | null) ?? {};
        setForm({
          name: c.name ?? "",
          investigatorId: c.investigatorId ?? c.investigator?.id ?? "",
          assignedTeamId: c.assignedTeamId ?? "",
          loaiUyThac: c.loaiUyThac ?? "",
          ngayTiepNhan: toDateInput(c.ngayTiepNhan),
          donViGiao: c.donViGiao ?? "",
          soQuyetDinhUyThac: c.soQuyetDinhUyThac ?? "",
          thoiHanUyThac: toDateInput(c.thoiHanUyThac),
          loaiThongTin: c.loaiThongTin ?? "",
          nghiVanDoiTuong: (meta.nghiVanDoiTuong as string) ?? "",
          ketQuaUyThac: c.ketQuaUyThac ?? "",
          ngayTraKetQua: toDateInput(c.ngayTraKetQua),
          lyDoKhongThucHienDuoc: (meta.lyDoKhongThucHienDuoc as string) ?? "",
          ngayThongBaoKhongThucHien: (meta.ngayThongBaoKhongThucHien as string) ?? "",
        });
      })
      .catch(() => setApiError("Không tải được dữ liệu ủy thác."))
      .finally(() => setLoading(false));
  }, [id]);

  function upd(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate(): boolean {
    const e: Partial<FormData> = {};
    if (!form.name.trim()) e.name = "Tên / mô tả ủy thác bắt buộc";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setApiError(null);
    try {
      const metadataPatch: Record<string, string | undefined> = {};
      if (form.nghiVanDoiTuong) metadataPatch.nghiVanDoiTuong = form.nghiVanDoiTuong;
      if (form.lyDoKhongThucHienDuoc) metadataPatch.lyDoKhongThucHienDuoc = form.lyDoKhongThucHienDuoc;
      if (form.ngayThongBaoKhongThucHien) metadataPatch.ngayThongBaoKhongThucHien = form.ngayThongBaoKhongThucHien;

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        caseType: CaseType.UY_THAC_DIEU_TRA,
        ...(form.loaiUyThac && { loaiUyThac: form.loaiUyThac }),
        ...(form.ngayTiepNhan && { ngayTiepNhan: form.ngayTiepNhan }),
        ...(form.donViGiao && { donViGiao: form.donViGiao }),
        ...(form.soQuyetDinhUyThac && { soQuyetDinhUyThac: form.soQuyetDinhUyThac }),
        ...(form.thoiHanUyThac && { thoiHanUyThac: form.thoiHanUyThac }),
        ...(form.loaiThongTin && { loaiThongTin: form.loaiThongTin }),
        ...(form.ketQuaUyThac && { ketQuaUyThac: form.ketQuaUyThac }),
        ...(form.ngayTraKetQua && { ngayTraKetQua: form.ngayTraKetQua }),
        ...(form.investigatorId && { investigatorId: form.investigatorId }),
        ...(form.assignedTeamId && { assignedTeamId: form.assignedTeamId }),
        ...(Object.keys(metadataPatch).length > 0 && { metadata: metadataPatch }),
      };

      if (isEdit) {
        await api.patch(`/cases/${id}`, payload);
      } else {
        await api.post("/cases", payload);
      }
      navigate("/uy-thac-dieu-tra");
    } catch (err) {
      setApiError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  }

  // Compute trạng thái phản hồi for display
  let trangThai: TrangThaiPhanHoi = "CHUA_PHAN_HOI";
  if (form.lyDoKhongThucHienDuoc) trangThai = "KHONG_THUC_HIEN_DUOC";
  else if (form.ketQuaUyThac && form.ngayTraKetQua) trangThai = "DA_PHAN_HOI";
  else if (form.thoiHanUyThac && new Date() > new Date(form.thoiHanUyThac)) trangThai = "QUA_HAN";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/uy-thac-dieu-tra")}
          className="p-2 rounded-md hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? "Chỉnh sửa ủy thác điều tra" : "Nhập ủy thác điều tra mới"}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Điều 171 BLTTHS 2015 · TT 119/2021/TT-BCA</p>
        </div>
      </div>

      {apiError && (
        <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
          {apiError}
        </div>
      )}

      {/* Basic info */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <SectionHeader title="Thông tin chung" />
        <div className="grid grid-cols-1 gap-4">
          <Field label="Tên / mô tả ủy thác" required>
            <TextInput
              value={form.name}
              onChange={(v) => upd("name", v)}
              placeholder="Tóm tắt nội dung ủy thác điều tra..."
            />
            {errors.name && <p className="text-xs text-red-500 mt-0.5">{errors.name}</p>}
          </Field>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Điều tra viên thụ lý">
            <FKSelect
              directoryType="USER"
              value={form.investigatorId}
              onChange={(v) => upd("investigatorId", v ?? "")}
              placeholder="-- Chọn điều tra viên --"
            />
          </Field>
          <Field label="Tổ phụ trách">
            <FKSelect
              directoryType="TEAM"
              value={form.assignedTeamId}
              onChange={(v) => upd("assignedTeamId", v ?? "")}
              placeholder="-- Chọn tổ --"
            />
          </Field>
        </div>
      </div>

      {/* Section 1 — Thông tin Ủy Thác */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <SectionHeader title="Thông tin Ủy Thác" subtitle="Điều 171 BLTTHS 2015" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Loại ủy thác">
            <SelectInput
              value={form.loaiUyThac}
              onChange={(v) => upd("loaiUyThac", v)}
              options={LOAI_UY_THAC_OPTIONS}
              placeholder="-- Chọn loại --"
            />
          </Field>
          <Field label="Ngày tiếp nhận">
            <DateInput value={form.ngayTiepNhan} onChange={(v) => upd("ngayTiepNhan", v)} />
          </Field>
          <Field label="Đơn vị giao">
            <TextInput
              value={form.donViGiao}
              onChange={(v) => upd("donViGiao", v)}
              placeholder="PC01, CA quận X, Bưu điện..."
            />
          </Field>
          <Field label="Số QĐ/Phiếu ủy thác (Mẫu 58)">
            <TextInput
              value={form.soQuyetDinhUyThac}
              onChange={(v) => upd("soQuyetDinhUyThac", v)}
              placeholder="VD: 12/QĐ-PC01"
            />
          </Field>
          <Field label="Thời hạn thực hiện">
            <DateInput value={form.thoiHanUyThac} onChange={(v) => upd("thoiHanUyThac", v)} />
          </Field>
          <Field label="Loại thông tin">
            <TextInput
              value={form.loaiThongTin}
              onChange={(v) => upd("loaiThongTin", v)}
              placeholder="Tố giác, Trình báo, Đề nghị..."
            />
          </Field>
        </div>
      </div>

      {/* Section 2 — Thông tin Nguồn Đơn */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <SectionHeader title="Thông tin Nguồn Đơn" subtitle="TT 28/2020/TT-BCA" />
        <div className="grid grid-cols-1 gap-4">
          <Field label="Nghi vấn đối tượng / bị can">
            <TextInput
              value={form.nghiVanDoiTuong}
              onChange={(v) => upd("nghiVanDoiTuong", v)}
              placeholder="Tên, thông tin nhận dạng đối tượng..."
            />
          </Field>
        </div>
      </div>

      {/* Section 3 — Kết quả Ủy Thác */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
        <SectionHeader title="Kết quả Ủy Thác" />
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500">Trạng thái phản hồi:</span>
          <span className={TRANG_THAI_PHAN_HOI_BADGE[trangThai]}>
            {TRANG_THAI_PHAN_HOI_LABEL[trangThai]}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Ngày trả kết quả">
            <DateInput value={form.ngayTraKetQua} onChange={(v) => upd("ngayTraKetQua", v)} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Kết quả xử lý">
              <Textarea
                value={form.ketQuaUyThac}
                onChange={(v) => upd("ketQuaUyThac", v)}
                placeholder="Tóm tắt kết quả điều tra..."
                rows={3}
              />
            </Field>
          </div>
          <div className="md:col-span-2 border-t border-dashed border-gray-200 pt-4">
            <p className="text-xs text-gray-400 mb-3">Trường hợp không thực hiện được (Điều 171 BLTTHS)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Ngày thông báo không thực hiện được">
                <DateInput
                  value={form.ngayThongBaoKhongThucHien}
                  onChange={(v) => upd("ngayThongBaoKhongThucHien", v)}
                />
              </Field>
              <div className="md:col-span-2">
                <Field label="Lý do không thực hiện được">
                  <Textarea
                    value={form.lyDoKhongThucHienDuoc}
                    onChange={(v) => upd("lyDoKhongThucHienDuoc", v)}
                    placeholder="Nêu rõ lý do theo Điều 171 BLTTHS..."
                    rows={2}
                  />
                </Field>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button
          onClick={() => navigate("/uy-thac-dieu-tra")}
          className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
        >
          Hủy
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Lưu ủy thác"}
        </button>
      </div>
    </div>
  );
}
