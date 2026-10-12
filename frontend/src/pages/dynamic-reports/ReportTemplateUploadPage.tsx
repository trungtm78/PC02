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
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Upload, AlertCircle, CheckCircle2, Tag, X } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type {
  ParsedAggregateType,
  ParsedFieldType,
  ReportDetailField,
  ReportDetailView,
  SheetInfo,
  TemplatePreviewResult,
} from '@/features/dynamic-reports/types';
import { carryOverMarks, withPreviousExtras } from '@/features/dynamic-reports/carryOver';
import { applyWebMarks, removeWebMarks } from '@/features/dynamic-reports/markRegion';
import { TYPE_AGGREGATE_COMPATIBILITY } from '@/features/dynamic-reports/engine/generated/token';
import type { ScheduleRule } from '@/features/dynamic-reports/engine/generated/period';
import GridViewer from '@/features/dynamic-reports/grid/GridViewer';
import type { GridField } from '@/features/dynamic-reports/grid/gridEvaluation';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import ReportScheduleStep from './ReportScheduleStep';
import ReportTeamsStep from './ReportTeamsStep';
import ReportRulesStep from './ReportRulesStep';
import ReportSummaryStep from './ReportSummaryStep';
import ReportVersionSummaryStep from './ReportVersionSummaryStep';
import type { ReportRoleConfig, ReportRuleConfig, ReportTargetConfig } from '@/features/dynamic-reports/types';

const MAX_SELECTED_SHEETS = 5;
const FIELD_TYPES: ParsedFieldType[] = ['NUM', 'TEXT', 'DATE', 'TIME'];

type Step = 'upload' | 'sheets' | 'preview' | 'schedule' | 'teams' | 'rules' | 'summary';

/** The schedule of an existing report, in the shape the schedule step edits. */
function scheduleOf(s: NonNullable<ReportDetailView['schedule']>): ScheduleRule {
  return {
    periodType: s.periodType,
    periodStartDay: s.periodStartDay ?? undefined,
    due: s.dueRule as unknown as ScheduleRule['due'],
    open: s.openRule as unknown as ScheduleRule['open'],
    shiftNonWorking: s.shiftNonWorking,
    oneTimeDate: s.oneTimeDate ?? undefined,
  };
}

interface Props {
  /**
   * Given: this is "Cập nhật mẫu" — a new template version of an EXISTING report. Code, name, schedule, managers and
   * teams belong to the report and are not asked again; the cells and rules of the version in force are carried over.
   */
  report?: ReportDetailView;
  /**
   * Given: this is "Sao chép cấu hình" — a NEW report that starts as a copy of this one. The template file, the
   * input cells, the rules, the schedule and the teams are carried over; the code (and the name) must be new.
   */
  copyFrom?: ReportDetailView;
}

export default function ReportTemplateUploadPage({ report, copyFrom }: Props = {}) {
  const isVersion = !!report;
  const source = report ?? copyFrom;
  const previousFields: ReportDetailField[] = source?.currentVersion?.fields ?? [];
  const [step, setStep] = useState<Step>('upload');
  const [code, setCode] = useState(report?.code ?? '');
  const [name, setName] = useState(report ? report.name : copyFrom ? `${copyFrom.name} (bản sao)` : '');
  const [description, setDescription] = useState(source?.description ?? '');
  const [carryNote, setCarryNote] = useState<{ carried: number; lost: ReportDetailField[] } | null>(null);
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
  const [rules, setRules] = useState<ReportRuleConfig[]>([]);
  // Stepping back and forward again must not throw away what the person already set on a step.
  const [rulesSet, setRulesSet] = useState(false);

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
      if (source) {
        const names = new Set(result.map((x) => x.name));
        setSelectedSheets((source.currentVersion?.selectedSheets ?? []).filter((n) => names.has(n)));
      }
      setStep('sheets');
    } catch (err) {
      setError(extractApiError(err).message);
      setStep('upload');
    } finally {
      setLoading(false);
    }
  }

  async function useCurrentFile() {
    const current = source?.currentVersion;
    if (!source || !current) return;
    setError(null);
    setLoading(true);
    try {
      const f = await dynamicReportsApi.downloadVersionFile(source.id, current.versionId, current.fileName);
      await handleFileChange(f);
    } catch (err) {
      setError(extractApiError(err).message);
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
      const fresh = await dynamicReportsApi.previewTemplate(file, selectedSheets);
      let result = fresh;
      if (source) {
        const carry = carryOverMarks(fresh, previousFields);
        result = carry.result;
        setCarryNote({ carried: carry.carried.length, lost: carry.lost });
      }
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

  // The grid draws the fields already marked as input cells, and offers the markable cells for picking.
  const gridFields = useMemo<GridField[]>(
    () =>
      (preview?.fields ?? []).map((f) => ({
        sheetKey: f.sheetKey,
        address: f.address,
        fieldKey: f.fieldKey,
        type: f.type,
        label: f.label,
      })),
    [preview?.fields],
  );
  const candidateKeys = useMemo(
    () => new Set((preview?.markableCells ?? []).map((c) => `${c.sheetKey}!${c.address}`)),
    [preview?.markableCells],
  );

  // A data-validation suggestion is about the cell that carries it, so it is offered once that cell is an input.
  const ruleSuggestions = useMemo(() => {
    const fieldKeys = new Set((preview?.fields ?? []).map((f) => f.fieldKey));
    return (preview?.suggestedRules ?? []).filter(
      (s) => s.origin !== 'DATA_VALIDATION' || fieldKeys.has(`${s.sheetKey}!${s.address}`),
    );
  }, [preview?.suggestedRules, preview?.fields]);

  function pickCandidates(keys: string[], additive: boolean) {
    setSelectedCandidates((prev) => (additive ? new Set([...prev, ...keys]) : new Set(keys)));
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
    <div
      className={`${step === 'preview' && preview?.grid ? 'max-w-6xl' : 'max-w-3xl'} mx-auto p-6`}
      data-testid="report-template-upload-page"
    >
      <Link
        to="/bao-cao-dong/thiet-lap"
        className={`inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4 ${A11Y_FOCUS_RING}`}
      >
        <ArrowLeft className="w-4 h-4" />
        Quay lại danh sách báo cáo
      </Link>

      <h1 className="text-xl font-bold text-slate-800 mb-1" data-testid="wizard-title">
        {isVersion
          ? `Cập nhật mẫu — ${name}`
          : copyFrom
            ? `Sao chép báo cáo — ${copyFrom.name}`
            : 'Tạo báo cáo mới — Tải mẫu Excel'}
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {isVersion
          ? 'Tải file Excel mẫu mới (hoặc dùng lại file đang áp dụng). Các ô nhập đã đặt tên ở phiên bản trước được giữ lại.'
          : copyFrom
            ? 'Đặt mã và tên mới cho báo cáo. File mẫu, ô nhập, quy tắc, lịch và tổ được lấy từ báo cáo gốc — bạn có thể đổi từng bước.'
            : 'Bước 1/4: tải file Excel mẫu và chọn sheet dùng làm báo cáo.'}
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-lg p-6">
        {copyFrom && source?.currentVersion && (
          <div className="flex items-center justify-between gap-3 mb-4 text-sm" data-testid="copy-mode-note">
            <p className="text-slate-600">
              Bắt đầu từ file mẫu của báo cáo <b className="font-mono">{copyFrom.code}</b>. Bấm nút bên phải để nạp file đó
              (hoặc chọn một file khác ở dưới).
            </p>
            <button
              type="button"
              data-testid="btn-use-current-file"
              disabled={loading}
              onClick={() => void useCurrentFile()}
              className={`shrink-0 px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
            >
              Dùng file của báo cáo gốc
            </button>
          </div>
        )}
        {isVersion && (
          <div className="flex items-center justify-between gap-3 mb-4 text-sm" data-testid="version-mode-note">
            <p className="text-slate-600">
              Báo cáo <b className="font-mono">{code}</b> — đang ở phiên bản {report?.currentVersion?.version ?? '?'}.
              Phiên bản mới áp dụng theo quy tắc: kỳ đang mở chưa ai nhập thì dùng ngay, kỳ đã có số liệu giữ phiên bản cũ.
            </p>
            {report?.currentVersion && (
              <button
                type="button"
                data-testid="btn-use-current-file"
                disabled={loading}
                onClick={() => void useCurrentFile()}
                className={`shrink-0 px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
              >
                Dùng lại file đang áp dụng
              </button>
            )}
          </div>
        )}
        {!isVersion && (
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
        )}
        {!isVersion && (
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
        )}

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

            {source && carryNote && (
              <div className="mb-4 text-sm" data-testid="carry-over-note">
                <p className="text-slate-700">
                  Giữ lại <b>{carryNote.carried}</b> ô nhập từ phiên bản trước.
                </p>
                {carryNote.lost.length > 0 && (
                  <div className="mt-2 border border-amber-200 bg-amber-50 rounded-lg p-3" data-testid="carry-over-lost">
                    <p className="text-amber-800">
                      {carryNote.lost.length} ô nhập của phiên bản trước không còn trong mẫu mới (ô đã bị xoá, bị khoá hoặc
                      nay là công thức) và sẽ KHÔNG còn là ô nhập. Nếu muốn giữ, hãy đánh dấu lại ô tương ứng ở bên dưới:
                    </p>
                    <ul className="list-disc ml-5 mt-1 text-amber-800">
                      {carryNote.lost.map((f) => (
                        <li key={f.fieldKey}>
                          {f.fieldKey} — {f.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

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

            {preview.grid && (
              <div className="mt-6" data-testid="template-grid-section">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Mẫu như người nhập sẽ thấy</h3>
                <GridViewer
                  versionId="preview"
                  grid={preview.grid}
                  fields={gridFields}
                  values={{}}
                  mark={{ candidates: candidateKeys, chosen: selectedCandidates, onPick: pickCandidates }}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Chọn ô trên bảng rồi nhập nhãn, kiểu và cách tổng hợp ở danh sách bên dưới (dùng được cả bằng bàn phím).
                </p>
              </div>
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
                onClick={() => setStep(isVersion ? 'rules' : 'schedule')}
                className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 ${A11Y_FOCUS_RING}`}
              >
                {isVersion ? 'Tiếp theo: Quy tắc kiểm tra' : 'Tiếp theo: Đặt lịch'}
              </button>
            </div>
          </div>
        )}

        {step === 'schedule' && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <ReportScheduleStep
              initial={copyFrom?.schedule ? scheduleOf(copyFrom.schedule) : undefined}
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
              initialRoles={copyFrom?.roles.map((r) => ({
                userId: r.userId,
                role: r.role,
                ...(r.teamScopeId ? { teamScopeId: r.teamScopeId } : {}),
              }))}
              initialTargets={copyFrom?.targets.map((t) => ({ teamId: t.teamId, editorUserIds: t.editors.map((e) => e.userId) }))}
              teamNames={copyFrom ? Object.fromEntries(copyFrom.targets.map((t) => [t.teamId, t.teamName])) : undefined}
              onBack={() => setStep('schedule')}
              onNext={(r, t) => {
                setRoles(r);
                setTargets(t);
                setStep('rules');
              }}
            />
          </div>
        )}

        {step === 'rules' && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <ReportRulesStep
              suggestions={ruleSuggestions}
              initial={
                rulesSet
                  ? rules
                  : source
                  ? (source.currentVersion?.rules ?? []).map((r) => ({
                      name: r.name,
                      leftExpr: r.leftExpr,
                      operator: r.operator as ReportRuleConfig['operator'],
                      rightExpr: r.rightExpr,
                      severity: r.severity as ReportRuleConfig['severity'],
                      message: r.message,
                      ...(r.missingStrategy ? { missingStrategy: r.missingStrategy } : {}),
                    }))
                  : undefined
              }
              nextLabel={isVersion ? 'Tiếp theo: Xuất bản' : undefined}
              onBack={() => setStep(isVersion ? 'preview' : 'teams')}
              onNext={(r) => {
                setRules(r);
                setRulesSet(true);
                setStep('summary');
              }}
            />
          </div>
        )}

        {step === 'summary' && isVersion && report && file && preview && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <ReportVersionSummaryStep
              reportId={report.id}
              reportCode={report.code}
              currentVersion={report.currentVersion?.version ?? null}
              file={file}
              selectedSheets={selectedSheets}
              dateSystem={preview.dateSystem}
              fields={preview.fields}
              previousFields={previousFields}
              layout={preview.layout}
              formulas={preview.formulas}
              rules={rules}
              onBack={() => setStep('rules')}
            />
          </div>
        )}

        {step === 'summary' && !isVersion && file && preview && schedule && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <ReportSummaryStep
              file={file}
              code={code}
              name={name}
              description={description}
              selectedSheets={selectedSheets}
              dateSystem={preview.dateSystem}
              fields={copyFrom ? withPreviousExtras(preview.fields, previousFields) : preview.fields}
              layout={preview.layout}
              formulas={preview.formulas}
              schedule={schedule}
              roles={roles}
              targets={targets}
              rules={rules}
              onBack={() => setStep('rules')}
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
