import { useEffect, useState, useCallback, useRef } from 'react';
import { FileText, X, Loader2, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import {
  exportEntityDocuments,
  listExportTemplates,
  triggerDownload,
  parseBlobError,
  readinessPath,
  type ExportEntity,
} from '../export.api';
import type { DocumentTemplate } from '../types';
import { ExportReadinessChecklist, type ReadinessItem } from './ExportReadinessChecklist';

/**
 * Popup "Xuất chứng từ" ĐỘNG cho Vụ án/Vụ việc — ĐỒNG BỘ với Đơn thư (PR2):
 * mẫu thiếu thông tin (theo cờ `required` admin khai báo) → tự bỏ check + "Thiếu: X, Y" →
 * bổ sung NGAY trong popup → savable PUT vào hồ sơ / non-savable làm manualValues khi xuất.
 * Readiness: GET /:entity/:id/export-readiness.
 */
interface Props {
  entity: ExportEntity;
  entityId: string;
  onClose: () => void;
  /** Báo form cha refresh recordUpdatedAt + formData sau khi popup PUT bổ sung (tránh 409). */
  onEntityPatched?: (updatedAt: string | undefined, fields: Record<string, string>) => void;
}

interface ReadinessMissing { field: string; label: string; type: 'text' | 'textarea'; savable: boolean; column?: string }

/** separate = nhiều file .docx rời (mặc định) · merged = gộp 1 file · zip = 1 file nén */
type ExportMode = 'separate' | 'merged' | 'zip';

/** Chờ giữa 2 lần tải để trình duyệt không chặn "tải nhiều file". */
const DOWNLOAD_GAP_MS = 300;

export function DynamicExportDocumentsModal({ entity, entityId, onClose, onEntityPatched }: Props) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [readiness, setReadiness] = useState<Record<string, ReadinessItem>>({});
  const [recordUpdatedAt, setRecordUpdatedAt] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fillValues, setFillValues] = useState<Record<string, string>>({});
  const [savingFill, setSavingFill] = useState(false);
  // 'separate' = tải về NHIỀU FILE WORD RỜI (mặc định) — gọi API từng mẫu, mỗi
  // mẫu 1 .docx; KHÔNG phải .zip nên không cần giải nén.
  const [mode, setMode] = useState<ExportMode>('separate');
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const prevReadyRef = useRef<Set<string>>(new Set());
  // map field → {savable, column} để onSaveFill tách PUT vs manualValues.
  const fieldMetaRef = useRef<Record<string, ReadinessMissing>>({});

  const fetchReadiness = useCallback(async (preserve = false) => {
    const res = await api.get(readinessPath(entity, entityId));
    const data = (res?.data as { data?: { items?: Array<{ templateId: string; ready: boolean; missing: ReadinessMissing[] }>; updatedAt?: string } } | undefined)?.data
      ?? (res?.data as { items?: Array<{ templateId: string; ready: boolean; missing: ReadinessMissing[] }>; updatedAt?: string } | undefined);
    const map: Record<string, ReadinessItem> = {};
    const readyKeys: string[] = [];
    for (const it of data?.items ?? []) {
      map[it.templateId] = { key: it.templateId, ready: it.ready, missing: it.missing };
      if (it.ready) readyKeys.push(it.templateId);
      for (const m of it.missing) fieldMetaRef.current[m.field] = m;
    }
    setReadiness(map);
    if (data?.updatedAt) setRecordUpdatedAt(data.updatedAt);
    const prevReady = prevReadyRef.current;
    setSelected((prev) => {
      if (!preserve) return new Set(readyKeys);
      const newlyReady = readyKeys.filter((k) => !prevReady.has(k));
      const next = new Set([...prev].filter((k) => readyKeys.includes(k)));
      newlyReady.forEach((k) => next.add(k));
      return next;
    });
    prevReadyRef.current = new Set(readyKeys);
  }, [entity, entityId]);

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    Promise.all([listExportTemplates(entity), fetchReadiness(false)])
      .then(([list]) => { if (alive) setTemplates(list); })
      .catch(() => { if (alive) setLoadError('Không tải được danh sách mẫu chứng từ'); })
      .finally(() => { if (alive) setIsLoading(false); });
    return () => { alive = false; };
  }, [entity, fetchReadiness]);

  const toggle = (id: string) =>
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Lưu bổ sung: savable → PUT cột vào hồ sơ; non-savable → giữ trong fillValues (manualValues khi xuất).
  async function handleSaveFill() {
    if (savingFill) return;
    const putPayload: Record<string, string> = {};
    for (const [field, value] of Object.entries(fillValues)) {
      if (!value || !value.trim()) continue;
      const meta = fieldMetaRef.current[field];
      if (meta?.savable && meta.column) putPayload[meta.column] = value;
    }
    if (Object.keys(putPayload).length === 0) {
      // Không có field savable nào để lưu — non-savable đã đủ để xuất (manualValues). Refresh để cập nhật.
      await fetchReadiness(true);
      return;
    }
    setSavingFill(true);
    setErrorMsg(null);
    try {
      const res = await api.put(`/${entity}/${entityId}`, { ...putPayload, expectedUpdatedAt: recordUpdatedAt });
      const newUpdatedAt = (res?.data as { data?: { updatedAt?: string } } | undefined)?.data?.updatedAt;
      if (newUpdatedAt) setRecordUpdatedAt(newUpdatedAt);
      onEntityPatched?.(newUpdatedAt, putPayload);
      // Bỏ field savable đã lưu khỏi fillValues (đã persist); giữ non-savable cho manualValues.
      setFillValues((prev) => {
        const next = { ...prev };
        for (const field of Object.keys(prev)) {
          const meta = fieldMetaRef.current[field];
          if (meta?.savable) delete next[field];
        }
        return next;
      });
      await fetchReadiness(true);
    } catch (err) {
      setErrorMsg(extractApiError(err, 'Không lưu được thông tin bổ sung.').messages.join('. '));
    } finally {
      setSavingFill(false);
    }
  }

  async function describeError(err: unknown, fallback: string): Promise<string> {
    const parsed = await parseBlobError(err);
    return extractApiError(parsed, fallback).messages.join('. ');
  }

  /**
   * Tách thành NHIỀU FILE WORD RỜI: gọi API lần lượt từng mẫu (mỗi request trả
   * đúng 1 .docx) rồi tải về từng file. Một mẫu lỗi KHÔNG chặn các mẫu còn lại —
   * báo rõ mẫu nào hỏng thay vì im lặng.
   */
  async function exportSeparateFiles(picked: DocumentTemplate[]): Promise<void> {
    const failed: string[] = [];
    for (let i = 0; i < picked.length; i++) {
      const t = picked[i];
      try {
        const response = await exportEntityDocuments(entity, entityId, {
          templateIds: [t.id],
          mode: 'merged', // 1 mẫu → server trả đúng 1 file .docx
          manualValues: fillValues,
        });
        triggerDownload(response, 'merged');
      } catch (err) {
        failed.push(`${t.name}: ${await describeError(err, 'lỗi không xác định')}`);
      }
      setProgress({ done: i + 1, total: picked.length });
      if (i < picked.length - 1) await new Promise((r) => setTimeout(r, DOWNLOAD_GAP_MS));
    }
    if (failed.length) {
      throw new Error(`Không xuất được ${failed.length}/${picked.length} mẫu — ${failed.join(' | ')}`);
    }
  }

  async function handleExport() {
    if (selected.size === 0 || isExporting) return;
    setIsExporting(true);
    setErrorMsg(null);
    setProgress(null);
    try {
      const picked = templates.filter((t) => selected.has(t.id));
      if (mode === 'separate') {
        await exportSeparateFiles(picked);
      } else {
        const response = await exportEntityDocuments(entity, entityId, {
          templateIds: picked.map((t) => t.id),
          mode,
          manualValues: fillValues,
        });
        triggerDownload(response, mode);
      }
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message.startsWith('Không xuất được')
          ? err.message
          : await describeError(err, 'Không xuất được chứng từ. Vui lòng kiểm tra các trường nghiệp vụ bắt buộc.'),
      );
    } finally {
      setIsExporting(false);
      setProgress(null);
    }
  }

  const displayTemplates = templates.map((t) => ({ key: t.id, label: t.name, description: `${t.category} · ${t.code}` }));

  return (
    <div data-testid="dynamic-export-modal" role="dialog" aria-modal="true" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <FileText className="w-5 h-5 text-blue-600" /> Xuất chứng từ
          </h2>
          <button type="button" data-testid="dyn-export-close-x" onClick={onClose} disabled={isExporting} className="p-1 rounded hover:bg-slate-100" aria-label="Đóng">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadError ? (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{loadError}</span>
          </div>
        ) : !isLoading && templates.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500" data-testid="dyn-export-empty">
            Chưa có mẫu chứng từ cho loại hồ sơ này. Quản trị viên cần tải mẫu ở mục Cấu hình → Mẫu chứng từ.
          </p>
        ) : (
          <>
            <div className="mt-4">
              <span className="text-sm font-medium text-slate-700 mb-2 block">Chọn mẫu chứng từ (mẫu thiếu thông tin sẽ bị khoá — bổ sung bên dưới)</span>
              <ExportReadinessChecklist
                templates={displayTemplates}
                readiness={readiness}
                loading={isLoading}
                selected={selected}
                onToggle={toggle}
                fillValues={fillValues}
                onFillChange={(field, value) => setFillValues((p) => ({ ...p, [field]: value }))}
                onSaveFill={() => void handleSaveFill()}
                saving={savingFill}
                idPrefix="dyn-export"
              />
            </div>

            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-slate-700 mb-1">Định dạng xuất</legend>
              <label className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                <input type="radio" name="dyn-export-mode" data-testid="dyn-export-mode-separate" checked={mode === 'separate'} onChange={() => setMode('separate')} className="accent-blue-600" />
                Tách từng file Word rời <span className="text-xs text-slate-500">(mỗi mẫu 1 file .docx, không cần giải nén)</span>
              </label>
              <label className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                <input type="radio" name="dyn-export-mode" data-testid="dyn-export-mode-merged" checked={mode === 'merged'} onChange={() => setMode('merged')} className="accent-blue-600" />
                Gộp 1 file Word <span className="text-xs text-slate-500">(nhiều mẫu → 1 file, ngắt trang)</span>
              </label>
              <label className="flex items-center gap-2 py-1 cursor-pointer text-sm">
                <input type="radio" name="dyn-export-mode" data-testid="dyn-export-mode-zip" checked={mode === 'zip'} onChange={() => setMode('zip')} className="accent-blue-600" />
                Tải về 1 file nén .zip <span className="text-xs text-slate-500">(tiện khi chọn nhiều mẫu)</span>
              </label>
            </fieldset>

            {progress && (
              <div data-testid="dyn-export-progress" className="mt-2 text-xs text-slate-600">
                Đang tải {progress.done}/{progress.total} file…
              </div>
            )}

            {errorMsg && (
              <div data-testid="dyn-export-error" role="alert" className="mt-3 flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{errorMsg}</span>
              </div>
            )}

            <div className="mt-2 text-xs text-slate-500">Đã chọn {selected.size}/{templates.length} mẫu</div>
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" data-testid="dyn-export-close" onClick={onClose} disabled={isExporting} className="px-4 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Đóng
          </button>
          <button type="button" data-testid="dyn-export-confirm" onClick={() => void handleExport()} disabled={selected.size === 0 || isExporting || isLoading} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            {isExporting ? 'Đang xuất...' : 'Xuất file'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DynamicExportDocumentsModal;
