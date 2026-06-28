// Component CHUNG cho popup "In chứng từ" (đồng bộ Đơn thư + Vụ việc + Vụ án):
// - Mỗi mẫu THIẾU thông tin → tự bỏ check + disable + hiện "Thiếu: X, Y".
// - Khối "Bổ sung thông tin còn thiếu": union field thiếu (dedup) → ô nhập (text/textarea).
// - Nút "Lưu bổ sung" → cha PUT vào hồ sơ + re-fetch readiness → mẫu đủ tự enable.
import { Loader2, AlertCircle } from "lucide-react";

export interface ReadinessMissingField {
  field: string;
  label: string;
  type: "text" | "textarea";
  savable: boolean;
}
export interface ReadinessItem {
  /** khoá mẫu = docType (đơn thư) hoặc template.id (vụ việc/vụ án). */
  key: string;
  ready: boolean;
  missing: ReadinessMissingField[];
}
export interface TemplateDisplay {
  key: string;
  label: string;
  description?: string;
}

interface Props {
  templates: TemplateDisplay[];
  readiness: Record<string, ReadinessItem>;
  loading: boolean;
  selected: Set<string>;
  onToggle: (key: string) => void;
  fillValues: Record<string, string>;
  onFillChange: (field: string, value: string) => void;
  onSaveFill: () => void;
  saving: boolean;
  /** testid prefix để 2 modal không trùng (vd "export-doc", "dyn-export"). */
  idPrefix: string;
}

export function ExportReadinessChecklist({
  templates, readiness, loading, selected, onToggle, fillValues, onFillChange, onSaveFill, saving, idPrefix,
}: Props) {
  // Union field còn thiếu của các mẫu CHƯA đủ — dedup theo field (vd lyDoChuyen dùng chung).
  const missingFields = (() => {
    const seen = new Map<string, ReadinessMissingField>();
    for (const t of templates) {
      const item = readiness[t.key];
      if (!item || item.ready) continue;
      for (const m of item.missing) if (!seen.has(m.field)) seen.set(m.field, m);
    }
    return [...seen.values()];
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-500" data-testid={`${idPrefix}-readiness-loading`}>
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Đang kiểm tra thông tin...
      </div>
    );
  }

  return (
    <div>
      <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
        {templates.map((t) => {
          const item = readiness[t.key];
          const ready = item ? item.ready : true;
          const missing = item?.missing ?? [];
          return (
            <li key={t.key}>
              <label className={`flex items-start gap-3 px-3 py-2.5 ${ready ? "cursor-pointer hover:bg-amber-50" : "opacity-70 hover:bg-red-50 cursor-not-allowed"}`}>
                <input
                  type="checkbox"
                  data-testid={`${idPrefix}-checkbox-${t.key}`}
                  disabled={!ready}
                  checked={ready && selected.has(t.key)}
                  onChange={() => ready && onToggle(t.key)}
                  className="mt-1 h-4 w-4 accent-amber-600"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-slate-800">{t.label}</span>
                  {t.description && <span className="block text-xs text-slate-500">{t.description}</span>}
                  {!ready && (
                    <span className="mt-1 flex items-start gap-1 text-xs text-red-600 font-medium" data-testid={`${idPrefix}-missing-${t.key}`}>
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      Thiếu: {missing.map((m) => m.label).join(", ")}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      {missingFields.length > 0 && (
        <fieldset className="mt-4 p-3 border border-amber-200 bg-amber-50 rounded-lg" data-testid={`${idPrefix}-fill`}>
          <legend className="text-sm font-medium text-amber-800 px-1">Bổ sung thông tin còn thiếu</legend>
          <p className="text-xs text-slate-600 mb-2">Nhập các trường dưới đây rồi bấm "Lưu bổ sung" để mẫu được mở lại.</p>
          <div className="space-y-2">
            {missingFields.map((m) => (
              <div key={m.field}>
                <label className="block text-xs font-medium text-slate-700 mb-0.5">{m.label}</label>
                {m.type === "textarea" ? (
                  <textarea
                    rows={2}
                    data-testid={`${idPrefix}-fill-${m.field}`}
                    value={fillValues[m.field] ?? ""}
                    onChange={(e) => onFillChange(m.field, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                ) : (
                  <input
                    type="text"
                    data-testid={`${idPrefix}-fill-${m.field}`}
                    value={fillValues[m.field] ?? ""}
                    onChange={(e) => onFillChange(m.field, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            data-testid={`${idPrefix}-save-fill`}
            onClick={onSaveFill}
            disabled={saving}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? "Đang lưu..." : "Lưu bổ sung"}
          </button>
        </fieldset>
      )}
    </div>
  );
}
