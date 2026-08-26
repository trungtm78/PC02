/**
 * Khung thân tab: phần trên là bố cục hệ cũ, phần dưới là những ô chỉ hệ mới mới có.
 *
 * Cán bộ đang dùng hệ cũ mở tab ra là thấy đúng bộ ô họ quen, đúng thứ tự, đúng chữ — nhập
 * xong phần trên là xong việc. Những ô hệ mới thêm không bị xoá — chúng gắn với KPI, phân
 * quyền theo tổ và hành trình hồ sơ — mà dồn xuống một khối gập lại, mở ra khi cần.
 *
 * `pinnedTop` dành cho thứ KHÔNG được phép gập: ô bắt buộc ở máy chủ. Gập nó đi thì cán bộ
 * bấm Lưu, bị chặn bởi một ô không nhìn thấy được, và không hiểu vì sao — lỗi đã bấm trúng
 * trên máy thật ở epic Vụ án (PR #248).
 *
 * Dùng chung cho mọi thực thể: bảng bố cục lấy từ `LegacyFormSpec`, không tra bảng cứng.
 */

import { type ReactNode } from "react";
import { LegacyLayoutSection } from "./LegacyLayoutSection";
import type { LegacyFormSpec } from "@/features/legacy-form/types";

interface Props<TForm, TTab extends string, TField extends string> {
  spec: LegacyFormSpec<TForm, TTab, TField>;
  tabId: TTab;
  formData: TForm;
  setFormData: React.Dispatch<React.SetStateAction<TForm>>;
  errorFor?: (field: string) => string | undefined;
  onFieldTouched?: (field: string) => void;
  /** Khối luôn hiện, đặt trên bố cục hệ cũ. Dùng cho ô bắt buộc của hệ mới. */
  pinnedTop?: ReactNode;
  /** Chèn giữa bố cục hệ cũ và khối gập — dùng cho bảng con của hệ cũ (vd ĐTBS). */
  afterLegacy?: ReactNode;
  /** Khối gập lại: giao diện hệ mới hiện có của tab. */
  children?: ReactNode;
}

export function LegacyTabBody<TForm, TTab extends string, TField extends string>({
  spec,
  tabId,
  formData,
  setFormData,
  errorFor,
  onFieldTouched,
  pinnedTop,
  afterLegacy,
  children,
}: Props<TForm, TTab, TField>) {
  const items = spec.layout[tabId];

  return (
    <div className="space-y-6" data-testid={`tab-${tabId}`}>
      {pinnedTop}

      <div
        className="rounded-xl border border-slate-200 bg-white p-5"
        data-testid={`legacy-layout-${tabId}`}
      >
        <LegacyLayoutSection
          spec={spec}
          items={items}
          formData={formData}
          setFormData={setFormData}
          errorFor={errorFor}
          onFieldTouched={onFieldTouched}
        />
      </div>

      {afterLegacy}

      {children && (
        <details
          className="rounded-xl border border-slate-200 bg-slate-50"
          data-testid={`bo-sung-he-moi-${tabId}`}
        >
          <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-slate-700">
            Bổ sung hệ mới — các ô hệ cũ không có
          </summary>
          <div className="border-t border-slate-200 p-5">{children}</div>
        </details>
      )}
    </div>
  );
}
