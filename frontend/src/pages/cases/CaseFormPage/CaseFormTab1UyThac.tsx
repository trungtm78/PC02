import { FormInput, FormSelect, FormTextarea } from "@/components/form";
import { Card, CardHeader } from "@/components/shared";
import type { TabProps } from "./types";
import { LOAI_UY_THAC_OPTIONS, TRANG_THAI_PHAN_HOI_LABEL, TRANG_THAI_PHAN_HOI_BADGE, type TrangThaiPhanHoi } from "@/shared/enums/status-labels";

// ─── Section header with legal reference subtitle ─────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-gray-200 pb-2 mb-4">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
      {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ─── Computed trangThaiPhanHoi badge ─────────────────────────────────────────

function TrangThaiBadge({ formData }: Pick<TabProps, 'formData'>) {
  let state: TrangThaiPhanHoi = 'CHUA_PHAN_HOI';
  if (formData.utdt_lyDoKhongThucHienDuoc) {
    state = 'KHONG_THUC_HIEN_DUOC';
  } else if (formData.utdt_ketQuaUyThac && formData.utdt_ngayTraKetQua) {
    state = 'DA_PHAN_HOI';
  } else if (formData.utdt_thoiHanUyThac && new Date() > new Date(formData.utdt_thoiHanUyThac)) {
    state = 'QUA_HAN';
  }
  return (
    <span className={TRANG_THAI_PHAN_HOI_BADGE[state]}>
      {TRANG_THAI_PHAN_HOI_LABEL[state]}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CaseFormTab1UyThac({ formData, setFormData, errors, setErrors }: TabProps) {
  function update(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  const showKhongThucHien = !!formData.utdt_lyDoKhongThucHienDuoc;

  return (
    <div className="space-y-5 mt-4">
      {/* Section 1: Thông tin Ủy Thác */}
      <Card>
        <SectionHeader
          title="Thông tin Ủy Thác"
          subtitle="Điều 171 BLTTHS 2015"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormSelect
            label="Loại ủy thác"
            value={formData.utdt_loaiUyThac}
            onChange={(v) => update('utdt_loaiUyThac', v)}
            options={LOAI_UY_THAC_OPTIONS}
            placeholder="-- Chọn loại --"
          />
          <FormInput
            label="Ngày tiếp nhận"
            type="date"
            value={formData.utdt_ngayTiepNhan}
            onChange={(v) => update('utdt_ngayTiepNhan', v)}
          />
          <FormInput
            label="Đơn vị giao"
            value={formData.utdt_donViGiao}
            onChange={(v) => update('utdt_donViGiao', v)}
            placeholder="PC01, CA quận X..."
          />
          <FormInput
            label="Số QĐ/Phiếu ủy thác (Mẫu 58)"
            value={formData.utdt_soQuyetDinhUyThac}
            onChange={(v) => update('utdt_soQuyetDinhUyThac', v)}
            placeholder="VD: 12/QĐ-PC01"
          />
          <FormInput
            label="Thời hạn thực hiện"
            type="date"
            value={formData.utdt_thoiHanUyThac}
            onChange={(v) => update('utdt_thoiHanUyThac', v)}
          />
          <FormInput
            label="Loại thông tin"
            value={formData.utdt_loaiThongTin}
            onChange={(v) => update('utdt_loaiThongTin', v)}
            placeholder="Tố giác, Trình báo, Đề nghị..."
          />
        </div>
      </Card>

      {/* Section 2: Thông tin Nguồn Đơn */}
      <Card>
        <SectionHeader
          title="Thông tin Nguồn Đơn"
          subtitle="TT 28/2020/TT-BCA"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Nghi vấn đối tượng / bị can"
            value={formData.utdt_nghiVanDoiTuong}
            onChange={(v) => update('utdt_nghiVanDoiTuong', v)}
            placeholder="Tên, thông tin nhận dạng..."
          />
        </div>
      </Card>

      {/* Section 3: Kết quả Ủy Thác */}
      <Card>
        <SectionHeader title="Kết quả Ủy Thác" />
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-600 font-medium">Trạng thái phản hồi:</span>
          <TrangThaiBadge formData={formData} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Ngày trả kết quả"
            type="date"
            value={formData.utdt_ngayTraKetQua}
            onChange={(v) => update('utdt_ngayTraKetQua', v)}
          />
          <div className="md:col-span-2">
            <FormTextarea
              label="Kết quả xử lý"
              value={formData.utdt_ketQuaUyThac}
              onChange={(v) => update('utdt_ketQuaUyThac', v)}
              placeholder="Tóm tắt kết quả điều tra..."
              rows={3}
            />
          </div>

          {/* Không thực hiện được — always shown so user can fill in reason */}
          <div className="md:col-span-2 border-t border-dashed border-gray-200 pt-3 mt-1">
            <p className="text-xs text-gray-400 mb-2">Trường hợp không thực hiện được (Điều 171 BLTTHS)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput
                label="Ngày thông báo không thực hiện được"
                type="date"
                value={formData.utdt_ngayThongBaoKhongThucHien}
                onChange={(v) => update('utdt_ngayThongBaoKhongThucHien', v)}
              />
              <div className={showKhongThucHien ? '' : 'md:col-span-2'}>
                <FormTextarea
                  label="Lý do không thực hiện được"
                  value={formData.utdt_lyDoKhongThucHienDuoc}
                  onChange={(v) => update('utdt_lyDoKhongThucHienDuoc', v)}
                  placeholder="Nêu rõ lý do theo Điều 171 BLTTHS..."
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
