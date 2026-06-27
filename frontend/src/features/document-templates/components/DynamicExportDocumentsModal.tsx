import { useEffect, useMemo, useState } from 'react';
import { FileText, X, Loader2, AlertCircle } from 'lucide-react';
import { extractApiError } from '@/lib/api-errors';
import {
  exportEntityDocuments,
  listExportTemplates,
  triggerDownload,
  parseBlobError,
  type ExportEntity,
} from '../export.api';
import type { DocumentTemplate, TemplateVariable } from '../types';

/**
 * Popup "Xuất chứng từ" ĐỘNG cho 1 Vụ án (entity=cases) hoặc Vụ việc (entity=incidents).
 * Fetch mẫu active qua GET /:entity/export-templates (admin upload ở PR1), nhóm theo category,
 * mặc định tick hết → gộp 1 file Word (mặc định) hoặc ZIP. Gom biến `source==='manual'` của các
 * mẫu đang chọn thành form nhập tay → gửi manualValues.
 * Backend PR2: POST /:entity/:id/export-documents { templateIds, mode, manualValues }.
 */
interface Props {
  entity: ExportEntity;
  entityId: string;
  onClose: () => void;
}

export function DynamicExportDocumentsModal({ entity, entityId, onClose }: Props) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'merged' | 'zip'>('merged');
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    listExportTemplates(entity)
      .then((list) => {
        if (!alive) return;
        setTemplates(list);
        setSelected(new Set(list.map((t) => t.id)));
      })
      .catch(() => {
        if (alive) setLoadError('Không tải được danh sách mẫu chứng từ');
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [entity]);

  // Nhóm theo category, giữ thứ tự sortOrder của danh sách trả về.
  const grouped = useMemo(() => {
    const map = new Map<string, DocumentTemplate[]>();
    for (const t of templates) {
      const arr = map.get(t.category) ?? [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return [...map.entries()];
  }, [templates]);

  // Union các biến nhập tay của những mẫu ĐANG CHỌN (dedup theo name, ưu tiên label đầu).
  const manualVars = useMemo(() => {
    const seen = new Map<string, TemplateVariable>();
    for (const t of templates) {
      if (!selected.has(t.id)) continue;
      for (const v of t.variables ?? []) {
        if (v.source === 'manual' && !seen.has(v.name)) seen.set(v.name, v);
      }
    }
    return [...seen.values()];
  }, [templates, selected]);

  const allSelected = templates.length > 0 && selected.size === templates.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(templates.map((t) => t.id)));
  }

  async function handleExport() {
    if (selected.size === 0 || isExporting) return;
    setIsExporting(true);
    setErrorMsg(null);
    try {
      // Giữ thứ tự danh sách (sortOrder) khi lọc các mẫu đang chọn.
      const templateIds = templates.filter((t) => selected.has(t.id)).map((t) => t.id);
      // Chỉ gửi manualValues cho biến đang hiển thị (mẫu đang chọn).
      const values: Record<string, string> = {};
      for (const v of manualVars) values[v.name] = manualValues[v.name] ?? '';
      const response = await exportEntityDocuments(entity, entityId, {
        templateIds,
        mode,
        manualValues: values,
      });
      triggerDownload(response, mode);
      onClose();
    } catch (err) {
      const parsed = await parseBlobError(err);
      setErrorMsg(
        extractApiError(
          parsed,
          'Không xuất được chứng từ. Vui lòng kiểm tra các trường nghiệp vụ bắt buộc.',
        ).messages.join('. '),
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div
      data-testid="dynamic-export-modal"
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <FileText className="w-5 h-5 text-blue-600" />
            Xuất chứng từ
          </h2>
          <button
            type="button"
            data-testid="dyn-export-close-x"
            onClick={onClose}
            disabled={isExporting}
            className="p-1 rounded hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải danh sách mẫu...
          </div>
        ) : loadError ? (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{loadError}</span>
          </div>
        ) : templates.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500" data-testid="dyn-export-empty">
            Chưa có mẫu chứng từ cho loại hồ sơ này. Quản trị viên cần tải mẫu ở mục Cấu hình →
            Mẫu chứng từ.
          </p>
        ) : (
          <>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">Chọn mẫu chứng từ</span>
                <button
                  type="button"
                  data-testid="dyn-export-toggle-all"
                  onClick={toggleAll}
                  className="text-xs text-blue-700 hover:underline"
                >
                  {allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>
              <div className="space-y-3">
                {grouped.map(([category, items]) => (
                  <div key={category}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      {category}
                    </p>
                    <ul className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {items.map((t) => (
                        <li key={t.id}>
                          <label className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50">
                            <input
                              type="checkbox"
                              data-testid={`dyn-export-checkbox-${t.id}`}
                              checked={selected.has(t.id)}
                              onChange={() => toggle(t.id)}
                              className="mt-1 h-4 w-4 accent-blue-600"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-slate-800">{t.name}</span>
                              <span className="block text-xs text-slate-500">{t.code}</span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {manualVars.length > 0 && (
              <fieldset className="mt-4">
                <legend className="text-sm font-medium text-slate-700 mb-1">
                  Thông tin nhập tay
                </legend>
                <div className="space-y-2">
                  {manualVars.map((v) => (
                    <div key={v.name}>
                      <label className="block text-xs text-slate-600 mb-0.5">{v.label || v.name}</label>
                      <input
                        type="text"
                        data-testid={`dyn-manual-${v.name}`}
                        value={manualValues[v.name] ?? ''}
                        onChange={(e) =>
                          setManualValues((prev) => ({ ...prev, [v.name]: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            )}

            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-slate-700 mb-1">Định dạng xuất</legend>
              <label className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="dyn-export-mode"
                  data-testid="dyn-export-mode-merged"
                  checked={mode === 'merged'}
                  onChange={() => setMode('merged')}
                  className="accent-blue-600"
                />
                Gộp 1 file Word <span className="text-xs text-slate-500">(nhiều mẫu → 1 file, ngắt trang)</span>
              </label>
              <label className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="dyn-export-mode"
                  data-testid="dyn-export-mode-zip"
                  checked={mode === 'zip'}
                  onChange={() => setMode('zip')}
                  className="accent-blue-600"
                />
                Tách – file ZIP <span className="text-xs text-slate-500">(mỗi mẫu 1 file Word)</span>
              </label>
            </fieldset>

            {errorMsg && (
              <div
                data-testid="dyn-export-error"
                role="alert"
                className="mt-3 flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="mt-2 text-xs text-slate-500">
              Đã chọn {selected.size}/{templates.length} mẫu
            </div>
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            data-testid="dyn-export-close"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Đóng
          </button>
          <button
            type="button"
            data-testid="dyn-export-confirm"
            onClick={() => void handleExport()}
            disabled={selected.size === 0 || isExporting || isLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {isExporting ? 'Đang xuất...' : 'Xuất file'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DynamicExportDocumentsModal;
