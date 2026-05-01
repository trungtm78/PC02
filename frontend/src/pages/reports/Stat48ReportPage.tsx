import { useState, useCallback } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, FileSpreadsheet, Search } from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FieldStat {
  fieldIndex: number;
  fieldName: string;
  fieldType: 'numeric' | 'categorical';
  // numeric
  total?: number;
  count?: number;
  missing?: number;
  // categorical
  distribution?: Array<{ value: string; count: number }>;
  totalCount?: number;
  missingCount?: number;
}

interface GroupStat {
  groupIndex: number;
  groupName: string;
  fields: FieldStat[];
}

interface Stat48Response {
  fromDate: string;
  toDate: string;
  unit?: string;
  totalCases: number;
  casesWithData: number;
  casesWithoutData: number;
  missingPercent: number;
  isDraft: boolean;
  groups: GroupStat[];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const toISO = (d: Date) => d.toISOString().split('T')[0];

// ─── Sub-components ───────────────────────────────────────────────────────────

function NumericRow({ field }: { field: FieldStat }) {
  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="py-2 px-4 text-sm text-slate-700 font-medium">
        <span className="text-slate-400 mr-2">{field.fieldIndex}.</span>
        {field.fieldName}
      </td>
      <td className="py-2 px-4 text-sm text-center text-blue-700 font-semibold">
        {(field.total ?? 0).toLocaleString('vi-VN')}
      </td>
      <td className="py-2 px-4 text-sm text-center text-slate-600">
        {field.count ?? 0}
      </td>
      <td className="py-2 px-4 text-sm text-center">
        {(field.missing ?? 0) > 0 ? (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
            {field.missing}
          </span>
        ) : (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">0</span>
        )}
      </td>
    </tr>
  );
}

function CategoricalRow({ field }: { field: FieldStat }) {
  const [showAll, setShowAll] = useState(false);
  const dist = field.distribution ?? [];
  const visible = showAll ? dist : dist.slice(0, 3);

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="py-2 px-4 text-sm text-slate-700 font-medium">
        <span className="text-slate-400 mr-2">{field.fieldIndex}.</span>
        {field.fieldName}
      </td>
      <td className="py-2 px-4 text-sm" colSpan={2}>
        <div className="flex flex-wrap gap-1">
          {visible.map((v, i) => (
            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
              {v.value}
              <span className="bg-blue-200 text-blue-800 rounded px-1">{v.count}</span>
            </span>
          ))}
          {dist.length > 3 && (
            <button
              onClick={() => setShowAll(s => !s)}
              className="text-xs text-blue-500 hover:underline ml-1"
            >
              {showAll ? 'Thu gọn' : `Xem thêm ${dist.length - 3}`}
            </button>
          )}
        </div>
      </td>
      <td className="py-2 px-4 text-sm text-center">
        {(field.missingCount ?? 0) > 0 ? (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
            {field.missingCount}
          </span>
        ) : (
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">0</span>
        )}
      </td>
    </tr>
  );
}

function GroupAccordion({
  group,
  open,
  onToggle,
}: {
  group: GroupStat;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown className="w-4 h-4 text-slate-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-500" />
          )}
          <span className="font-semibold text-slate-800">
            Nhóm {group.groupIndex}: {group.groupName}
          </span>
          <span className="text-xs text-slate-500">({group.fields.length} trường)</span>
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-2 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Trường</th>
                <th className="text-center py-2 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wide w-28">Tổng / Phân bổ</th>
                <th className="text-center py-2 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wide w-20">Số lượng</th>
                <th className="text-center py-2 px-4 text-xs font-semibold text-slate-600 uppercase tracking-wide w-24">Thiếu dữ liệu</th>
              </tr>
            </thead>
            <tbody>
              {group.fields.map(field =>
                field.fieldType === 'numeric' ? (
                  <NumericRow key={field.fieldIndex} field={field} />
                ) : (
                  <CategoricalRow key={field.fieldIndex} field={field} />
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Stat48ReportPage() {
  const [fromDate, setFromDate] = useState(toISO(firstOfMonth));
  const [toDate, setToDate] = useState(toISO(today));
  const [unit, setUnit] = useState('');
  const [reportData, setReportData] = useState<Stat48Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  // All 4 groups open by default (indices 1-4)
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set([1, 2, 3, 4]));

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = { fromDate, toDate, format: 'json' };
      if (unit) params.unit = unit;
      const res = await api.get('/reports/stat48', { params });
      setReportData(res.data);
    } catch {
      setError('Không thể tải dữ liệu. Vui lòng thử lại.');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, unit]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const params: Record<string, string> = { fromDate, toDate, format: 'excel' };
      if (unit) params.unit = unit;
      const response = await api.get('/reports/stat48', { params, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Stat48_${fromDate}_${toDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Xuất thất bại. Vui lòng thử lại.');
    } finally {
      setIsExporting(false);
    }
  };

  const toggleGroup = (idx: number) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Thống kê 48 trường — Biểu mẫu PC02/BCA</h1>
        <p className="text-slate-500 text-sm mt-1">Tổng hợp dữ liệu thống kê vụ án theo 48 tiêu chí của BCA</p>
      </div>

      {/* Filter bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Từ ngày</label>
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Đến ngày</label>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Đơn vị</label>
            <input
              type="text"
              value={unit}
              onChange={e => setUnit(e.target.value)}
              placeholder="Tất cả đơn vị"
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#003973] w-44"
            />
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#003973] text-white rounded-lg text-sm hover:bg-[#0052a3] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Đang tải...' : 'Xem thống kê'}
          </button>
          <button
            onClick={handleExportExcel}
            disabled={isExporting || !reportData}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Draft warning banner */}
      {reportData?.isDraft && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <span className="font-semibold">{reportData.missingPercent.toFixed(1)}% hồ sơ chưa có dữ liệu Tab 9</span>
            {' '}— kết quả chưa đầy đủ. File Excel sẽ được đánh dấu <span className="font-mono font-bold">DRAFT</span>.
          </p>
        </div>
      )}

      {/* Stats cards */}
      {reportData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <p className="text-sm text-slate-500 mb-1">Tổng vụ án</p>
            <p className="text-3xl font-bold text-slate-800">{reportData.totalCases.toLocaleString('vi-VN')}</p>
          </div>
          <div className="bg-white border border-green-200 rounded-lg p-5">
            <p className="text-sm text-green-600 font-medium mb-1">Có dữ liệu</p>
            <p className="text-3xl font-bold text-green-700">{reportData.casesWithData.toLocaleString('vi-VN')}</p>
          </div>
          <div className="bg-white border border-amber-200 rounded-lg p-5">
            <p className="text-sm text-amber-600 font-medium mb-1">
              Thiếu dữ liệu
              {reportData.casesWithoutData > 0 && (
                <span className="ml-1 text-amber-500">({reportData.missingPercent.toFixed(1)}%)</span>
              )}
            </p>
            <p className="text-3xl font-bold text-amber-700">{reportData.casesWithoutData.toLocaleString('vi-VN')}</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-[#003973] border-t-transparent rounded-full animate-spin" />
          <span className="ml-3 text-slate-500">Đang tải dữ liệu thống kê...</span>
        </div>
      )}

      {/* Accordion groups */}
      {!loading && reportData && (
        <div className="space-y-3">
          {reportData.groups.map(group => (
            <GroupAccordion
              key={group.groupIndex}
              group={group}
              open={openGroups.has(group.groupIndex)}
              onToggle={() => toggleGroup(group.groupIndex)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !reportData && !error && (
        <div className="bg-white border border-slate-200 rounded-lg p-16 text-center">
          <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Chưa có dữ liệu</p>
          <p className="text-sm text-slate-400 mt-1">Chọn khoảng thời gian và nhấn "Xem thống kê"</p>
        </div>
      )}
    </div>
  );
}
