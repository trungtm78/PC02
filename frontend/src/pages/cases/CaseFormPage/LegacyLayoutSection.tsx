/**
 * Dựng một dải ô nhập từ ĐẶC TẢ BỐ CỤC HỆ CŨ.
 *
 * Không dựng hệ form thứ hai: mọi ô vẫn là `FormInput` / `FormSelect` / `FormTextarea` /
 * `FKSelect` / `CrimeSelect` mà form đang dùng. Thành phần này chỉ làm một việc — đọc
 * `LegacyLayoutItem[]` rồi đặt đúng ô vào đúng chỗ, đúng nhãn.
 *
 * Nhờ vậy màn Tạo mới và màn Chỉnh sửa nhận cùng một mảng đặc tả, nên không thể lệch nhau.
 */

import { FormInput, FormSelect, FormTextarea } from "@/components/form";
import { FKSelect } from "@/components/FKSelect";
import { CrimeSelect } from "@/components/CrimeSelect";
import { legacyCaption, type LegacyLayoutItem } from "@/features/cases/legacy-form-layout.def";
import type { CaseFormData, CaseStatisticForm, TabProps } from "./types";

interface Props {
  items: readonly LegacyLayoutItem[];
  formData: CaseFormData;
  setFormData: TabProps["setFormData"];
  errors: TabProps["errors"];
  setErrors: TabProps["setErrors"];
}

type FieldValue = string | string[] | boolean;

const STAT_PREFIX = "statistic.";

function isStatField(field: string): boolean {
  return field.startsWith(STAT_PREFIX);
}

function statKey(field: string): keyof CaseStatisticForm {
  return field.slice(STAT_PREFIX.length) as keyof CaseStatisticForm;
}

/** Đọc giá trị của một ô, kể cả ô nằm trong nhánh `statistic`. */
export function readField(formData: CaseFormData, field: string): FieldValue {
  const raw = isStatField(field)
    ? formData.statistic[statKey(field)]
    : (formData as unknown as Record<string, unknown>)[field];
  if (typeof raw === "boolean") return raw;
  if (Array.isArray(raw)) return raw as string[];
  return raw == null ? "" : String(raw);
}

export function LegacyLayoutSection({ items, formData, setFormData, errors, setErrors }: Props) {
  const ghi = (field: string, value: FieldValue) => {
    setFormData((prev) => {
      if (isStatField(field)) {
        return { ...prev, statistic: { ...prev.statistic, [statKey(field)]: value } } as CaseFormData;
      }
      return { ...prev, [field]: value } as CaseFormData;
    });
    // Lỗi gắn theo tên ô, không theo tab: cùng một ô hiện ở nhiều tab thì sửa ở đâu cũng
    // xoá được thông báo lỗi ấy.
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {items.map((item, i) => (
        <LegacyField
          // Cùng một ô lưu có thể xuất hiện hai lần trong một tab (bản gốc và bản gương),
          // nên khoá phải kèm vị trí, không thể chỉ dùng tên ô.
          key={`${item.field}-${i}`}
          item={item}
          value={readField(formData, item.field)}
          error={errors[item.field]}
          onChange={(v) => ghi(item.field, v)}
        />
      ))}
    </div>
  );
}

function LegacyField({
  item,
  value,
  error,
  onChange,
}: {
  item: LegacyLayoutItem;
  value: FieldValue;
  error?: string;
  onChange: (v: FieldValue) => void;
}) {
  const label = legacyCaption(item);
  const colSpan = item.span === "full" ? (2 as const) : (1 as const);
  const wrapClass = item.span === "full" ? "md:col-span-2" : "";
  const testId = `legacy-field-${item.field}`;

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
        />,
      );

    case "multiselect":
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
