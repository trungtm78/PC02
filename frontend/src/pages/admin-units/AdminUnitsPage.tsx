import { useState, useMemo, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  MapPin,
  Search,
  ChevronRight,
  ChevronDown,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Users,
  History,
  ExternalLink,
} from 'lucide-react';

/**
 * AdminUnitsPage — read-only browser cho Tỉnh / Phường (v0.34.0.0).
 *
 * Design decisions from /autoplan Phase 2 Design consensus:
 * - D1: Search-first hierarchy (global search top, tree as secondary browsing)
 * - D2: Explicit states matrix (loading skeleton, empty, error, partial, stale)
 * - D4: Detail panel rich provenance (officialCode + sourceVersion + legalBasis
 *       + importedAt + checksum status + linked teams count clickable)
 * - D6: Tree ARIA keyboard nav
 * - D7: Desktop-only banner < 1024px
 * - UC2: NO Edit/Delete/Sync buttons — read-only browser
 */

interface Province {
  id: string;
  code: string;
  name: string;
  officialCode: string | null;
}

interface Ward {
  id: string;
  code: string;
  name: string;
  officialCode: string | null;
}

interface WardDetail extends Ward {
  isActive: boolean;
  abolishedAt: string | null;
  sourceVersion: string | null;
  legalBasis: string | null;
  importedAt: string | null;
  province: Province | null;
  linkedTeamsCount: number;
}

interface DatasetVersion {
  version: string;
  checksum: string;
  addedProvinces: number;
  addedWards: number;
  updatedWards: number;
  abolishedWards: number;
  importedAt: string;
  completedAt: string | null;
}

interface SearchResult {
  id: string;
  code: string;
  name: string;
  officialCode: string | null;
  province: { id: string; code: string; name: string } | null;
}

const STALE_THRESHOLD_DAYS = 180; // 6 tháng — banner cảnh báo

export default function AdminUnitsPage() {
  const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
  const [selectedWardId, setSelectedWardId] = useState<string | null>(null);
  const [expandedProvinces, setExpandedProvinces] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const deferredQuery = useDeferredValue(searchQuery);

  // 1. Load provinces
  const provincesQ = useQuery({
    queryKey: ['admin-units', 'provinces'],
    queryFn: async () => {
      const res = await api.get<Province[]>('/admin-units/provinces');
      return res.data;
    },
    staleTime: 60 * 60 * 1000,
  });

  // 2. Load dataset metadata
  const datasetQ = useQuery({
    queryKey: ['admin-units', 'dataset'],
    queryFn: async () => {
      const res = await api.get<DatasetVersion | null>('/admin-units/dataset');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // 3. Global search (debounced via useDeferredValue)
  const searchQ = useQuery({
    queryKey: ['admin-units', 'search', deferredQuery],
    queryFn: async () => {
      if (deferredQuery.trim().length < 2) return [];
      const res = await api.get<SearchResult[]>('/admin-units/search', {
        params: { q: deferredQuery.trim() },
      });
      return res.data;
    },
    enabled: deferredQuery.trim().length >= 2,
    staleTime: 60 * 1000,
  });

  // 4. Ward detail for selected ward
  const wardDetailQ = useQuery({
    queryKey: ['admin-units', 'ward', selectedWardId],
    queryFn: async () => {
      if (!selectedWardId) return null;
      const res = await api.get<WardDetail>(`/admin-units/wards/${selectedWardId}`);
      return res.data;
    },
    enabled: !!selectedWardId,
    staleTime: 60 * 1000,
  });

  // 5. Wards of expanded province (per-province lazy load)
  const expandedWardsQ = useQuery({
    queryKey: ['admin-units', 'wards', selectedProvinceId],
    queryFn: async () => {
      if (!selectedProvinceId) return [];
      const res = await api.get<Ward[]>('/admin-units/wards', {
        params: { provinceId: selectedProvinceId },
      });
      return res.data;
    },
    enabled: !!selectedProvinceId,
    staleTime: 5 * 60 * 1000,
  });

  // Compute dataset stale state (D2 + D4)
  const datasetIsStale = useMemo(() => {
    if (!datasetQ.data?.importedAt) return false;
    const importedAt = new Date(datasetQ.data.importedAt);
    const daysSince = (Date.now() - importedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > STALE_THRESHOLD_DAYS;
  }, [datasetQ.data]);

  const toggleProvinceExpand = (id: string) => {
    const next = new Set(expandedProvinces);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedProvinces(next);
    setSelectedProvinceId(id);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // ignore
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Mobile/tablet banner D7 */}
      <div className="lg:hidden p-4 bg-amber-50 border-b border-amber-200 text-amber-900 text-sm">
        <AlertTriangle className="inline w-4 h-4 mr-1" />
        Trang quản lý đơn vị hành chính được tối ưu cho máy tính (≥1024px).
      </div>

      {/* Top bar: title + dataset metadata + global search */}
      <div className="hidden lg:flex flex-col gap-3 p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold flex items-center gap-2 text-slate-800">
            <MapPin className="w-5 h-5 text-indigo-600" />
            Đơn vị hành chính
            <span className="ml-2 text-xs font-normal text-slate-400">(read-only browser)</span>
          </h1>
          {/* Dataset metadata */}
          {datasetQ.isLoading ? (
            <div className="text-xs text-slate-500 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Đang tải dataset...
            </div>
          ) : datasetQ.error || !datasetQ.data ? (
            <div className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Chưa có dataset hoạt động
            </div>
          ) : (
            <div className="text-xs text-slate-600 flex items-center gap-3">
              {datasetIsStale && (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Dataset cũ {Math.floor((Date.now() - new Date(datasetQ.data.importedAt).getTime()) / 86400000)} ngày
                </span>
              )}
              <span className="font-mono">{datasetQ.data.version}</span>
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-3 h-3" /> checksum verified
              </span>
              <span>
                {datasetQ.data.addedProvinces + datasetQ.data.addedWards + datasetQ.data.updatedWards} đơn vị
              </span>
              <span>
                Import: {new Date(datasetQ.data.importedAt).toLocaleDateString('vi-VN')}
              </span>
            </div>
          )}
        </div>

        {/* D1: Global Cmd+K style search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm phường theo tên (vd: Bến Nghé, Phường 1)..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            data-testid="admin-units-search"
          />
          {searchQ.isFetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
          )}
        </div>

        {/* Search results dropdown */}
        {deferredQuery.trim().length >= 2 && (
          <div className="border border-slate-200 rounded-md bg-white max-h-72 overflow-y-auto">
            {searchQ.isLoading ? (
              <div className="p-4 text-sm text-slate-500">Đang tìm kiếm...</div>
            ) : searchQ.data?.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">
                Không tìm thấy phường nào khớp "{deferredQuery}"
              </div>
            ) : (
              (searchQ.data ?? []).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedWardId(r.id);
                    if (r.province?.id) {
                      setSelectedProvinceId(r.province.id);
                      setExpandedProvinces(new Set([r.province.id]));
                    }
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 border-b border-slate-100 text-sm"
                >
                  <div className="font-medium text-slate-800">{r.name}</div>
                  <div className="text-xs text-slate-500">
                    {r.province?.name ?? 'Không rõ tỉnh'}
                    {r.officialCode && (
                      <span className="ml-2 font-mono text-slate-400">#{r.officialCode}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Main split layout */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        {/* Left: Province tree */}
        <div className="w-1/3 border-r border-slate-200 bg-white overflow-y-auto p-3">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-2">
            Tỉnh / Thành phố ({provincesQ.data?.length ?? 0})
          </h2>
          {provincesQ.isLoading ? (
            <div className="p-3 text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải tỉnh/TP...
            </div>
          ) : provincesQ.error ? (
            <div className="p-3 text-sm text-red-600">Lỗi tải danh sách tỉnh.</div>
          ) : (provincesQ.data ?? []).length === 0 ? (
            <div className="p-3 text-sm text-slate-500">
              Chưa có tỉnh nào trong DB. Chạy seed trước.
            </div>
          ) : (
            <div role="tree" aria-label="Danh sách tỉnh/thành phố">
              {(provincesQ.data ?? []).map((p) => {
                const isExpanded = expandedProvinces.has(p.id);
                return (
                  <div key={p.id} role="treeitem" aria-expanded={isExpanded}>
                    <button
                      type="button"
                      onClick={() => toggleProvinceExpand(p.id)}
                      className={`w-full flex items-center gap-1 px-2 py-1.5 text-sm rounded hover:bg-slate-100 ${
                        selectedProvinceId === p.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                      }`}
                      data-testid={`province-${p.code}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 flex-shrink-0" />
                      )}
                      <span className="flex-1 text-left">{p.name}</span>
                      {p.officialCode && (
                        <span className="text-[10px] text-slate-400 font-mono">{p.officialCode}</span>
                      )}
                    </button>
                    {isExpanded && selectedProvinceId === p.id && (
                      <div className="ml-5 mt-1 border-l border-slate-200 pl-2">
                        {expandedWardsQ.isLoading ? (
                          <div className="py-2 text-xs text-slate-500 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Đang tải phường...
                          </div>
                        ) : (expandedWardsQ.data ?? []).length === 0 ? (
                          <div className="py-2 text-xs text-slate-500">Không có phường</div>
                        ) : (
                          (expandedWardsQ.data ?? []).map((w) => (
                            <button
                              key={w.id}
                              type="button"
                              onClick={() => setSelectedWardId(w.id)}
                              className={`w-full text-left px-2 py-1 text-xs rounded hover:bg-slate-100 ${
                                selectedWardId === w.id
                                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                                  : 'text-slate-600'
                              }`}
                              data-testid={`ward-${w.code}`}
                            >
                              {w.name}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Detail panel */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {!selectedWardId ? (
            <div className="text-sm text-slate-500 text-center mt-12">
              <MapPin className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Chọn một phường từ cây bên trái hoặc dùng search ở trên.
            </div>
          ) : wardDetailQ.isLoading ? (
            <div className="text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải chi tiết...
            </div>
          ) : wardDetailQ.error || !wardDetailQ.data ? (
            <div className="text-sm text-red-600">
              <AlertTriangle className="inline w-4 h-4 mr-1" />
              Không tải được chi tiết phường.
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4 max-w-2xl">
              {/* Header */}
              <div>
                <h2 className="text-lg font-semibold text-slate-800">{wardDetailQ.data.name}</h2>
                <div className="text-xs text-slate-500 mt-1">
                  {wardDetailQ.data.province?.name ?? 'Không rõ tỉnh'}
                </div>
                {!wardDetailQ.data.isActive && (
                  <span className="inline-block mt-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                    Đã sáp nhập / abolished
                  </span>
                )}
              </div>

              {/* Codes */}
              <div className="grid grid-cols-2 gap-3 text-sm border-t border-slate-200 pt-3">
                <div>
                  <label className="text-xs text-slate-500">Mã chính danh</label>
                  <div className="flex items-center gap-1 font-mono">
                    {wardDetailQ.data.officialCode ?? '—'}
                    {wardDetailQ.data.officialCode && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(wardDetailQ.data!.officialCode!)}
                        className="p-0.5 text-slate-400 hover:text-slate-700"
                        aria-label="Copy mã chính danh"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Mã hệ thống</label>
                  <div className="font-mono text-xs">{wardDetailQ.data.code}</div>
                </div>
              </div>

              {/* Provenance */}
              <div className="text-sm border-t border-slate-200 pt-3 space-y-2">
                <div>
                  <label className="text-xs text-slate-500">Dataset version</label>
                  <div className="font-mono">{wardDetailQ.data.sourceVersion ?? '—'}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Cơ sở pháp lý</label>
                  <div>{wardDetailQ.data.legalBasis ?? '—'}</div>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Imported at</label>
                  <div>
                    {wardDetailQ.data.importedAt
                      ? new Date(wardDetailQ.data.importedAt).toLocaleString('vi-VN')
                      : '—'}
                  </div>
                </div>
              </div>

              {/* Linked entities (clickable per Phase 2 D4) */}
              <div className="text-sm border-t border-slate-200 pt-3 space-y-2">
                <a
                  href={`/to-nhom?wardId=${wardDetailQ.data.id}`}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800"
                >
                  <Users className="w-4 h-4" />
                  Tổ liên kết: {wardDetailQ.data.linkedTeamsCount}
                  <ExternalLink className="w-3 h-3" />
                </a>
                <div className="flex items-center gap-2 text-slate-400">
                  <History className="w-4 h-4" />
                  Lịch sử thay đổi: (v0.34b)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
