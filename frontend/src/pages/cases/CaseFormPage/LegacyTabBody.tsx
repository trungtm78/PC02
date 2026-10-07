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
import type { NhomOKhai } from "@/components/legacy-form/NhomOGap";
import { CASE_LEGACY_SPEC, type LegacyTabId } from "@/features/cases/legacy-form-layout.def";
import type { CaseFormData, TabProps } from "./types";
import { giaTriONgay } from '@/features/legacy-form/gia-tri-o-ngay';
import { CASE_NULLABLE_BOOLEAN_FIELDS, readCasePath, unchangedCaseFallback, confirmCaseFallback } from '@/features/cases/canonical-fields';
import { CaseNullableBooleanField } from '@/features/cases/CaseNullableBooleanField';
import { nativeFieldAllowed, useNativeFieldPolicies } from '@/features/cases/native-field-policy';

interface Props extends Pick<TabProps, "formData" | "setFormData" | "errors" | "setErrors"> {
  tabId: LegacyTabId;
  /** Khối luôn hiện, đặt trên bố cục hệ cũ. Dùng cho ô bắt buộc của hệ mới. */
  pinnedTop?: ReactNode;
  /** Khối gập lại: giao diện hệ mới hiện có của tab. */
  children?: ReactNode;
  /** Chèn giữa bố cục hệ cũ và khối gập — dùng cho bảng con của hệ cũ (vd ĐTBS). */
  afterLegacy?: ReactNode;
  /** Thay ô mặc định bằng ô riêng — vd "Nguồn đơn/Đơn vị giao" chọn từ danh mục. */
  renderOverride?: Partial<Record<string, (label: string) => ReactNode>>;
  nhom?: readonly NhomOKhai<CaseFormData>[];
}

export function LegacyTabBody({
  tabId,
  formData,
  setFormData,
  errors,
  setErrors,
  pinnedTop,
  afterLegacy,
  renderOverride,
  nhom,
  children,
}: Props) {
  const policies = useNativeFieldPolicies();
  const hiddenFields = CASE_LEGACY_SPEC.layout[tabId].filter(item => !nativeFieldAllowed(policies, item.field)).map(item => item.field);
  const readonlyOverrides = Object.fromEntries(CASE_LEGACY_SPEC.layout[tabId].filter(item => !nativeFieldAllowed(policies, item.field, 'writable')).map(item => [item.field, (label: string) => <div><p className="text-sm text-slate-500">{label}</p><p className="text-sm">{String(CASE_LEGACY_SPEC.read(formData, item.field) ?? '—')}</p></div>]));
  const nullableOverrides = Object.fromEntries(CASE_LEGACY_SPEC.layout[tabId]
    .filter(item => CASE_NULLABLE_BOOLEAN_FIELDS.has(item.field))
    .map(item => [item.field, (label: string) => {
      const value = readCasePath(formData as unknown as Record<string, unknown>, item.field);
      return <CaseNullableBooleanField label={label} value={typeof value === 'boolean' ? value : null} testId={`field-${item.field}`} onChange={next => setFormData(previous => CASE_LEGACY_SPEC.write(confirmCaseFallback(previous, item.field), item.field, next as unknown as boolean))} />;
    }]));
  const dateSources = Object.fromEntries(CASE_LEGACY_SPEC.layout[tabId]
    .filter(item => item.kind === 'date')
    .map(item => ({ key: item.field, value: CASE_LEGACY_SPEC.read(formData, item.field) }))
    .filter(item => item.value !== '' && !giaTriONgay(item.value))
    .map(item => [item.key, <p key={item.key} data-testid={`legacy-date-source-${item.key}`} className="text-sm text-amber-700">Ngày gốc chưa xác minh: {String(item.value)}</p>]));
  const sourceAnnotations = Object.fromEntries(CASE_LEGACY_SPEC.layout[tabId].map(item => {
    const fallback = unchangedCaseFallback(formData, item.field);
    if (!fallback) return [item.field, dateSources[item.field]];
    const canConfirm = item.kind !== 'date' || Boolean(giaTriONgay(fallback.value));
    return [item.field, <div className="space-y-1" data-testid={`legacy-source-${item.field}`}>
      <p className="text-sm text-amber-700" title={fallback.source}>Dữ liệu hệ cũ chưa xác minh</p>
      {dateSources[item.field]}
      {canConfirm && nativeFieldAllowed(policies, item.field, 'writable') && <button type="button" className="text-sm text-blue-700 underline" onClick={() => setFormData(previous => confirmCaseFallback(previous, item.field))}>Xác nhận giá trị này</button>}
    </div>];
  }));
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
      renderOverride={{ ...nullableOverrides, ...renderOverride, ...readonlyOverrides }}
      oAn={hiddenFields}
      sauO={sourceAnnotations}
      nhom={nhom}
    >
      {children}
    </LegacyTabBodyChung>
  );
}
