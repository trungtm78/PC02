import { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  FilePlus,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  PieChart,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { authStore } from '@/stores/auth.store';
import { api } from '@/lib/api';

const COLORS = {
  navy: '#1B2B4E',
  gold: '#D4AF37',
  slate: '#64748B',
  chart: ['#1B2B4E', '#D4AF37', '#64748B', '#10B981', '#F59E0B', '#EF4444'],
};

interface DashboardStats {
  totalCases: number;
  newCases: number;
  overdueCases: number;
  processedCases: number;
  totalIncidents: number;
  totalPetitions: number;
}

interface TrendData {
  month: string;
  cases: number;
  incidents: number;
  petitions: number;
}

interface StructureData {
  name: string;
  value: number;
}

interface DashboardCharts {
  trends: TrendData[];
  structure: StructureData[];
}

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  testId: string;
  loading?: boolean;
}

function StatCard({ title, value, icon, color, testId, loading }: StatCardProps) {
  return (
    <div
      className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow"
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          {loading ? (
            <div className="h-9 w-16 bg-slate-100 animate-pulse rounded mt-2" />
          ) : (
            <p className="text-3xl font-bold text-slate-900 mt-2" data-testid={`${testId}-value`}>
              {value.toLocaleString('vi-VN')}
            </p>
          )}
        </div>
        <div className="p-3 rounded-full" style={{ backgroundColor: `${color}15` }}>
          <div style={{ color }}>{icon}</div>
        </div>
      </div>
    </div>
  );
}

// Empty State Component for Charts
function EmptyChartState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400">
      <PieChart className="w-12 h-12 mb-2 opacity-50" />
      <p>{message}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [charts, setCharts] = useState<DashboardCharts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const user = authStore.getUser();

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, chartsRes] = await Promise.all([
        api.get<{ success: boolean; data: DashboardStats }>('/dashboard/stats'),
        api.get<{ success: boolean; data: DashboardCharts }>('/dashboard/charts'),
      ]);
      setStats(statsRes.data.data);
      setCharts(chartsRes.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể tải dữ liệu dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const statCards = [
    {
      title: 'Tổng hồ sơ',
      value: stats?.totalCases ?? 0,
      icon: <FolderOpen className="w-6 h-6" />,
      color: COLORS.navy,
      testId: 'stat-total-cases',
    },
    {
      title: 'Hồ sơ mới',
      value: stats?.newCases ?? 0,
      icon: <FilePlus className="w-6 h-6" />,
      color: COLORS.gold,
      testId: 'stat-new-cases',
    },
    {
      title: 'Quá hạn',
      value: stats?.overdueCases ?? 0,
      icon: <AlertCircle className="w-6 h-6" />,
      color: '#EF4444',
      testId: 'stat-overdue-cases',
    },
    {
      title: 'Đã xử lý',
      value: stats?.processedCases ?? 0,
      icon: <CheckCircle2 className="w-6 h-6" />,
      color: '#10B981',
      testId: 'stat-processed-cases',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-5 h-5" style={{ color: COLORS.navy }} />
          <span className="font-semibold text-slate-900">Tổng quan hệ thống</span>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <span className="text-sm text-slate-600">
              {user.email}{' '}
              <span
                className="ml-1 inline-block px-2 py-0.5 text-xs rounded-full font-medium"
                style={{ backgroundColor: `${COLORS.gold}20`, color: COLORS.navy }}
              >
                {user.role}
              </span>
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            disabled={loading}
            data-testid="refresh-btn"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Làm mới
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Tổng quan</h2>
          <p className="text-slate-500">Chào mừng trở lại! Dưới đây là thống kê hồ sơ vụ án.</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card, index) => (
            <StatCard
              key={index}
              title={card.title}
              value={card.value}
              icon={card.icon}
              color={card.color}
              testId={card.testId}
              loading={loading}
            />
          ))}
        </div>

        {/* Extra stats row */}
        {!loading && stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
            <StatCard
              title="Tổng vụ việc"
              value={stats.totalIncidents}
              icon={<FolderOpen className="w-6 h-6" />}
              color="#6366F1"
              testId="stat-total-incidents"
            />
            <StatCard
              title="Tổng đơn thư"
              value={stats.totalPetitions}
              icon={<FilePlus className="w-6 h-6" />}
              color="#0EA5E9"
              testId="stat-total-petitions"
            />
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart - Trends */}
          <div
            className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm"
            data-testid="chart-trends"
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Xu hướng theo tháng</h3>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : charts?.trends && charts.trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={charts.trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" stroke={COLORS.slate} fontSize={12} />
                  <YAxis stroke={COLORS.slate} fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name?: string) => {
                      const labels: Record<string, string> = { cases: 'Vụ án', incidents: 'Vụ việc', petitions: 'Đơn thư' };
                      return [value, labels[name ?? ''] ?? name ?? ''];
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cases"
                    stroke={COLORS.navy}
                    strokeWidth={2}
                    dot={{ fill: COLORS.gold, strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: COLORS.gold }}
                  />
                  <Line type="monotone" dataKey="incidents" stroke="#6366F1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="petitions" stroke="#0EA5E9" strokeWidth={2} dot={false} />
                  <Legend formatter={(value: string) => ({ cases: 'Vụ án', incidents: 'Vụ việc', petitions: 'Đơn thư' } as Record<string, string>)[value] ?? value} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="Chưa có dữ liệu xu hướng" />
            )}
          </div>

          {/* Pie Chart - Case Status */}
          <div
            className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm"
            data-testid="chart-structure"
          >
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Cơ cấu trạng thái vụ án</h3>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : charts?.structure && charts.structure.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RePieChart>
                  <Pie
                    data={charts.structure}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ percent }: { percent?: number }) => (percent ?? 0) > 0.05 ? `${((percent ?? 0) * 100).toFixed(0)}%` : ''}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {charts.structure.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.chart[index % COLORS.chart.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any, name?: string) => [value, name ?? '']}
                  />
                  <Legend />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState message="Chưa có dữ liệu cơ cấu" />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
