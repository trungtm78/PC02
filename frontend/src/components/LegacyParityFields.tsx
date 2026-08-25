import { useState } from "react";
import { ChevronDown, ChevronRight, Database } from "lucide-react";
import { LEGACY_PARITY_FIELDS, type ParityFieldDef } from "@/shared/legacy/legacyParityFields.generated";
import { inMainForm } from "@/shared/legacy/shownFieldKeys";
import { LEGACY_FORM_OWNED_COLUMNS } from "@/features/cases/legacy-form-layout.def";

/**
 * LegacyParityFields — ô nhập CHÍNH THỨC cho các CỘT typed field-parity (di trú hệ cũ).
 * Khác DynamicLegacyFields (ghi vào metadata JSON), component này đọc/ghi CỘT typed thật
 * của thực thể (queryable, đúng kiểu). Mỗi field cũ có data → 1 ô nhập đúng kiểu.
 *
 * values = giá trị cột hiện tại; onChange(col, value) → form gộp vào payload top-level.
 */

function dateInputValue(v: unknown): string {
  if (!v) return "";
  const s = String(v);
  // ISO (2021-03-15T00:00:00.000Z) → YYYY-MM-DD cho <input type=date>
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

export function LegacyParityFields({
  entity,
  values,
  onChange,
}: {
  entity: "petition" | "incident" | "case";
  values: Record<string, unknown>;
  onChange: (col: string, value: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  // Bỏ cột đã có ô ở FORM CHÍNH → không hiện 2 ô.
  //
  // Với Vụ án, nguồn đối chiếu là ĐẶC TẢ BỐ CỤC (`LEGACY_FORM_OWNED_COLUMNS`) chứ không phải
  // `shownFieldKeys.ts` — tệp ấy gắn nhãn sinh tự động nhưng không còn công cụ sinh, nên nó
  // đứng yên trong khi form đổi. Từ 26/08/2026 form Vụ án dựng theo đặc tả, và đặc tả tự
  // biết mình đang sở hữu cột nào.
  //
  // Vì sao không phải chuyện thẩm mỹ: giá trị panel này được gộp vào payload SAU giá trị
  // form, nên hai ô cùng ghi một cột thì panel THẮNG — cán bộ gõ trong tab, bấm Lưu, giá
  // trị bị thay bằng thứ panel đang giữ.
  //
  // Đơn thư và Vụ việc chưa dựng theo đặc tả nên vẫn dùng đường cũ.
  const defs: ParityFieldDef[] = (LEGACY_PARITY_FIELDS[entity] ?? []).filter((d) =>
    entity === "case" ? !LEGACY_FORM_OWNED_COLUMNS.has(d.col) : !inMainForm(entity, d.col),
  );
  if (!defs.length) return null;

  const renderInput = (d: ParityFieldDef) => {
    const v = values[d.col];
    const base =
      "border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400";
    if (d.kind === "checkbox") {
      return (
        <input
          type="checkbox"
          className="w-4 h-4 mt-1"
          checked={v === true}
          onChange={(e) => onChange(d.col, e.target.checked)}
          data-testid={`parity-field-${d.col}`}
        />
      );
    }
    if (d.kind === "date") {
      return (
        <input
          type="date"
          className={base}
          value={dateInputValue(v)}
          onChange={(e) => onChange(d.col, e.target.value || undefined)}
          data-testid={`parity-field-${d.col}`}
        />
      );
    }
    if (d.kind === "number") {
      return (
        <input
          type="number"
          className={base}
          value={v == null ? "" : String(v)}
          onChange={(e) => onChange(d.col, e.target.value === "" ? undefined : Number(e.target.value))}
          data-testid={`parity-field-${d.col}`}
        />
      );
    }
    return (
      <input
        type="text"
        className={base}
        value={v == null ? "" : String(v)}
        onChange={(e) => onChange(d.col, e.target.value || undefined)}
        data-testid={`parity-field-${d.col}`}
      />
    );
  };

  return (
    <div className="border border-emerald-200 rounded-lg bg-emerald-50/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-emerald-800"
        data-testid="parity-fields-toggle"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Database className="w-4 h-4" />
        Thông tin nghiệp vụ bổ sung (di trú hệ cũ — {defs.length} trường)
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4">
          {defs.map((d) => (
            <div key={d.col} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">{d.label}</label>
              {renderInput(d)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
