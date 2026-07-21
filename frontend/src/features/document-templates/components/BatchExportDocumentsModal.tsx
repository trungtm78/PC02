import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { listExportTemplates, type ExportEntity } from '../export.api';
import type { DocumentTemplate } from '../types';

/**
 * Chọn mẫu chứng từ để xuất Word cho NHIỀU hồ sơ đã tích → 1 file ZIP.
 *
 * KHÁC `DynamicExportDocumentsModal` (1 hồ sơ) ở chỗ CỐ Ý bỏ khối "bổ sung trường thiếu":
 * khối đó gắn chặt vào 1 record (PUT /:entity/:id kèm expectedUpdatedAt), và mỗi hồ sơ
 * thiếu trường khác nhau — áp một giá trị nhập tay cho N hồ sơ là IN SAI DỮ LIỆU.
 * Hồ sơ thiếu trường được báo qua manifest.json trong ZIP.
 *
 * Trần số file do backend đặt (N×M ≤ 100); modal kiểm trước để người dùng thấy thông báo
 * dễ hiểu thay vì lỗi 400 thô.
 */
const MAX_BATCH_FILES = 100;

interface Props {
  entity: ExportEntity;
  /** Ids đã CHỤP tại thời điểm mở modal — thanh bulk xoá selection ngay sau đó. */
  entityIds: string[];
  onClose: () => void;
  onConfirm: (ids: string[], codes: string[]) => void | Promise<void>;
}

export function BatchExportDocumentsModal({ entity, entityIds, onClose, onConfirm }: Props) {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    listExportTemplates(entity)
      .then((list) => {
        if (alive) setTemplates(list);
      })
      .catch(() => {
        if (alive) setError('Không tải được danh sách mẫu chứng từ.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [entity]);

  const codes = useMemo(
    () => templates.filter((t) => selected.has(t.id)).map((t) => t.code),
    [templates, selected],
  );
  const fileCount = entityIds.length * codes.length;
  const overLimit = fileCount > MAX_BATCH_FILES;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleConfirm = async () => {
    if (!codes.length || overLimit || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm(entityIds, codes);
      onClose();
    } catch {
      setError('Xuất file thất bại. Kiểm tra kết nối và thử lại.');
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Xuất Word cho ${entityIds.length} hồ sơ`}>
      <div className="space-y-4">
        {loading && <div className="text-sm text-slate-500">Đang tải mẫu chứng từ…</div>}

        {!loading && templates.length === 0 && (
          <div className="text-sm text-slate-500">Chưa có mẫu chứng từ nào cho loại hồ sơ này.</div>
        )}

        {!loading && templates.length > 0 && (
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
            {templates.map((t) => (
              <label
                key={t.id}
                className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  data-testid={`batch-export-checkbox-${t.id}`}
                  checked={selected.has(t.id)}
                  onChange={() => toggle(t.id)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="min-w-0">
                  <span className="block text-sm text-slate-800">{t.name}</span>
                  {t.category && <span className="block text-xs text-slate-500">{t.category}</span>}
                </span>
              </label>
            ))}
          </div>
        )}

        {codes.length > 0 && (
          <div
            data-testid="batch-export-summary"
            className={`rounded-md px-3 py-2 text-sm ${
              overLimit
                ? 'border border-red-200 bg-red-50 text-red-800'
                : 'bg-slate-50 text-slate-700'
            }`}
          >
            {overLimit ? (
              <>
                Lô quá lớn: {entityIds.length} hồ sơ × {codes.length} mẫu ={' '}
                <strong>{fileCount} file</strong> (tối đa {MAX_BATCH_FILES}). Vui lòng bớt hồ sơ
                hoặc bớt mẫu.
              </>
            ) : (
              <>
                Sẽ xuất <strong>{fileCount} file</strong> ({entityIds.length} hồ sơ ×{' '}
                {codes.length} mẫu) trong 1 file ZIP.
              </>
            )}
          </div>
        )}

        {error && (
          <div data-testid="batch-export-error" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            data-testid="batch-export-confirm"
            onClick={handleConfirm}
            disabled={!codes.length || overLimit || submitting}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Đang xuất…' : 'Xuất file'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
