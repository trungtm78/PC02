/**
 * S02/S03 — Tải mẫu Excel + chọn sheet + xem trước (spec §6.1 PR4).
 *
 * Scope decision for this slice: a real, usable upload→sheet-pick→preview
 * flow against the two endpoints PR4 slice 2 shipped, but NOT the full
 * pixel-faithful Excel-like grid (GridRenderer) — that is explicitly
 * shared infrastructure for several later screens (S04 preview, S11/S15
 * input grids) and deserves its own dedicated slice once its real
 * rendering needs are concrete. Here, "preview" means a summary: field/
 * formula/issue counts + a scrollable issue list, which is already
 * everything the author needs to judge "does my upload look reasonable"
 * before any further wizard step is built.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { SheetInfo, TemplatePreviewResult } from '@/features/dynamic-reports/types';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';

const MAX_SELECTED_SHEETS = 5;

type Step = 'upload' | 'sheets' | 'preview';

export default function ReportTemplateUploadPage() {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [preview, setPreview] = useState<TemplatePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(f: File | null) {
    setError(null);
    setPreview(null);
    setFile(f);
    setSelectedSheets([]);
    if (!f) {
      setStep('upload');
      return;
    }
    setLoading(true);
    try {
      const result = await dynamicReportsApi.listTemplateSheets(f);
      setSheets(result);
      setStep('sheets');
    } catch (err) {
      setError(extractApiError(err).message);
      setStep('upload');
    } finally {
      setLoading(false);
    }
  }

  function toggleSheet(name: string) {
    setSelectedSheets((prev) => {
      if (prev.includes(name)) return prev.filter((s) => s !== name);
      if (prev.length >= MAX_SELECTED_SHEETS) return prev;
      return [...prev, name];
    });
  }

  async function handlePreview() {
    if (!file || selectedSheets.length === 0) return;
    setError(null);
    setLoading(true);
    try {
      const result = await dynamicReportsApi.previewTemplate(file, selectedSheets);
      setPreview(result);
      setStep('preview');
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6" data-testid="report-template-upload-page">
      <Link
        to="/bao-cao-dong/thiet-lap"
        className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách báo cáo
      </Link>

      <h1 className="text-xl font-bold text-slate-800 mb-1">Tạo báo cáo mới — Tải mẫu Excel</h1>
      <p className="text-sm text-slate-500 mb-6">
        Bước 1/4: tải file Excel mẫu và chọn sheet dùng làm báo cáo.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">File Excel mẫu (.xlsx)</label>
        <input
          type="file"
          accept=".xlsx"
          data-testid="file-input"
          disabled={loading}
          onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100"
        />

        {loading && (
          <p className="text-sm text-slate-500 mt-3" data-testid="loading-indicator">
            Đang xử lý…
          </p>
        )}

        {step !== 'upload' && sheets.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-slate-700">
                Chọn sheet dùng làm báo cáo (tối đa {MAX_SELECTED_SHEETS})
              </h2>
              <span className="text-xs text-slate-500" data-testid="sheet-count">
                {selectedSheets.length}/{MAX_SELECTED_SHEETS} đã chọn
              </span>
            </div>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {sheets.map((sheet) => {
                const checked = selectedSheets.includes(sheet.name);
                const disabled = !checked && selectedSheets.length >= MAX_SELECTED_SHEETS;
                return (
                  <label
                    key={sheet.name}
                    className={`flex items-center gap-2 px-3 py-2 text-sm ${disabled ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleSheet(sheet.name)}
                      data-testid={`sheet-checkbox-${sheet.name}`}
                    />
                    <span>{sheet.name}</span>
                    {sheet.state !== 'visible' && (
                      <span className="text-xs text-amber-600">
                        ({sheet.state === 'hidden' ? 'ẩn' : 'ẩn hẳn'})
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              data-testid="btn-preview"
              disabled={selectedSheets.length === 0 || loading}
              onClick={() => void handlePreview()}
              className={`mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${A11Y_FOCUS_RING}`}
            >
              <Upload className="w-4 h-4" />
              Xem trước
            </button>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="mt-6 border-t border-slate-200 pt-6" data-testid="preview-summary">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Kết quả xem trước</h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <SummaryStat label="Ô nhập nhận diện" value={preview.fields.length} />
              <SummaryStat label="Công thức" value={preview.formulas.length} />
              <SummaryStat
                label="Cảnh báo/Lỗi"
                value={preview.issues.length}
                tone={preview.issues.some((i) => i.severity === 'ERROR') ? 'error' : undefined}
              />
            </div>

            {preview.issues.length === 0 ? (
              <p className="text-sm text-green-700 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Không có cảnh báo nào.
              </p>
            ) : (
              <ul className="space-y-1 max-h-60 overflow-y-auto text-sm" data-testid="issue-list">
                {preview.issues.map((issue, i) => (
                  <li
                    key={`${issue.sheetKey}-${issue.address}-${i}`}
                    className={issue.severity === 'ERROR' ? 'text-red-700' : 'text-amber-700'}
                  >
                    [{issue.severity}] {issue.sheetKey}!{issue.address || '(workbook)'}: {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'error';
}) {
  return (
    <div className={`border rounded-lg p-3 ${tone === 'error' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-bold ${tone === 'error' ? 'text-red-700' : 'text-slate-800'}`}>
        {value}
      </div>
    </div>
  );
}
