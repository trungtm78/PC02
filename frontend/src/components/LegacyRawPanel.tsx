import { useState } from "react";
import { ChevronDown, ChevronRight, Database } from "lucide-react";
import { LEGACY_FIELD_LABELS } from "@/shared/legacy/legacyFieldLabels.generated";

/**
 * Panel "Dữ liệu gốc hệ cũ (tham khảo)" — hiển thị ĐẦY ĐỦ mọi field từ legacyRaw,
 * nhãn tiếng Việt từ catalog TruongTuyChinh. Chỉ đọc. Đảm bảo KHÔNG field nào của
 * hệ cũ bị ẩn (yêu cầu pháp lý: không sót field nào).
 */

// Key hệ thống / tìm kiếm — không hiển thị (không phải dữ liệu nghiệp vụ).
function isSystemKey(k: string): boolean {
  return (
    /_search$/.test(k) ||
    /^_/.test(k) ||
    ["da_xoa", "da_nhan", "don_vi_id", "nguoi_them", "__v", "add_time", "update_time",
      "loai", "id"].includes(k)
  );
}

function label(key: string): string {
  return LEGACY_FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

// Field ngày hệ cũ (ngay_*, thời hạn, hết thời hiệu) lưu Unix timestamp (giây).
const DATE_KEY = /(^|_)ngay|thoi_han|het_thoi_hieu|thoi_gian_het/i;

/**
 * Định dạng Unix timestamp (giây) hệ cũ → dd/mm/yyyy, KHỚP parseLegacyDate backend:
 * cộng bù +50400s (14h) vì PHP cũ trừ offset +7h HAI LẦN, rồi lấy ngày theo UTC.
 * Dải rộng 1990-2060 (panel tham khảo — rộng hơn cột typed 2000-2050). Ngoài dải → null.
 */
function formatLegacyUnixDate(v: number): string | null {
  if (!Number.isFinite(v) || v < 631152000 || v > 2840140800) return null;
  const d = new Date((v + 50400) * 1000);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

function renderValue(key: string, v: unknown): string {
  if (v == null) return "";
  // Field ngày: timestamp (number hoặc chuỗi toàn số 9-10 chữ số) → dd/mm/yyyy.
  if (DATE_KEY.test(key)) {
    const num = typeof v === "number" ? v : typeof v === "string" && /^\d{9,10}$/.test(v.trim()) ? Number(v) : NaN;
    const formatted = formatLegacyUnixDate(num);
    if (formatted) return formatted;
  }
  if (Array.isArray(v)) {
    // vd lich_su (mảng object) — nén gọn thành chuỗi đọc được
    return v
      .map((it) =>
        it && typeof it === "object" ? Object.values(it as Record<string, unknown>).filter(Boolean).join(" - ") : String(it),
      )
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function LegacyRawPanel({ raw }: { raw?: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);
  if (!raw || typeof raw !== "object") return null;

  const entries = Object.entries(raw)
    .filter(([k, v]) => !isSystemKey(k) && renderValue(k, v).trim() !== "")
    .sort((a, b) => label(a[0]).localeCompare(label(b[0]), "vi"));

  if (!entries.length) return null;

  return (
    <div className="mt-4 border border-amber-200 rounded-lg bg-amber-50/50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-amber-800"
        data-testid="legacy-raw-toggle"
      >
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <Database className="w-4 h-4" />
        Dữ liệu gốc hệ cũ (tham khảo — {entries.length} trường, chỉ đọc)
      </button>
      {open && (
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 px-4 pb-4 text-sm">
          {entries.map(([k, v]) => (
            <div key={k} className="flex flex-col border-b border-amber-100 pb-1">
              <dt className="text-slate-500 text-xs">{label(k)}</dt>
              <dd className="text-slate-800 whitespace-pre-wrap break-words">{renderValue(k, v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
