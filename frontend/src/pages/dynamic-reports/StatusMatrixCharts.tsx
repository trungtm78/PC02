/**
 * S20 charts (PR8 slice 6) — collapsible section under the matrix table.
 * Bar chart "theo đơn vị" (one bar per team, summed across the periods
 * shown) + trend line "xu hướng giữa các kỳ" (one point per period, summed
 * across teams). Both computed client-side from the matrix already fetched
 * by `StatusMatrixPanel` (`statusChartData.ts`) — no extra request.
 *
 * "Không dùng donut" (spec) — bar + line only. Tooltip shows tử/mẫu
 * ("X/Y kỳ" / "X/Y tổ"), not just the percentage, per spec §6.1.
 */
import { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { StatusMatrixView } from '@/features/dynamic-reports/types';
import { computeTeamBarData, computePeriodTrendData } from './statusChartData';
import { A11Y_FOCUS_RING } from '@/constants/styles';

function TeamBarTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ReturnType<typeof computeTeamBarData>[number] }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded px-2 py-1 text-xs shadow">
      <p className="font-medium">{d.teamName}</p>
      <p>
        Đã nộp/duyệt: {d.completed}/{d.total} kỳ
      </p>
    </div>
  );
}

function PeriodTrendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ReturnType<typeof computePeriodTrendData>[number] }> }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded px-2 py-1 text-xs shadow">
      <p className="font-medium">{d.periodKey}</p>
      <p>
        Đã nộp/duyệt: {d.completed}/{d.total} tổ
      </p>
    </div>
  );
}

export default function StatusMatrixCharts({ matrix }: { matrix: StatusMatrixView }) {
  const [collapsed, setCollapsed] = useState(false);
  const teamBarData = computeTeamBarData(matrix);
  const periodTrendData = computePeriodTrendData(matrix);

  return (
    <div className="mt-6" data-testid="status-matrix-charts">
      <button
        type="button"
        data-testid="btn-toggle-charts"
        onClick={() => setCollapsed((c) => !c)}
        className={`flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-2 ${A11Y_FOCUS_RING}`}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        Biểu đồ
      </button>

      {!collapsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="status-matrix-charts-body">
          <div className="rounded-lg border border-slate-200 p-4" data-testid="chart-team-bar">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Theo đơn vị</h3>
            {teamBarData.length === 0 ? (
              <p className="text-xs text-slate-500">Không có tổ nào để hiện.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={teamBarData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="teamName" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<TeamBarTooltip />} />
                  <Bar dataKey="rate" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 p-4" data-testid="chart-period-trend">
            <h3 className="text-sm font-medium text-slate-700 mb-2">Xu hướng giữa các kỳ</h3>
            {periodTrendData.length === 0 ? (
              <p className="text-xs text-slate-500">Không có kỳ nào để hiện.</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={periodTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="periodKey" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<PeriodTrendTooltip />} />
                  <Line type="monotone" dataKey="rate" stroke="#2563eb" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
