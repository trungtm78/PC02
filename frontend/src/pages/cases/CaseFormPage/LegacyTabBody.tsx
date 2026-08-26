/**
 * Lớp bọc mỏng cho Vụ án quanh khung thân tab ở tầng chung.
 *
 * Khung (pinnedTop → bố cục hệ cũ → afterLegacy → khối gập "Bổ sung hệ mới") đã chuyển sang
 * `@/components/legacy-form/LegacyTabBody` để Đơn thư dùng chung. Tệp này chỉ còn khai chỗ
 * lưu của Vụ án và bắc cầu mô hình lỗi.
 *
 * Giữ nguyên tên và chữ ký để mọi nơi đang gọi — và mọi ca kiểm Vụ án — không phải sửa.
 */

import { type ReactNode } from "react";
import { LegacyTabBody as LegacyTabBodyChung } from "@/components/legacy-form/LegacyTabBody";
import { CASE_LEGACY_SPEC, type LegacyTabId } from "@/features/cases/legacy-form-layout.def";
import type { TabProps } from "./types";

interface Props extends Pick<TabProps, "formData" | "setFormData" | "errors" | "setErrors"> {
  tabId: LegacyTabId;
  /** Khối luôn hiện, đặt trên bố cục hệ cũ. Dùng cho ô bắt buộc của hệ mới. */
  pinnedTop?: ReactNode;
  /** Khối gập lại: giao diện hệ mới hiện có của tab. */
  children?: ReactNode;
  /** Chèn giữa bố cục hệ cũ và khối gập — dùng cho bảng con của hệ cũ (vd ĐTBS). */
  afterLegacy?: ReactNode;
}

export function LegacyTabBody({
  tabId,
  formData,
  setFormData,
  errors,
  setErrors,
  pinnedTop,
  afterLegacy,
  children,
}: Props) {
  return (
    <LegacyTabBodyChung
      spec={CASE_LEGACY_SPEC}
      tabId={tabId}
      formData={formData}
      setFormData={setFormData}
      errorFor={(field) => errors[field]}
      onFieldTouched={(field) => {
        if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
      }}
      pinnedTop={pinnedTop}
      afterLegacy={afterLegacy}
    >
      {children}
    </LegacyTabBodyChung>
  );
}
