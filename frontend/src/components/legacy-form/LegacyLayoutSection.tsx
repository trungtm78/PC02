/**
 * Dựng một dải ô nhập từ ĐẶC TẢ BỐ CỤC HỆ CŨ.
 *
 * Không dựng hệ form thứ hai: mọi ô vẫn là `FormInput` / `FormSelect` / `FormTextarea` /
 * `FKSelect` / `CrimeSelect` mà form đang dùng. Thành phần này chỉ làm một việc — đọc
 * `LegacyLayoutItem[]` rồi đặt đúng ô vào đúng chỗ, đúng nhãn.
 *
 * Nhờ vậy màn Tạo mới và màn Chỉnh sửa nhận cùng một mảng đặc tả, nên không thể lệch nhau.
 *
 * Dùng chung cho mọi thực thể: chỗ lưu giá trị do `LegacyFormSpec` quyết, thành phần này
 * không biết gì về `CaseFormData` hay `PetitionFormData`.
 */

import { FormInput, FormSelect, FormTextarea } from "@/components/form";
import { FKSelect } from "@/components/FKSelect";
import { CrimeSelect } from "@/components/CrimeSelect";
import { CatalogSelect } from "@/components/CatalogSelect";
import {
  legacyCaptionOf,
  type LegacyFieldValue,
  type LegacyFormSpec,
  type LegacyLayoutItem,
} from "@/features/legacy-form/types";

interface Props<TForm, TTab extends string, TField extends string> {
  spec: LegacyFormSpec<TForm, TTab, TField>;
  items: readonly LegacyLayoutItem<TField, TTab>[];
  formData: TForm;
  setFormData: React.Dispatch<React.SetStateAction<TForm>>;
  /** Lỗi tra theo TÊN Ô, không theo tab: cùng một ô hiện ở nhiều tab thì sửa ở đâu cũng xoá được. */
  errorFor?: (field: string) => string | undefined;
  /** Gọi khi cán bộ sửa một ô — dùng để xoá thông báo lỗi của chính ô ấy. */
  onFieldTouched?: (field: string) => void;
  /**
   * Thay ô mặc định bằng ô riêng cho vài trường cần hơn một ô chữ.
   *
   * Bố cục hệ cũ quyết NHÃN, THỨ TỰ và CHỖ ĐỨNG — ba thứ anh yêu cầu giống hệ cũ. Nhưng vài
   * ô của hệ mới mạnh hơn hẳn ô chữ trần: số điện thoại có định dạng, "Ghi chú trùng đơn" tra
   * được đơn trùng, "Tội danh cũ" tra được tiền án. Xoá chúng đi để giống hệ cũ là hạ cấp năng
   * lực — giữ đúng chỗ, đúng nhãn, chỉ đổi ruột.
   */
  renderOverride?: Partial<Record<string, (label: string) => React.ReactNode>>;
}

export function LegacyLayoutSection<TForm, TTab extends string, TField extends string>({
  spec,
  items,
  formData,
  setFormData,
  errorFor,
  onFieldTouched,
  renderOverride,
}: Props<TForm, TTab, TField>) {
  const ghi = (field: TField, value: LegacyFieldValue) => {
    setFormData((prev) => spec.write(prev, field, value));
    onFieldTouched?.(field);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((item, i) => {
        const rieng = renderOverride?.[item.field];
        if (rieng) {
          return (
            <div
              key={`${item.field}-${i}`}
              className={item.span === "full" ? "md:col-span-2" : ""}
              data-testid={`legacy-field-${item.field}`}
            >
              {rieng(legacyCaptionOf(item, spec.tabLabel))}
            </div>
          );
        }
        return (
        <LegacyField
          // Cùng một ô lưu có thể xuất hiện hai lần trong một tab (bản gốc và bản gương),
          // nên khoá phải kèm vị trí, không thể chỉ dùng tên ô.
          key={`${item.field}-${i}`}
          item={item as LegacyLayoutItem}
          label={legacyCaptionOf(item, spec.tabLabel)}
          value={spec.read(formData, item.field)}
          error={errorFor?.(item.field)}
          onChange={(v) => ghi(item.field, v)}
        />
        );
      })}
    </div>
  );
}
function LegacyField({
  item,
  label,
  value,
  error,
  onChange,
}: {
  item: LegacyLayoutItem;
  label: string;
  value: LegacyFieldValue;
  error?: string;
  onChange: (v: LegacyFieldValue) => void;
}) {
  const colSpan = item.span === "full" ? (2 as const) : (1 as const);
  const wrapClass = item.span === "full" ? "md:col-span-2" : "";
  const testId = `legacy-field-${item.field}`;
  // Ô nhập bên trong mang `field-<tên ô>` — cùng quy ước với phần còn lại của ứng dụng, nên
  // ca kiểm và kịch bản kiểm thử bám được vào ô mà không phải biết nó nằm ở tab nào.
  const oTestId = `field-${item.field}`;

  // Bọc thêm một lớp để ca kiểm bám vào được chỗ đứng của ô mà không phải suy từ lớp CSS
  // của thành phần con — chỗ đứng là thứ anh yêu cầu giống hệ cũ, nên phải chốt được.
  const wrap = (node: React.ReactNode) => (
    <div className={wrapClass} data-testid={testId}>
      {node}
    </div>
  );

  switch (item.kind) {
    case "textarea":
      return wrap(
        <FormTextarea
          label={label}
          required={item.required}
          error={error}
          value={String(value)}
          onChange={onChange}
          placeholder={item.placeholder}
          rows={item.rows ?? 3}
          data-testid={oTestId}
        />,
      );

    case "select":
      return wrap(
        <FormSelect
          label={label}
          required={item.required}
          error={error}
          value={String(value)}
          onChange={onChange}
          options={[...(item.options ?? [])]}
          placeholder={item.placeholder ?? "Chọn"}
          data-testid={oTestId}
        />,
      );

    case "multiselect":
      // Ô chọn-nhiều KHÔNG khai sẵn bộ lựa chọn thì có hai đường, và cả hai đều tốt hơn việc
      // dựng một nhóm ô tích RỖNG — nhóm rỗng nghĩa là cán bộ nhìn thấy một ô mà không nhập
      // được gì, còn dữ liệu di trú ở đó thì không sửa được và cũng không hiện ra.
      if (!item.options?.length) {
        // Có khai danh mục thì tra danh mục — nhãn và lựa chọn theo registry, thêm mục mới là
        // ô tự có.
        if (item.source) {
          return wrap(
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
              <CatalogSelect
                catalogKey={item.source}
                value={Array.isArray(value) ? value : []}
                onChange={(v) => onChange(v as string[])}
              />
              {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
            </div>,
          );
        }
        // Không có cả hai thì cho gõ chữ, ngăn cách bằng dấu phẩy: giữ được dữ liệu và sửa
        // được, thay vì một ô chết.
        return wrap(
          <FormInput
            label={label}
            error={error}
            type="text"
            value={Array.isArray(value) ? value.join(", ") : String(value)}
            onChange={(v) =>
              onChange(
                String(v)
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              )
            }
            placeholder={item.placeholder ?? "Ngăn cách bằng dấu phẩy"}
            data-testid={oTestId}
          />,
        );
      }
      return wrap(
        <MultiSelectField
          label={label}
          error={error}
          options={item.options}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
        />,
      );

    case "toggle":
      return wrap(<ToggleField label={label} checked={value === true} onChange={onChange} />);

    case "crime":
      return wrap(
        <CrimeSelect
          label={label}
          value={String(value)}
          onChange={(v: string) => onChange(v)}
          error={error}
          required={item.required}
          testId={oTestId}
        />,
      );

    case "fk":
      return wrap(
        <FKSelect
          label={label}
          directoryType={item.source ?? ""}
          value={String(value)}
          onChange={(v: string) => onChange(v)}
          error={error}
          required={item.required}
          testId={oTestId}
        />,
      );

    case "date":
    case "number":
    case "text":
    default:
      return wrap(
        <FormInput
          label={label}
          required={item.required}
          error={error}
          type={item.kind === "date" ? "date" : item.kind === "number" ? "number" : "text"}
          value={String(value)}
          onChange={onChange}
          placeholder={item.placeholder}
          colSpan={colSpan === 2 ? undefined : undefined}
          data-testid={oTestId}
        />,
      );
  }
}

/**
 * Ô chọn nhiều của hệ cũ là danh sách cuộn cho phép giữ Ctrl để chọn — thao tác ấy khó và
 * hay chọn nhầm. Hệ mới dựng thành các ô tích, giữ nguyên bộ lựa chọn và nguyên văn nhãn.
 */
function MultiSelectField({
  label,
  error,
  options,
  value,
  onChange,
}: {
  label: string;
  error?: string;
  options?: readonly { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const doi = (ma: string) =>
    onChange(value.includes(ma) ? value.filter((v) => v !== ma) : [...value, ma]);

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="space-y-1.5 rounded-lg border border-slate-200 p-3">
        {(options ?? []).map((o) => (
          <label key={o.value} className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-0.5"
              aria-label={o.label}
              checked={value.includes(o.value)}
              onChange={() => doi(o.value)}
            />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

/** Hệ cũ dùng công tắc Bật/Tắt; hệ mới dùng ô tích, cùng ngữ nghĩa đúng-sai. */
function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm font-medium text-slate-700">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
