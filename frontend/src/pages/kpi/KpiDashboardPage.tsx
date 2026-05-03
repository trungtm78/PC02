import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type KpiStatus = 'PASS' | 'FAIL' | 'WARNING' | 'N_A';

interface KpiResult {
  kpi: 1 | 2 | 3 | 4;
  label: string;
  target: number;
  value: number;
  status: KpiStatus;
  numerator: number;
  denominator: number;
  noData: boolean;
}

interface KpiSummary {
  period: { year: number; quarter?: number; month?: number };
  kpi1: KpiResult;
  kpi2: KpiResult;
  kpi3: KpiResult;
  kpi4: KpiResult;
}

interface KpiTrendPoint {
  year: number;
  month: number;
  kpi1: number;
  kpi2: number;
  kpi3: number;
  kpi4: number;
}

interface TeamKpi {
  team: { id: string; name: string; code: string; level: number; parentId: string | null };
  summary: KpiSummary;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<KpiStatus, string> = {
  PASS: 'bg-green-100 text-green-800 border-green-300',
  WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  FAIL: 'bg-red-100 text-red-800 border-red-300',
  N_A: 'bg-gray-100 text-gray-500 border-gray-300',
};

const STATUS_LABEL: Record<KpiStatus, string> = {
  PASS: 'Đạt',
  WARNING: 'Cảnh báo',
  FAIL: 'Chưa đạt',
  N_A: 'Chưa có dữ liệu',
};

const MONTH_LABELS = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];

function KpiCard({ result }: { result: KpiResult }) {
  return (
    <div className={`rounded-lg border-2 p-4 ${STATUS_COLOR[result.status]}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-70 mb-1">
        KPI-{result.kpi}
      </div>
      <div className="text-2xl font-bold mb-1">
        {result.noData ? '—' : `${result.value}%`}
      </div>
      <div className="text-sm font-medium mb-2 leading-tight">{result.label}</div>
      <div className="flex items-center justify-between text-xs">
        <span>Mục tiêu: {result.target === 100 ? '100%' : `>${result.target}%`}</span>
        <span className="font-semibold px-1.5 py-0.5 rounded bg-white/50">
          {STATUS_LABEL[result.status]}
        </span>
      </div>
      {!result.noData && (
        <div className="text-xs mt-1 opacity-70">
          {result.numerator}/{result.denominator} vụ
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, value }: { status: KpiStatus; value: number }) {
  if (status === 'N_A') return <span className="text-gray-400 text-sm">N/A</span>;
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${STATUS_COLOR[status]} border rounded px-1.5 py-0.5`}>
      {value}%
      {status === 'PASS' && ' ✓'}
      {status === 'WARNING' && ' ⚠'}
      {status === 'FAIL' && ' ✗'}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KpiDashboardPage() {
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState<number | ''>('');
  const [month, setMonth] = useState<number | ''>('');

  const [summary, setSummary] = useState<KpiSummary | null>(null);
  const [teamKpis, setTeamKpis] = useState<TeamKpi[]>([]);
  const [trend, setTrend] = useState<KpiTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const buildParams = useCallback(() => {
    const params: Record<string, string> = { year: String(year) };
    if (month) params.month = String(month);
    else if (quarter) params.quarter = String(quarter);
    return new URLSearchParams(params).toString();
  }, [year, quarter, month]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildParams();
      const [summaryRes, teamRes, trendRes] = await Promise.all([
        api.get(`/kpi/summary?${qs}`),
        api.get(`/kpi/by-team?${qs}`),
        api.get(`/kpi/trend?year=${year}`),
      ]);
      setSummary(summaryRes.data);
      setTeamKpis(teamRes.data);
      setTrend(trendRes.data);
    } catch {
      setSummary(null);
      setTeamKpis([]);
      setTrend([]);
    } finally {
      setLoading(false);
    }
  }, [buildParams, year]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const trendChartData = trend.map((pt) => ({
    name: MONTH_LABELS[pt.month - 1],
    'KPI-1': pt.kpi1,
    'KPI-2': pt.kpi2,
    'KPI-3': pt.kpi3,
    'KPI-4': pt.kpi4,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Chỉ tiêu KPI Công tác Điều tra</h1>
      </div>

      {/* Period selector */}
      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="text-sm font-medium text-gray-600 mr-1">Năm</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setQuarter(''); setMonth(''); }}
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 mr-1">Quý</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={quarter}
            onChange={(e) => { setQuarter(e.target.value ? Number(e.target.value) : ''); setMonth(''); }}
          >
            <option value="">Cả năm</option>
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-600 mr-1">Tháng</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={month}
            onChange={(e) => { setMonth(e.target.value ? Number(e.target.value) : ''); setQuarter(''); }}
          >
            <option value="">Tất cả</option>
            {MONTH_LABELS.map((label, i) => <option key={i + 1} value={i + 1}>{label}</option>)}
          </select>
        </div>
      </div>

      {loading && <div className="text-gray-500 text-sm">Đang tải...</div>}

      {/* 4 KPI cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard result={summary.kpi1} />
          <KpiCard result={summary.kpi2} />
          <KpiCard result={summary.kpi3} />
          <KpiCard result={summary.kpi4} />
        </div>
      )}

      {/* Team breakdown table */}
      {teamKpis.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Theo Tổ</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Tổ</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">KPI-1 Thụ lý</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">KPI-2 Giải quyết</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">KPI-3 Khám phá</th>
                  <th className="text-center px-3 py-2 font-medium text-gray-600">KPI-4 Án NT/ĐBNT</th>
                </tr>
              </thead>
              <tbody>
                {teamKpis.map(({ team, summary: s }) => (
                  <tr key={team.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{team.name}</td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={s.kpi1.status} value={s.kpi1.value} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={s.kpi2.status} value={s.kpi2.value} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={s.kpi3.status} value={s.kpi3.value} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={s.kpi4.status} value={s.kpi4.value} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trend chart */}
      {trendChartData.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Xu hướng 12 tháng ({year})</h2>
          <div className="rounded-lg border p-4">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend />
                <Line type="monotone" dataKey="KPI-1" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="KPI-2" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="KPI-3" stroke="#9333ea" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="KPI-4" stroke="#dc2626" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
