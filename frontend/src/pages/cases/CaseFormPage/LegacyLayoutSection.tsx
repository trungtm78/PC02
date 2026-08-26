/**
 * Lớp bọc mỏng cho Vụ án quanh thành phần dựng ô ở tầng chung.
 *
 * Phần dựng ô đã chuyển sang `@/components/legacy-form/LegacyLayoutSection` để Đơn thư dùng
 * chung — hệ cũ vốn dùng ĐÚNG MỘT form cho cả hai. Tệp này chỉ còn làm hai việc riêng của
 * Vụ án: khai chỗ lưu (`CASE_LEGACY_SPEC`) và bắc cầu mô hình lỗi `Record<string, string>`
 * sang cặp `errorFor` / `onFieldTouched` của tầng chung.
 *
 * Giữ nguyên tên và chữ ký để mọi nơi đang gọi — và mọi ca kiểm Vụ án — không phải sửa.
 */

import { LegacyLayoutSection as LegacyLayoutSectionChung } from "@/components/legacy-form/LegacyLayoutSection";
import {
  CASE_LEGACY_SPEC,
  type LegacyLayoutItem,
} from "@/features/cases/legacy-form-layout.def";
import type { CaseFormData, TabProps } from "./types";
import type { LegacyFieldValue } from "@/features/legacy-form/types";

interface Props {
  items: readonly LegacyLayoutItem[];
  formData: CaseFormData;
  setFormData: TabProps["setFormData"];
  errors: TabProps["errors"];
  setErrors: TabProps["setErrors"];
}

/** Đọc giá trị của một ô, kể cả ô nằm trong nhánh `statistic`. */
export function readField(formData: CaseFormData, field: string): LegacyFieldValue {
  return CASE_LEGACY_SPEC.read(formData, field as never);
}

export function LegacyLayoutSection({
  items,
  formData,
  setFormData,
  errors,
  setErrors,
}: Props) {
  return (
    <LegacyLayoutSectionChung
      spec={CASE_LEGACY_SPEC}
      items={items}
      formData={formData}
      setFormData={setFormData}
      errorFor={(field) => errors[field]}
      // Lỗi gắn theo tên ô, không theo tab: cùng một ô hiện ở nhiều tab thì sửa ở đâu cũng
      // xoá được thông báo lỗi ấy.
      onFieldTouched={(field) => {
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
      }}
    />
  );
}
