/**
 * Khung thân tab: phần trên là bố cục hệ cũ, phần dưới là những ô chỉ hệ mới mới có.
 *
 * Cán bộ đang dùng hệ cũ mở tab ra là thấy đúng bộ ô họ quen, đúng thứ tự, đúng chữ —
 * nhập xong phần trên là xong việc. Những ô hệ mới thêm (nguồn vụ án theo BLTTHS Đ.143,
 * khu vực xảy ra theo tỉnh/phường, bảng đối tượng, bảng vật chứng, 48 chỉ tiêu thống kê…)
 * không bị xoá — chúng gắn với KPI, phân quyền theo tổ và hành trình hồ sơ — mà dồn xuống
 * một khối gập lại, mở ra khi cần.
 *
 * `pinnedTop` dành cho thứ KHÔNG được phép gập: ô "Nguồn vụ án" là bắt buộc ở máy chủ,
 * gập nó đi thì cán bộ không lưu được hồ sơ mà không hiểu vì sao.
 */

import { type ReactNode } from "react";
import { LEGACY_FORM_LAYOUT, type LegacyTabId } from "@/features/cases/legacy-form-layout.def";
import { LegacyLayoutSection } from "./LegacyLayoutSection";
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
  const items = LEGACY_FORM_LAYOUT[tabId];

  return (
    <div className="space-y-6" data-testid={`tab-${tabId}`}>
      {pinnedTop}

      <div className="rounded-xl border border-slate-200 bg-white p-5" data-testid={`legacy-layout-${tabId}`}>
        <LegacyLayoutSection
          items={items}
          formData={formData}
          setFormData={setFormData}
          errors={errors}
          setErrors={setErrors}
        />
      </div>

      {afterLegacy}

      {children && (
        <details className="rounded-xl border border-slate-200 bg-slate-50" data-testid={`bo-sung-he-moi-${tabId}`}>
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-slate-700">
            Bổ sung hệ mới — các ô hệ cũ không có
          </summary>
          <div className="border-t border-slate-200 p-5">{children}</div>
        </details>
      )}
    </div>
  );
}
