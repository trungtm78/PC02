/**
 * D7/D8 — lịch sử xuất báo cáo.
 *
 * Trước đây xuất Phụ lục không để lại dấu vết: file rời hệ thống và không ai
 * biết nó đã rời đi. Với số liệu tố tụng, "ai đang cầm bản này" là câu hỏi có
 * thật, và câu trả lời phải tra được ở đâu đó.
 */
import { useCallback, useEffect, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDate, formatVNDateTime } from '@/lib/dates';

interface ExportRow {
  id: string;
  reportType: string;
  fileName: string;
  rowCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  succeeded: boolean;
  errorText: string | null;
  createdAt: string;
  exportedBy?: { username: string; firstName?: string; lastName?: string } | null;
}

const TYPE_LABEL: Record<string, string> = {
  PHU_LUC_1: 'Phụ lục 1',
  PHU_LUC_2: 'Phụ lục 2',
  PHU_LUC_3: 'Phụ lục 3',
  PHU_LUC_4: 'Phụ lục 4',
  PHU_LUC_5: 'Phụ lục 5',
  PHU_LUC_6: 'Phụ lục 6',
};

function personName(u: ExportRow['exportedBy']) {
  if (!u) return '—';
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username;
}

function period(r: ExportRow) {
  if (!r.periodStart && !r.periodEnd) return '—';
  return `${r.periodStart ? formatVNDate(r.periodStart) : '…'} – ${r.periodEnd ? formatVNDate(r.periodEnd) : '…'}`;
}

export function ExportHistoryPanel() {
  const [rows, setRows] = useState<ExportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/reports/export-history?limit=50');
      setRows((res.data?.data?.data ?? res.data?.data ?? []) as ExportRow[]);
    } catch (e) {
      setError(extractApiError(e, 'Không tải được lịch sử xuất báo cáo').message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-500 p-8 justify-center" data-testid="export-loading">
        <Loader2 className="w-5 h-5 animate-spin" /> Đang tải…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" data-testid="export-error">
        {error}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-10 text-center bg-white border border-slate-200 rounded-lg" data-testid="export-empty">
        <FileDown className="w-10 h-10 text-slate-400 mx-auto mb-3" />
        <p className="font-medium text-slate-800">Chưa có lượt xuất báo cáo nào</p>
        <p className="text-sm text-slate-500 mt-1">Mỗi lần xuất Phụ lục sẽ được ghi lại ở đây.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto" data-testid="export-panel">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {['Thời điểm', 'Báo cáo', 'Kỳ', 'Số dòng', 'Người xuất', 'Kết quả'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-slate-700 uppercase">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100" data-testid={`export-row-${r.id}`}>
              <td className="px-4 py-2.5 whitespace-nowrap">{formatVNDateTime(r.createdAt)}</td>
              <td className="px-4 py-2.5">{TYPE_LABEL[r.reportType] ?? r.reportType}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">{period(r)}</td>
              <td className="px-4 py-2.5 tabular-nums">{r.rowCount}</td>
              <td className="px-4 py-2.5">{personName(r.exportedBy)}</td>
              <td className="px-4 py-2.5">
                {r.succeeded ? (
                  <span className="text-green-700">Hoàn tất</span>
                ) : (
                  // Một lần xuất hỏng giữa chừng vẫn là dữ liệu đã rời hệ thống
                  // một phần — phải nhìn ra được, không gộp chung với thành công.
                  <span className="text-red-700" title={r.errorText ?? undefined}>
                    Hỏng giữa chừng
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ExportHistoryPanel;
