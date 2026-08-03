import { useState } from "react";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { LEGACY_FIELD_LABELS } from "@/shared/legacy/legacyFieldLabels.generated";

/**
 * DynamicLegacyFields — trường hệ cũ dạng ĐỘNG, CHỈNH SỬA ĐƯỢC (như form động TruongTuyChinh).
 * Render 1 input cho MỖI field metadata (mọi field cũ đã chuyển vào metadata), nhãn tiếng
 * Việt từ catalog. Sửa → onChange(key, value); form gộp vào payload.metadata (backend MERGE).
 * Đảm bảo mọi field cũ đều có ô nhập tương ứng, không thiếu field nào.
 */

function isSystemKey(k: string): boolean {
  return (
    /_search$/.test(k) ||
    /^_/.test(k) ||
    ["da_xoa", "da_nhan", "don_vi_id", "nguoi_them", "__v", "add_time", "update_time", "id", "loai"].includes(k)
  );
}

function label(key: string): string {
  return LEGACY_FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

function toText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function DynamicLegacyFields({
  values,
  onChange,
}: {
  values: Record<string, unknown> | null | undefined;
  onChange: (key: string, value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (!values || typeof values !== "object") return null;

  // Field mảng/object (lich_su…) không sửa inline → chỉ hiện read-only trong panel; ở đây bỏ.
  const keys = Object.keys(values)
    .filter((k) => !isSystemKey(k) && !Array.isArray(values[k]) && typeof values[k] !== "object")
    .sort((a, b) => label(a).localeCompare(label(b), "vi"));

  if (!keys.length) return null;

  return (
    <div className="border border-blue-200 rounded-lg bg-blue-50/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-blue-800"
        data-testid="dynamic-legacy-toggle"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Pencil className="w-4 h-4" />
        Trường hệ cũ (chỉnh sửa được — {keys.length} trường)
      </button>
      {open && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4">
          {keys.map((k) => (
            <div key={k} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">{label(k)}</label>
              <input
                type="text"
                className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                value={toText(values[k])}
                onChange={(e) => onChange(k, e.target.value)}
                data-testid={`legacy-field-${k}`}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
