import { useState } from 'react';
import { api } from '@/lib/api';

interface DryRunReport {
  totalRecords: number;
  willCreatePetitions: number;
  willCreateIncidents: number;
  willCreateCases: number;
  willCreateGuidance: number;
  willCreateExchanges: number;
  willCreateProposals: number;
  willCreateLawyers: number;
  warningsCount: number;
  warnings: string[];
  duplicateLegacyIds: string[];
  missingIdCount: number;
  fieldCoverage: {
    distinctSourceKeys: number;
    mappedKeys: number;
    rawOnlyKeys: number;
    rawOnlyKeyNames: string[];
    typedCoverageRatio: number;
    rawCoverageRatio: number;
    lostKeyNames: string[];
    skippedRecords: number;
    provisional: boolean;
  };
}
interface CommitResult {
  created: {
    petitions: number;
    incidents: number;
    cases: number;
    guidance: number;
    exchanges: number;
    proposals: number;
    lawyers: number;
  };
  skipped: number;
  errors: { legacyId: string; message: string }[];
}

// Tool di trú dữ liệu hệ thống cũ (admin). Dán JSON mảng record cũ → Đối soát (dry-run) → Di trú (commit).
export function LegacyMigrationPage() {
  const [raw, setRaw] = useState('');
  const [report, setReport] = useState<DryRunReport | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function parseRecords(): unknown[] | null {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setError('JSON phải là MẢNG các record.');
        return null;
      }
      setError('');
      return parsed;
    } catch {
      setError('JSON không hợp lệ.');
      return null;
    }
  }

  async function onDryRun() {
    const records = parseRecords();
    if (!records) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await api.post('/legacy-migration/dry-run', { records });
      setReport(res.data as DryRunReport);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onCommit() {
    const records = parseRecords();
    if (!records) return;
    if (!window.confirm(`Di trú ${records.length} record vào hệ thống mới? (idempotent — chạy lại an toàn)`)) return;
    setBusy(true);
    try {
      const res = await api.post('/legacy-migration/commit', { records });
      setResult(res.data as CommitResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4" data-testid="legacy-migration-page">
      <h1 className="text-xl font-bold text-slate-800">Di trú dữ liệu hệ thống cũ</h1>
      <p className="text-sm text-slate-600">
        Dán JSON mảng record từ hệ thống cũ (export Excel→JSON hoặc dump DB). Bấm <b>Đối soát</b> để xem trước,
        rồi <b>Di trú</b>. Idempotent theo <code>legacySourceId</code> — chạy lại không nhân đôi.
      </p>

      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={10}
        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder='[{"id":"L-001","phan_loai_nguon_tin_ban_dau":"don-cong-van-ban-dau","ten_ca_nhan_co_quan_to_chuc_cung_cap":"...","tom_tat_noi_dung":"..."}]'
        data-testid="legacy-input"
      />

      {error && <p className="text-sm text-red-600" data-testid="legacy-error">{error}</p>}

      <div className="flex gap-3">
        <button onClick={() => void onDryRun()} disabled={busy} className="px-4 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-50" data-testid="legacy-dryrun-btn">
          Đối soát (dry-run)
        </button>
        <button onClick={() => void onCommit()} disabled={busy || !report} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50" data-testid="legacy-commit-btn">
          Di trú (commit)
        </button>
      </div>

      {report && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm space-y-1" data-testid="legacy-report">
          <p>Tổng record: <b>{report.totalRecords}</b></p>
          <p>Sẽ tạo: Đơn thư <b>{report.willCreatePetitions}</b> · Vụ việc <b>{report.willCreateIncidents}</b> · Vụ án <b>{report.willCreateCases}</b></p>
          <p>Tier ③: Hướng dẫn <b>{report.willCreateGuidance}</b> · Trao đổi <b>{report.willCreateExchanges}</b> · Kiến nghị <b>{report.willCreateProposals}</b> · Luật sư <b>{report.willCreateLawyers}</b></p>
          <p>Thiếu id: {report.missingIdCount} · Trùng legacyId: {report.duplicateLegacyIds.length}</p>
          <p>
            Độ phủ field (tạm thời/provisional): map sang cột{' '}
            <b>{Math.round(report.fieldCoverage.typedCoverageRatio * 100)}%</b>{' '}
            ({report.fieldCoverage.mappedKeys}/{report.fieldCoverage.distinctSourceKeys}) · raw-only{' '}
            <b>{report.fieldCoverage.rawOnlyKeys}</b> (giữ trong legacyRaw, không mất data)
          </p>
          {report.fieldCoverage.rawOnlyKeyNames.length > 0 && (
            <details className="ml-1">
              <summary className="cursor-pointer text-slate-500">Cột raw-only (cân nhắc bổ sung cột)</summary>
              <p className="text-xs text-slate-500 break-words">{report.fieldCoverage.rawOnlyKeyNames.join(', ')}</p>
            </details>
          )}
          {report.fieldCoverage.skippedRecords > 0 && (
            <p className="text-red-700 font-medium" data-testid="legacy-dataloss-warning">
              ⚠ {report.fieldCoverage.skippedRecords} record bị bỏ qua (phân loại lạ/thiếu id) — field SẼ MẤT khi commit:{' '}
              {report.fieldCoverage.lostKeyNames.slice(0, 30).join(', ')}
            </p>
          )}
          <p>Cảnh báo: {report.warningsCount}</p>
          {report.warnings.length > 0 && (
            <ul className="list-disc ml-5 text-amber-700 max-h-40 overflow-y-auto">
              {report.warnings.slice(0, 50).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm space-y-1" data-testid="legacy-result">
          <p className="font-semibold text-green-800">Đã di trú</p>
          <p>Tạo mới: Đơn thư {result.created.petitions} · Vụ việc {result.created.incidents} · Vụ án {result.created.cases}</p>
          <p>Tier ③: Hướng dẫn {result.created.guidance} · Trao đổi {result.created.exchanges} · Kiến nghị {result.created.proposals} · Luật sư {result.created.lawyers}</p>
          <p>Bỏ qua: {result.skipped} · Lỗi: {result.errors.length}</p>
          {result.errors.length > 0 && (
            <ul className="list-disc ml-5 text-red-700 max-h-40 overflow-y-auto">
              {result.errors.slice(0, 50).map((e, i) => <li key={i}>{e.legacyId}: {e.message}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default LegacyMigrationPage;
