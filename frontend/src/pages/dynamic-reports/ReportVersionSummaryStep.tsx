/**
 * "Cập nhật mẫu" — the last step: publish the new template version (or keep it as a draft). Says plainly, before
 * anything is sent, which open periods take the new version at once and which keep the old one (D09), and after,
 * which ones did.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Save, Send } from 'lucide-react';
import { randomUUID } from '@/lib/uuid';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import { withPreviousExtras } from '@/features/dynamic-reports/carryOver';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import type {
  CreateVersionResult,
  ParsedField,
  ParsedFormulaCell,
  ReportDetailField,
  ReportRuleConfig,
  TemplateLayout,
} from '@/features/dynamic-reports/types';

interface Props {
  reportId: string;
  reportCode: string;
  currentVersion: number | null;
  file: File;
  selectedSheets: string[];
  dateSystem: '1900' | '1904';
  fields: ParsedField[];
  previousFields: ReportDetailField[];
  layout: TemplateLayout;
  formulas: ParsedFormulaCell[];
  rules: ReportRuleConfig[];
  onBack: () => void;
}

export default function ReportVersionSummaryStep({
  reportId,
  reportCode,
  currentVersion,
  file,
  selectedSheets,
  dateSystem,
  fields,
  previousFields,
  layout,
  formulas,
  rules,
  onBack,
}: Props) {
  // Stable across retries of the SAME attempt: a double click or a network retry never creates two versions.
  const [idempotencyKey] = useState(() => randomUUID());
  const [loading, setLoading] = useState<'draft' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateVersionResult | null>(null);

  async function handleSave(publish: boolean) {
    setError(null);
    setLoading(publish ? 'publish' : 'draft');
    try {
      const saved = await dynamicReportsApi.createReportVersion(reportId, file, {
        selectedSheets,
        dateSystem,
        fields: withPreviousExtras(fields, previousFields),
        layout,
        formulas,
        rules: rules.length > 0 ? rules : undefined,
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
      <div data-testid="version-result" className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <p className="text-lg font-semibold text-slate-800">
          {result.status === 'PUBLISHED' ? `Đã xuất bản phiên bản ${result.version}` : `Đã lưu nháp phiên bản ${result.version}`}
        </p>
        {result.status === 'PUBLISHED' && (
          <div className="text-sm text-slate-600 mt-3 space-y-1" data-testid="version-applied">
            {result.appliedToPeriods.length > 0 && (
              <p>
                Áp dụng ngay cho kỳ chưa ai nhập: <b>{result.appliedToPeriods.join(', ')}</b>.
              </p>
            )}
            {result.keptOnOldVersionPeriods.length > 0 && (
              <p>
                Giữ phiên bản cũ cho kỳ đã có số liệu: <b>{result.keptOnOldVersionPeriods.join(', ')}</b>. Phiên bản mới
                áp dụng từ kỳ kế tiếp.
              </p>
            )}
            {result.appliedToPeriods.length === 0 && result.keptOnOldVersionPeriods.length === 0 && (
              <p>Không có kỳ nào đang mở; phiên bản mới áp dụng từ kỳ kế tiếp.</p>
            )}
          </div>
        )}
        <div className="flex justify-center gap-2 mt-4">
          <Link
            to={`/bao-cao-dong/thiet-lap/${reportId}`}
            className={`px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 ${A11Y_FOCUS_RING}`}
          >
            Xem báo cáo
          </Link>
          <Link
            to={`/bao-cao-dong/thiet-lap/${reportId}/phien-ban`}
            className={`px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 ${A11Y_FOCUS_RING}`}
          >
            Danh sách phiên bản
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="version-summary-step">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Tổng kết phiên bản mới</h2>

      <dl className="grid grid-cols-2 gap-3 text-sm mb-4" data-testid="version-summary-details">
        <Row label="Báo cáo" value={reportCode} />
        <Row label="Phiên bản hiện tại" value={currentVersion ? `v${currentVersion}` : '—'} />
        <Row label="File mẫu" value={file.name} />
        <Row label="Sheet đã chọn" value={selectedSheets.join(', ')} />
        <Row label="Ô nhập" value={String(fields.length)} />
        <Row label="Quy tắc kiểm tra" value={String(rules.length)} />
      </dl>

      <p className="text-sm text-slate-600 mb-4" data-testid="d09-explainer">
        Khi xuất bản: kỳ đang mở mà <b>chưa tổ nào nhập gì</b> sẽ dùng mẫu mới ngay; kỳ <b>đã có người nhập</b> giữ mẫu cũ để không
        làm lệch số liệu đã nhập; kỳ đã chốt không bị đụng tới. Mẫu mới áp dụng cho các kỳ sinh sau đó.
      </p>

      {error && (
        <p className="text-sm text-red-700 mb-4" data-testid="version-save-error">
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
            data-testid="btn-version-save-draft"
            disabled={loading !== null}
            onClick={() => void handleSave(false)}
            className={`flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <Save className="w-4 h-4" />
            {loading === 'draft' ? 'Đang lưu…' : 'Lưu nháp'}
          </button>
          <button
            type="button"
            data-testid="btn-version-publish"
            disabled={loading !== null || fields.length === 0}
            onClick={() => void handleSave(true)}
            className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <Send className="w-4 h-4" />
            {loading === 'publish' ? 'Đang xuất bản…' : 'Xuất bản phiên bản mới'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value}</dd>
    </div>
  );
}
