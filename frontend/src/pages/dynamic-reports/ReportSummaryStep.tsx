/**
 * S10 — Tổng kết + Lưu nháp / Xuất bản (spec §6.1 PR4 bước 4/4). The
 * wizard's last step: everything collected in S02-S09 (still only React
 * state) is sent once to `POST /bao-cao-dong/reports` (PR4 slice 5a) —
 * the first time any of it reaches the database.
 */
import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Save, Send } from 'lucide-react';
import { Link } from 'react-router-dom';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import type {
  ParsedField,
  ParsedFormulaCell,
  ReportRoleConfig,
  ReportTargetConfig,
  TemplateLayout,
} from '@/features/dynamic-reports/types';
import type { ScheduleRule } from '@/features/dynamic-reports/engine/generated/period';

interface Props {
  file: File;
  code: string;
  name: string;
  description: string;
  selectedSheets: string[];
  dateSystem: '1900' | '1904';
  fields: ParsedField[];
  layout: TemplateLayout;
  formulas: ParsedFormulaCell[];
  schedule: ScheduleRule;
  roles: ReportRoleConfig[];
  targets: ReportTargetConfig[];
  onBack: () => void;
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportSummaryStep({
  file,
  code,
  name,
  description,
  selectedSheets,
  dateSystem,
  fields,
  layout,
  formulas,
  schedule,
  roles,
  targets,
  onBack,
}: Props) {
  const [effectiveFrom, setEffectiveFrom] = useState(todayDateOnly());
  // Stable across retries of the SAME attempt (so a double-click or a
  // network-error retry never double-publishes) — a fresh key only if the
  // user navigates away and starts a new wizard session.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reportId: string; status: string } | null>(null);

  async function handleSave(publish: boolean) {
    setError(null);
    setLoading(publish ? 'publish' : 'draft');
    try {
      const saved = await dynamicReportsApi.saveReportConfig(file, {
        code,
        name,
        description: description || undefined,
        selectedSheets,
        dateSystem,
        fields,
        layout,
        formulas,
        schedule: {
          periodType: schedule.periodType,
          periodStartDay: schedule.periodStartDay,
          dueRule: schedule.due,
          openRule: schedule.open,
          shiftNonWorking: schedule.shiftNonWorking,
          oneTimeDate: schedule.oneTimeDate,
        },
        roles,
        targets,
        effectiveFrom: `${effectiveFrom}T00:00:00.000Z`,
        publish,
        idempotencyKey,
      });
      setResult(saved);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(null);
    }
  }

  if (result) {
    return (
      <div data-testid="summary-result" className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <p className="text-lg font-semibold text-slate-800">
          {result.status === 'PUBLISHED' ? 'Đã xuất bản báo cáo' : 'Đã lưu nháp báo cáo'}
        </p>
        <p className="text-sm text-slate-500 mt-1">Mã báo cáo: {code}</p>
        <Link
          to="/bao-cao-dong/thiet-lap"
          className={`inline-block mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 ${A11Y_FOCUS_RING}`}
        >
          Về danh sách báo cáo
        </Link>
      </div>
    );
  }

  return (
    <div data-testid="summary-step">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Tổng kết cấu hình</h2>

      <label className="block text-sm mb-4 max-w-xs">
        <span className="font-medium text-slate-700">Có hiệu lực từ</span>
        <input
          type="date"
          data-testid="input-effective-from"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          className="block w-full mt-1 border border-slate-300 rounded px-3 py-2 text-sm"
        />
      </label>

      <dl className="grid grid-cols-2 gap-3 text-sm mb-6" data-testid="summary-details">
        <SummaryRow label="Mã / Tên" value={`${code} — ${name}`} />
        <SummaryRow label="Sheet đã chọn" value={selectedSheets.join(', ')} />
        <SummaryRow label="Ô nhập" value={String(fields.length)} />
        <SummaryRow label="Loại kỳ" value={schedule.periodType} />
        <SummaryRow label="Quản lý" value={String(roles.filter((r) => r.role === 'MANAGER').length)} />
        <SummaryRow label="Người chỉ xem" value={String(roles.filter((r) => r.role === 'VIEWER').length)} />
        <SummaryRow label="Số tổ phải nộp" value={String(targets.length)} />
        <SummaryRow
          label="Tổng người nhập"
          value={String(new Set(targets.flatMap((t) => t.editorUserIds)).size)}
        />
      </dl>

      {error && (
        <p className="text-sm text-red-700 mb-4" data-testid="save-error">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={loading !== null}
          className={`flex items-center gap-1 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-50 ${A11Y_FOCUS_RING}`}
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="btn-save-draft"
            disabled={loading !== null}
            onClick={() => void handleSave(false)}
            className={`flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <Save className="w-4 h-4" />
            {loading === 'draft' ? 'Đang lưu…' : 'Lưu nháp'}
          </button>
          <button
            type="button"
            data-testid="btn-publish"
            disabled={loading !== null}
            onClick={() => void handleSave(true)}
            className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <Send className="w-4 h-4" />
            {loading === 'publish' ? 'Đang xuất bản…' : 'Xuất bản'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800 font-medium">{value || '—'}</dd>
    </div>
  );
}
