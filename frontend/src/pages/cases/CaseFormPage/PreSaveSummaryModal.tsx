/**
 * PR 3 v0.38.2.0 — Pre-save Summary Modal
 *
 * Hiển thị trước khi POST /cases. User thấy rõ "tôi sắp lưu CÁI GÌ":
 *   - Mã hồ sơ + ngày tiếp nhận + vụ việc liên kết
 *   - Số bị can + bị hại + vật chứng + hồ sơ kèm theo
 *   - Banner thông báo data sẽ đi vào module nào
 *
 * Plan ref: Wireframe 3 — anh đã approve.
 *
 * UX: backdrop KHÔNG đóng modal (chống mất dữ liệu accidental click outside).
 * Esc behave như "Quay lại sửa".
 */

import { useEffect } from 'react';
import { X, CheckCircle2, Loader2, FileText } from 'lucide-react';
import type { CaseFormData, Subject, Evidence, MediaFile } from './types';

interface PreSaveSummaryModalProps {
  open: boolean;
  formData: CaseFormData;
  subjects: Subject[];
  evidences: Evidence[];
  mediaFiles: MediaFile[];
  linkedIncidentCode?: string;
  linkedIncidentName?: string;
  isSaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PreSaveSummaryModal({
  open,
  formData,
  subjects,
  evidences,
  mediaFiles,
  linkedIncidentCode,
  linkedIncidentName,
  isSaving,
  onConfirm,
  onCancel,
}: PreSaveSummaryModalProps) {
  // Esc to cancel (only if not saving)
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, isSaving, onCancel]);

  if (!open) return null;

  const suspects = subjects.filter((s) => s.type === 'Bị can');
  const victims = subjects.filter((s) => s.type === 'Bị hại');
  const witnesses = subjects.filter((s) => s.type === 'Nhân chứng');
  const lawyers = subjects.filter((s) => s.type === 'Luật sư');

  const totalFiles = mediaFiles.length;
  const totalFileSize = mediaFiles.reduce((sum, f) => sum + (parseFloat(f.size) || 0), 0);

  return (
    <div
      data-testid="pre-save-summary-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pre-save-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="pre-save-modal-title" className="text-xl font-semibold text-slate-900">
            Xác nhận lưu vụ án
          </h2>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="text-slate-400 hover:text-slate-600 disabled:opacity-50"
            data-testid="pre-save-close-btn"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <section>
            <h3 className="text-sm font-medium text-slate-500 mb-2">📋 Vụ án sắp được tạo:</h3>
            <dl className="space-y-1 text-sm">
              {formData.caseCode && (
                <div className="flex gap-2">
                  <dt className="text-slate-500 min-w-[130px]">Mã hồ sơ:</dt>
                  <dd className="text-slate-900 font-medium" data-testid="summary-case-code">
                    {formData.caseCode}
                  </dd>
                </div>
              )}
              {formData.receiveDate && (
                <div className="flex gap-2">
                  <dt className="text-slate-500 min-w-[130px]">Ngày tiếp nhận:</dt>
                  <dd className="text-slate-900">{formData.receiveDate}</dd>
                </div>
              )}
              {formData.caseTitle && (
                <div className="flex gap-2">
                  <dt className="text-slate-500 min-w-[130px]">Tên vụ án:</dt>
                  <dd className="text-slate-900">{formData.caseTitle}</dd>
                </div>
              )}
              {linkedIncidentCode && (
                <div className="flex gap-2">
                  <dt className="text-slate-500 min-w-[130px]">Vụ việc liên kết:</dt>
                  <dd className="text-slate-900" data-testid="summary-linked-incident">
                    {linkedIncidentCode}
                    {linkedIncidentName ? ` — ${linkedIncidentName}` : ''}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section>
            <h3 className="text-sm font-medium text-slate-500 mb-2">📌 Dữ liệu kèm theo (sẽ lưu vào DB):</h3>
            <ul className="space-y-2 text-sm">
              {suspects.length > 0 && (
                <li data-testid="summary-suspects">
                  <span className="text-slate-700">👥 Bị can: <strong>{suspects.length} người</strong></span>
                  <p className="text-slate-500 text-xs ml-7 truncate">
                    └─ {suspects.map((s) => s.name).join(', ')}
                  </p>
                </li>
              )}
              {victims.length > 0 && (
                <li data-testid="summary-victims">
                  <span className="text-slate-700">👤 Bị hại: <strong>{victims.length} người</strong></span>
                  <p className="text-slate-500 text-xs ml-7 truncate">
                    └─ {victims.map((s) => s.name).join(', ')}
                  </p>
                </li>
              )}
              {witnesses.length > 0 && (
                <li>
                  <span className="text-slate-700">🗣️ Nhân chứng: <strong>{witnesses.length} người</strong></span>
                </li>
              )}
              {lawyers.length > 0 && (
                <li>
                  <span className="text-slate-700">⚖️ Luật sư: <strong>{lawyers.length} người</strong></span>
                </li>
              )}
              {evidences.length > 0 && (
                <li data-testid="summary-evidences">
                  <span className="text-slate-700">🔪 Vật chứng: <strong>{evidences.length} món</strong></span>
                  <p className="text-slate-500 text-xs ml-7 truncate">
                    └─ {evidences.map((e) => e.name).join(', ')}
                  </p>
                </li>
              )}
              {totalFiles > 0 && (
                <li data-testid="summary-files">
                  <FileText className="w-4 h-4 inline mr-1 -mt-0.5" />
                  <span className="text-slate-700">
                    Hồ sơ đính kèm: <strong>{totalFiles} file</strong>
                    {totalFileSize > 0 ? ` (~${totalFileSize.toFixed(1)} MB)` : ''}
                  </span>
                </li>
              )}
              {suspects.length + victims.length + witnesses.length + lawyers.length + evidences.length + totalFiles === 0 && (
                <li className="text-slate-500 italic">Chưa có dữ liệu phụ — chỉ lưu thông tin chính</li>
              )}
            </ul>
          </section>

          {(suspects.length > 0 || victims.length > 0 || evidences.length > 0) && (
            <div className="bg-green-50 border border-green-200 rounded-md px-4 py-3 text-sm text-green-900">
              <CheckCircle2 className="w-4 h-4 inline mr-1 -mt-0.5" />
              Sau khi lưu, bị can + vật chứng sẽ hiển thị trong module
              <strong> Đối tượng</strong> / <strong>Vật chứng</strong> tương ứng.
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-sm font-medium disabled:opacity-50"
            data-testid="pre-save-cancel-btn"
          >
            Quay lại sửa
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="pre-save-confirm-btn"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Xác nhận lưu
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
