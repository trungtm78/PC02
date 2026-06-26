import { useCatalog } from "@/hooks/useCatalog";
import { CATALOG_META } from "@/shared/catalog/catalog.generated";

// Qua `unknown` để gỡ readonly-tuple từ `as const` của catalog.generated (tsc -b strict).
const META = CATALOG_META as unknown as Record<
  string,
  { kind: string; multi: boolean; cascade?: { parentKey: string; map: Record<string, string[]> } }
>;

interface CatalogSelectProps {
  catalogKey: string;
  value: string | string[];
  onChange: (next: string | string[]) => void;
  /** Mặc định lấy từ CATALOG_META[key].multi — chỉ truyền để override có chủ đích. */
  multi?: boolean;
  /** Giá trị field cha — dùng lọc cascading (vd LoaiNguonTin → NguonPhatTin). */
  parentValue?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** Áp lên thẻ <select> (multi=false) để liên kết với <label htmlFor>. */
  id?: string;
  "data-testid"?: string;
}

/**
 * 1 component duy nhất cho mọi danh mục catalog (thay FKSelect/FormSelect/checkbox rải rác).
 * multi=true → nhóm checkbox (mảng code); multi=false → <select> đơn.
 * testid mỗi option: `cat-{code}`.
 */
export function CatalogSelect({
  catalogKey,
  value,
  onChange,
  multi: multiProp,
  parentValue,
  disabled,
  className,
  placeholder = "-- Chọn --",
  id,
  ...rest
}: CatalogSelectProps) {
  const { options } = useCatalog(catalogKey);
  // multi mặc định theo registry (META) — tránh lệch prop↔data gây mất dữ liệu thầm lặng (review P1-2).
  const multi = multiProp ?? META[catalogKey]?.multi ?? false;
  const cascade = META[catalogKey]?.cascade;
  // Cascade fail-open: parentValue có nhưng KHÔNG có key trong map (cấu hình thiếu) → hiện tất cả + cảnh báo dev,
  // tránh dropdown trống không lý do (review P1-1). Key tồn tại nhưng list rỗng → tôn trọng (ẩn hết).
  let allowed: string[] | null = null;
  if (cascade && parentValue) {
    if (Object.prototype.hasOwnProperty.call(cascade.map, parentValue)) {
      allowed = cascade.map[parentValue];
    } else if (import.meta.env?.DEV) {
      console.warn(`[CatalogSelect] cascade ${catalogKey}: thiếu map cho parentValue="${parentValue}" → hiện tất cả`);
    }
  }
  const visible = allowed ? options.filter((o) => allowed!.includes(o.code)) : options;

  if (multi) {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2" data-testid={rest["data-testid"]}>
        {visible.map((opt) => {
          const checked = arr.includes(opt.code);
          return (
            <label
              key={opt.code}
              className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"
            >
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={checked}
                disabled={disabled}
                data-testid={`cat-${opt.code}`}
                onChange={(e) =>
                  onChange(e.target.checked ? [...arr, opt.code] : arr.filter((c) => c !== opt.code))
                }
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    );
  }

  return (
    <select
      id={id}
      className={className ?? "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"}
      value={typeof value === "string" ? value : ""}
      disabled={disabled}
      data-testid={rest["data-testid"]}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {visible.map((opt) => (
        <option key={opt.code} value={opt.code} data-testid={`cat-${opt.code}`}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
