import { useCatalog } from "@/hooks/useCatalog";
import { CATALOG_META } from "@/shared/catalog/catalog.generated";

const META = CATALOG_META as Record<
  string,
  { kind: string; multi: boolean; cascade?: { parentKey: string; map: Record<string, string[]> } }
>;

interface CatalogSelectProps {
  catalogKey: string;
  value: string | string[];
  onChange: (next: string | string[]) => void;
  multi?: boolean;
  /** Giá trị field cha — dùng lọc cascading (vd LoaiNguonTin → NguonPhatTin). */
  parentValue?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
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
  multi = false,
  parentValue,
  disabled,
  className,
  placeholder = "-- Chọn --",
  ...rest
}: CatalogSelectProps) {
  const { options } = useCatalog(catalogKey);
  const cascade = META[catalogKey]?.cascade;
  const allowed = cascade && parentValue ? cascade.map[parentValue] ?? [] : null;
  const visible = allowed ? options.filter((o) => allowed.includes(o.code)) : options;

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
