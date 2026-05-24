import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  Mail,
  AlertTriangle,
  AlertCircle,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useJourneySearch, type EntitySearchResult, type EntitySearchType } from './useJourneySearch';
import type { TimelineEntityType } from '@/components/HoSoJourney/useCaseJourney';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectedEntity {
  type: TimelineEntityType;
  id: string;
  stt: string;
  name?: string;
}

interface JourneyNavigatorProps {
  selected: SelectedEntity | null;
  onSelect: (entity: SelectedEntity) => void;
}

interface EntityGroup {
  type: EntitySearchType;
  label: string;
  icon: React.ReactNode;
  queryKey: string;
  apiPath: string;
}

const ENTITY_GROUPS: EntityGroup[] = [
  { type: 'CASE', label: 'Vụ việc', icon: <FileText className="w-3 h-3" />, queryKey: 'journey-nav-cases', apiPath: '/cases?limit=20' },
  { type: 'INCIDENT', label: 'Vụ án', icon: <AlertTriangle className="w-3 h-3" />, queryKey: 'journey-nav-incidents', apiPath: '/incidents?limit=20' },
  { type: 'PETITION', label: 'Đơn thư', icon: <Mail className="w-3 h-3" />, queryKey: 'journey-nav-petitions', apiPath: '/petitions?limit=20' },
];

const ENTITY_ICON_CLASS: Record<EntitySearchType, string> = {
  CASE: 'text-blue-600',
  INCIDENT: 'text-orange-600',
  PETITION: 'text-violet-600',
};

// ─── Group ────────────────────────────────────────────────────────────────────

function GroupSection({
  group,
  selected,
  onSelect,
}: {
  group: EntityGroup;
  selected: SelectedEntity | null;
  onSelect: (entity: SelectedEntity) => void;
}) {
  const [open, setOpen] = useState(group.type === 'CASE');
  const [loadMore, setLoadMore] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<any[]>({
    queryKey: [group.queryKey, loadMore],
    queryFn: async () => {
      const limit = loadMore ? 50 : 20;
      const res = await api.get(group.apiPath.replace('limit=20', `limit=${limit}`));
      return res.data?.data ?? res.data ?? [];
    },
    staleTime: 60 * 1000,
  });

  const items = data ?? [];

  return (
    <div>
      <button
        role="button"
        aria-expanded={open}
        aria-controls={`group-${group.type}-list`}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:bg-gray-50 rounded"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <span>{group.label}</span>
          <span className="bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5 text-xs">
            {isLoading ? '...' : items.length}
          </span>
        </div>
      </button>

      {open && (
        <div
          id={`group-${group.type}-list`}
          role="list"
          className="ml-2"
        >
          {isLoading && (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 px-3 py-2 animate-pulse">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                    <div className="h-3.5 bg-gray-200 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </>
          )}
          {isError && (
            <div className="px-3 py-2 flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="w-3 h-3" />
              <span>Lỗi tải danh sách</span>
              <button onClick={() => void refetch()} className="underline">Thử lại</button>
            </div>
          )}
          {!isLoading && !isError && items.map((item: any) => {
            const stt = item.stt ?? item.code ?? item.id;
            const name = item.name ?? item.description ?? '';
            const isSelected = selected?.id === item.id;
            return (
              <div
                key={item.id}
                role="listitem"
                aria-selected={isSelected}
                onClick={() => onSelect({ type: group.type as TimelineEntityType, id: item.id, stt, name })}
                className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer text-sm transition-colors min-h-[40px] focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isSelected
                    ? 'bg-blue-50 border-l-2 border-blue-600 text-blue-900 font-medium'
                    : 'hover:bg-gray-50 text-gray-700 border-l-2 border-transparent'
                }`}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect({ type: group.type as TimelineEntityType, id: item.id, stt, name });
                  }
                }}
              >
                <span className={`flex-shrink-0 ${ENTITY_ICON_CLASS[group.type]}`}>{group.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-500 font-mono truncate">{stt}</div>
                  {name && <div className="text-sm truncate">{name}</div>}
                </div>
              </div>
            );
          })}
          {!isLoading && !isError && items.length === 0 && (
            <div className="px-3 py-1 text-xs text-gray-400 italic">Không có dữ liệu</div>
          )}
          {!isLoading && !isError && items.length >= 20 && !loadMore && (
            <button
              onClick={() => setLoadMore(true)}
              className="w-full text-xs text-blue-600 hover:underline px-3 py-2 text-left"
            >
              Tải thêm...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Search Results ───────────────────────────────────────────────────────────

function SearchResultItem({
  result,
  selected,
  onSelect,
}: {
  result: EntitySearchResult;
  selected: SelectedEntity | null;
  onSelect: (entity: SelectedEntity) => void;
}) {
  const isSelected = selected?.id === result.id;
  const icon = result.entityType === 'CASE'
    ? <FileText className="w-3 h-3 text-blue-600" />
    : result.entityType === 'INCIDENT'
    ? <AlertTriangle className="w-3 h-3 text-orange-600" />
    : <Mail className="w-3 h-3 text-violet-600" />;

  return (
    <div
      role="listitem"
      aria-selected={isSelected}
      onClick={() => onSelect({ type: result.entityType as TimelineEntityType, id: result.id, stt: result.stt, name: result.name })}
      className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer min-h-[40px] focus-visible:ring-2 focus-visible:ring-blue-500 ${
        isSelected
          ? 'bg-blue-50 border-l-2 border-blue-600 text-blue-900 font-medium'
          : 'hover:bg-gray-50 text-gray-700 border-l-2 border-transparent'
      }`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect({ type: result.entityType as TimelineEntityType, id: result.id, stt: result.stt, name: result.name });
        }
      }}
    >
      <span className="flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-gray-500 font-mono truncate">{result.stt}</div>
        {result.name && <div className="text-sm truncate">{result.name}</div>}
      </div>
    </div>
  );
}

// ─── JourneyNavigator ─────────────────────────────────────────────────────────

export function JourneyNavigator({ selected, onSelect }: JourneyNavigatorProps) {
  const [query, setQuery] = useState('');
  const { results, isLoading: isSearchLoading } = useJourneySearch(query);

  const handleClearSearch = useCallback(() => setQuery(''), []);

  const isSearchMode = query.trim().length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <h1 className="text-base font-semibold text-gray-800 mb-3">Hành Trình Hồ Sơ</h1>

        {/* Search */}
        <div className="relative">
          {isSearchLoading
            ? <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            : <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          }
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm vụ việc, vụ án, đơn thư..."
            aria-label="Tìm kiếm hồ sơ"
            aria-live="polite"
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
          {query && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100"
              aria-label="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-3">
        {isSearchMode ? (
          /* Flat search results */
          <div role="list" className="px-1">
            {results.length === 0 && !isSearchLoading && (
              <div className="px-3 py-6 text-center">
                <p className="text-sm text-gray-400">Không tìm thấy kết quả cho "{query}"</p>
              </div>
            )}
            {results.map((r) => (
              <SearchResultItem key={`${r.entityType}-${r.id}`} result={r} selected={selected} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          /* Grouped tree */
          <div className="space-y-1 px-1">
            {ENTITY_GROUPS.map((group) => (
              <GroupSection key={group.type} group={group} selected={selected} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
