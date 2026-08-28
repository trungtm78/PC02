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
  /**
   * Chọn hàng loạt. Nhận DANH SÁCH mẫu đủ điều kiện do chính component này tính.
   *
   * Nút đặt ở đây chứ không ở modal, vì `effReady()` bên dưới — thứ quyết định mẫu nào tích được
   * — nằm ở đây. Đặt ở modal là phải chép `effReady` lần thứ hai, và hai bản sẽ lệch nhau ngay
   * lần sửa đầu. Không truyền hai hàm này thì component không hiện nút, nên modal xuất hàng loạt
   * giữ nguyên như cũ.
   */
  onSelectAll?: (keys: string[]) => void;
  onClearAll?: () => void;
}

export function ExportReadinessChecklist({
  templates, readiness, loading, selected, onToggle, fillValues, onFillChange, onSaveFill, saving, idPrefix,
  onSelectAll, onClearAll,
}: Props) {
  // Một field còn thiếu được coi là CHƯA thoả nếu: savable (phải lưu vào hồ sơ qua "Lưu bổ sung")
  // HOẶC non-savable nhưng chưa nhập giá trị (non-savable = manualValues, chỉ cần nhập tại popup).
  const unsatisfied = (m: ReadinessMissingField) => m.savable || !(fillValues[m.field]?.trim());
  // Mẫu "đủ để xuất": server bảo đủ, HOẶC mọi field còn thiếu đều đã thoả (non-savable đã nhập).
  const effReady = (item?: ReadinessItem) => {
    if (!item) return true;
    if (item.ready) return true;
    return item.missing.every((m) => !unsatisfied(m));
  };

  // Union field CHƯA thoả của các mẫu chưa đủ — dedup (vd lyDoChuyen / dùng chung).
  const missingFields = (() => {
    const seen = new Map<string, ReadinessMissingField>();
    for (const t of templates) {
      const item = readiness[t.key];
      if (!item || effReady(item)) continue;
      for (const m of item.missing) if (unsatisfied(m) && !seen.has(m.field)) seen.set(m.field, m);
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

  // Mẫu tích được = mẫu đủ điều kiện. Mẫu thiếu thông tin đang `disabled` nên "Chọn tất cả"
  // phải bỏ qua chúng, không thì nút Xuất mở khoá cho một mẫu chưa đủ dữ liệu.
  const khoaDuDieuKien = templates.filter((t) => effReady(readiness[t.key])).map((t) => t.key);

  return (
    <div>
      {onSelectAll && onClearAll && (
        <div className="mb-2 flex items-center gap-2">
          <button
            type="button"
            data-testid={`${idPrefix}-select-all`}
            onClick={() => onSelectAll(khoaDuDieuKien)}
            disabled={!khoaDuDieuKien.length}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Chọn tất cả
          </button>
          <button
            type="button"
            data-testid={`${idPrefix}-clear-all`}
            onClick={onClearAll}
            disabled={!selected.size}
            className="rounded border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Bỏ chọn tất cả
          </button>
        </div>
      )}
      <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
        {templates.map((t) => {
          const item = readiness[t.key];
          const ready = effReady(item);
          const missing = (item?.missing ?? []).filter(unsatisfied);
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
          {/* Chỉ hiện "Lưu bổ sung" khi có field SAVABLE (đơn thư: lưu vào hồ sơ). Dynamic toàn
              non-savable → nhập là đủ (manualValues khi xuất), không cần nút lưu. */}
          {missingFields.some((m) => m.savable) ? (
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
          ) : (
            <p className="mt-2 text-xs text-slate-500">Nhập xong, tích chọn mẫu rồi bấm "Xuất file".</p>
          )}
        </fieldset>
      )}
    </div>
  );
}
