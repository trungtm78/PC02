/**
 * S02/S03/S04 — Tải mẫu Excel + chọn sheet + xem trước + đánh dấu ô
 * (spec §6.1 PR4).
 *
 * Scope decision carried over from slice 3: a real, usable flow against
 * the real endpoints, but NOT the full pixel-faithful Excel-like grid
 * (GridRenderer) — that is shared infrastructure for several later screens
 * (S11/S15 input grids) and deserves its own dedicated slice once its real
 * rendering needs are concrete. S04 "đánh dấu ô trên web" is delivered here
 * as a candidate LIST (the cells `UNLOCKED_NO_TOKEN`-warned by the parser,
 * spec §3), not a visual grid: every candidate is already unambiguously
 * identified by Sheet!Cell + its inferred label, which is everything the
 * marking decision needs.
 *
 * Marking itself (`applyWebMarks`/`removeWebMarks`) runs entirely
 * client-side on the preview result already in memory — no server round
 * trip per click. The server re-validates authoritatively at publish time
 * (slice 5), the same "client preview, server is the authoritative source"
 * split already used throughout spec §10 R2.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, AlertCircle, CheckCircle2, Tag, X } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type {
  ParsedAggregateType,
  ParsedFieldType,
  SheetInfo,
  TemplatePreviewResult,
} from '@/features/dynamic-reports/types';
import { applyWebMarks, removeWebMarks } from '@/features/dynamic-reports/markRegion';
import { TYPE_AGGREGATE_COMPATIBILITY } from '@/features/dynamic-reports/engine/generated/token';
import type { ScheduleRule } from '@/features/dynamic-reports/engine/generated/period';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import ReportScheduleStep from './ReportScheduleStep';
import ReportTeamsStep from './ReportTeamsStep';
import ReportSummaryStep from './ReportSummaryStep';
import type { ReportRoleConfig, ReportTargetConfig } from '@/features/dynamic-reports/types';

const MAX_SELECTED_SHEETS = 5;
const FIELD_TYPES: ParsedFieldType[] = ['NUM', 'TEXT', 'DATE', 'TIME'];

type Step = 'upload' | 'sheets' | 'preview' | 'schedule' | 'teams' | 'summary';

export default function ReportTemplateUploadPage() {
  const [step, setStep] = useState<Step>('upload');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [selectedSheets, setSelectedSheets] = useState<string[]>([]);
  const [preview, setPreview] = useState<TemplatePreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [candidateLabels, setCandidateLabels] = useState<Record<string, string>>({});
  const [batchType, setBatchType] = useState<ParsedFieldType>('NUM');
  const [batchFormat, setBatchFormat] = useState('');
  const [batchAggregate, setBatchAggregate] = useState<ParsedAggregateType>('NONE');
  const [markError, setMarkError] = useState<string | null>(null);

  const [schedule, setSchedule] = useState<ScheduleRule | null>(null);
  const [roles, setRoles] = useState<ReportRoleConfig[]>([]);
  const [targets, setTargets] = useState<ReportTargetConfig[]>([]);

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
      setCandidateLabels(
        Object.fromEntries(
          result.markableCells.map((c) => [
            `${c.sheetKey}!${c.address}`,
            c.suggestedLabel ?? '',
          ]),
        ),
      );
      setSelectedCandidates(new Set());
      setStep('preview');
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  }

  function toggleCandidate(key: string) {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleApplyMarks() {
    if (!preview || selectedCandidates.size === 0) return;
    const marks = Array.from(selectedCandidates).map((key) => {
      const cell = preview.markableCells.find((c) => `${c.sheetKey}!${c.address}` === key);
      return {
        sheetKey: cell?.sheetKey ?? '',
        address: cell?.address ?? '',
        label: candidateLabels[key] ?? '',
        type: batchType,
        format: batchFormat,
        aggregate: batchAggregate,
      };
    });
    const result = applyWebMarks(preview, marks);
    if (!result.ok) {
      setMarkError(result.errors.join(' '));
      return;
    }
    setMarkError(null);
    setPreview(result.result);
    setSelectedCandidates(new Set());
  }

  function handleUnmark(fieldKey: string) {
    if (!preview) return;
    setPreview(removeWebMarks(preview, [fieldKey]));
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
        <div className="grid grid-cols-2 gap-4 mb-4">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Mã báo cáo <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              data-testid="input-report-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="block w-full mt-1 border border-slate-300 rounded px-3 py-2 text-sm"
              placeholder="VD: HSLN"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">
              Tên báo cáo <span className="text-red-500">*</span>
            </span>
            <input
              type="text"
              data-testid="input-report-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full mt-1 border border-slate-300 rounded px-3 py-2 text-sm"
              placeholder="VD: Thống kê hình sự liên ngành"
            />
          </label>
        </div>
        <label className="block text-sm mb-4">
          <span className="font-medium text-slate-700">Mô tả</span>
          <textarea
            data-testid="input-report-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="block w-full mt-1 border border-slate-300 rounded px-3 py-2 text-sm"
            rows={2}
          />
        </label>

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
              disabled={selectedSheets.length === 0 || loading || !code.trim() || !name.trim()}
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

            {preview.fields.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Ô nhập đã có</h3>
                <ul className="space-y-1 text-sm" data-testid="field-list">
                  {preview.fields.map((f) => (
                    <li
                      key={f.fieldKey}
                      className="flex items-center justify-between border border-slate-100 rounded px-2 py-1"
                    >
                      <span>
                        {f.fieldKey} — {f.label || '(chưa có nhãn)'} ({f.type}
                        {f.aggregate !== 'NONE' ? `|${f.aggregate}` : ''})
                        <span className="ml-1 text-xs text-slate-400">[{f.source}]</span>
                      </span>
                      {f.source === 'WEB' && (
                        <button
                          type="button"
                          data-testid={`btn-unmark-${f.fieldKey}`}
                          onClick={() => handleUnmark(f.fieldKey)}
                          className={`text-slate-400 hover:text-red-600 ${A11Y_FOCUS_RING}`}
                          aria-label={`Bỏ đánh dấu ${f.fieldKey}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.markableCells.length > 0 && (
              <div className="mt-6" data-testid="markable-cells-section">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">
                  Ô có thể đánh dấu làm ô nhập ({preview.markableCells.length})
                </h3>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-60 overflow-y-auto mb-3">
                  {preview.markableCells.map((c) => {
                    const key = `${c.sheetKey}!${c.address}`;
                    return (
                      <div key={key} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          data-testid={`candidate-checkbox-${key}`}
                          checked={selectedCandidates.has(key)}
                          onChange={() => toggleCandidate(key)}
                        />
                        <span className="text-slate-500 w-32 shrink-0">{key}</span>
                        <input
                          type="text"
                          data-testid={`candidate-label-${key}`}
                          value={candidateLabels[key] ?? ''}
                          placeholder="Nhãn (bắt buộc)"
                          onChange={(e) =>
                            setCandidateLabels((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className="flex-1 border border-slate-200 rounded px-2 py-1 text-sm"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-end gap-2">
                  <label className="text-xs text-slate-600">
                    Kiểu
                    <select
                      data-testid="batch-type"
                      value={batchType}
                      onChange={(e) => {
                        const t = e.target.value as ParsedFieldType;
                        setBatchType(t);
                        if (!TYPE_AGGREGATE_COMPATIBILITY[t].includes(batchAggregate)) {
                          setBatchAggregate('NONE');
                        }
                      }}
                      className="block border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-600">
                    Format
                    <input
                      type="text"
                      data-testid="batch-format"
                      value={batchFormat}
                      onChange={(e) => setBatchFormat(e.target.value)}
                      className="block border border-slate-300 rounded px-2 py-1.5 text-sm mt-1 w-28"
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    Tổng hợp
                    <select
                      data-testid="batch-aggregate"
                      value={batchAggregate}
                      onChange={(e) => setBatchAggregate(e.target.value as ParsedAggregateType)}
                      className="block border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
                    >
                      {TYPE_AGGREGATE_COMPATIBILITY[batchType].map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    data-testid="btn-apply-marks"
                    disabled={selectedCandidates.size === 0}
                    onClick={handleApplyMarks}
                    className={`flex items-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${A11Y_FOCUS_RING}`}
                  >
                    <Tag className="w-4 h-4" />
                    Đánh dấu {selectedCandidates.size > 0 ? `(${selectedCandidates.size})` : ''}
                  </button>
                </div>
                {markError && (
                  <p className="text-sm text-red-700 mt-2" data-testid="mark-error">
                    {markError}
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end mt-6 border-t border-slate-100 pt-4">
              <button
                type="button"
                data-testid="btn-go-to-schedule"
                onClick={() => setStep('schedule')}
                className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 ${A11Y_FOCUS_RING}`}
              >
                Tiếp theo: Đặt lịch
              </button>
            </div>
          </div>
        )}

        {step === 'schedule' && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <ReportScheduleStep
              onBack={() => setStep('preview')}
              onNext={(rule) => {
                setSchedule(rule);
                setStep('teams');
              }}
            />
          </div>
        )}

        {step === 'teams' && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <ReportTeamsStep
              onBack={() => setStep('schedule')}
              onNext={(r, t) => {
                setRoles(r);
                setTargets(t);
                setStep('summary');
              }}
            />
          </div>
        )}

        {step === 'summary' && file && preview && schedule && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <ReportSummaryStep
              file={file}
              code={code}
              name={name}
              description={description}
              selectedSheets={selectedSheets}
              dateSystem={preview.dateSystem}
              fields={preview.fields}
              layout={preview.layout}
              formulas={preview.formulas}
              schedule={schedule}
              roles={roles}
              targets={targets}
              onBack={() => setStep('teams')}
            />
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
