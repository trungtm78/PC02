/**
 * GlobalSearchBar — Thanh tìm kiếm toàn cục trong header
 *
 * Cách hoạt động:
 * - Người dùng gõ ≥ 2 ký tự → debounce 300ms → gọi song song 4 API:
 *     GET /cases?search=&limit=5
 *     GET /petitions?search=&limit=5
 *     GET /subjects?search=&limit=5
 *     GET /incidents?search=&limit=5
 * - Kết quả hiển thị dropdown nhóm theo loại (tối đa 4 kết quả mỗi loại)
 * - Click vào kết quả → navigate đến trang chi tiết/danh sách
 * - Nhấn Enter → navigate đến trang danh sách đầu tiên có kết quả với ?search=
 * - Nhấn Escape → đóng dropdown
 * - Click ngoài → đóng dropdown
 * - Loading spinner khi đang tìm kiếm
 * - Empty state khi không có kết quả
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Scale,
  FileText,
  Users,
  AlertTriangle,
  Loader2,
  X,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  label: string;       // tên hiển thị chính
  sublabel?: string;   // thông tin phụ (status, type…)
  href: string;        // URL navigate khi click
}

interface ResultGroup {
  key: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  results: SearchResult[];
  listHref: string;    // URL "Xem tất cả"
}

// ── API response shapes (chỉ những field cần thiết) ──────────────────────────

interface CaseItem {
  id: string;
  caseNumber?: string;
  caseName?: string;
  status?: string;
}

interface PetitionItem {
  id: string;
  stt?: string;
  senderName?: string;
  status?: string;
}

interface SubjectItem {
  id: string;
  fullName?: string;
  type?: string;
  subjectType?: string;
}

interface IncidentItem {
  id: string;
  incidentNumber?: string;
  incidentName?: string;
  status?: string;
}

// ── Status label helpers ──────────────────────────────────────────────────────

const CASE_STATUS: Record<string, string> = {
  DANG_DIEU_TRA: 'Đang điều tra',
  DA_KET_THUC: 'Đã kết thúc',
  TAM_DINH_CHI: 'Tạm đình chỉ',
  DINH_CHI: 'Đình chỉ',
  CHUYEN_VKS: 'Chuyển VKS',
  KHOI_TO: 'Khởi tố',
};

const PETITION_STATUS: Record<string, string> = {
  MOI_TIEP_NHAN: 'Mới tiếp nhận',
  DANG_XU_LY: 'Đang xử lý',
  DA_GIAI_QUYET: 'Đã giải quyết',
  DA_LUU_DON: 'Đã lưu đơn',
  DA_CHUYEN_VU_AN: 'Đã chuyển VA',
};

function caseLabel(c: CaseItem): string {
  return [c.caseNumber, c.caseName].filter(Boolean).join(' — ') || c.id;
}
function caseSublabel(c: CaseItem): string {
  return c.status ? (CASE_STATUS[c.status] ?? c.status) : '';
}
function petitionLabel(p: PetitionItem): string {
  return [p.stt, p.senderName].filter(Boolean).join(' — ') || p.id;
}
function petitionSublabel(p: PetitionItem): string {
  return p.status ? (PETITION_STATUS[p.status] ?? p.status) : '';
}
function subjectLabel(s: SubjectItem): string {
  return s.fullName || s.id;
}
function subjectSublabel(s: SubjectItem): string {
  const t = s.subjectType ?? s.type;
  if (t === 'BI_CAN') return 'Bị can';
  if (t === 'BI_HAI') return 'Bị hại';
  if (t === 'NHAN_CHUNG') return 'Nhân chứng';
  return t ?? '';
}
function incidentLabel(i: IncidentItem): string {
  return [i.incidentNumber, i.incidentName].filter(Boolean).join(' — ') || i.id;
}
function incidentSublabel(i: IncidentItem): string {
  return i.status ?? '';
}

// ── useDebounce hook ──────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GlobalSearchBar() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [groups, setGroups] = useState<ResultGroup[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query.trim(), 300);

  // ── Fan-out search ─────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setGroups([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);
    setActiveIndex(-1);

    try {
      const [casesRes, petitionsRes, subjectsRes, incidentsRes] = await Promise.allSettled([
        api.get<{ data: CaseItem[] }>('/cases', { params: { search: q, limit: 4 } }),
        api.get<{ data: PetitionItem[] }>('/petitions', { params: { search: q, limit: 4 } }),
        api.get<{ data: SubjectItem[] }>('/subjects', { params: { search: q, limit: 4 } }),
        api.get<{ data: IncidentItem[] }>('/incidents', { params: { search: q, limit: 4 } }),
      ]);

      const newGroups: ResultGroup[] = [];

      // Cases
      if (casesRes.status === 'fulfilled') {
        const items = casesRes.value.data.data ?? [];
        if (items.length > 0) {
          newGroups.push({
            key: 'cases',
            title: 'Vụ án',
            icon: <Scale className="w-3.5 h-3.5" />,
            color: 'text-blue-600',
            listHref: `/cases?search=${encodeURIComponent(q)}`,
            results: items.map((c) => ({
              id: c.id,
              label: caseLabel(c),
              sublabel: caseSublabel(c),
              href: `/cases/${c.id}`,
            })),
          });
        }
      }

      // Petitions
      if (petitionsRes.status === 'fulfilled') {
        const items = petitionsRes.value.data.data ?? [];
        if (items.length > 0) {
          newGroups.push({
            key: 'petitions',
            title: 'Đơn thư',
            icon: <FileText className="w-3.5 h-3.5" />,
            color: 'text-green-600',
            listHref: `/petitions?search=${encodeURIComponent(q)}`,
            results: items.map((p) => ({
              id: p.id,
              label: petitionLabel(p),
              sublabel: petitionSublabel(p),
              href: `/petitions/${p.id}/edit`,
            })),
          });
        }
      }

      // Subjects
      if (subjectsRes.status === 'fulfilled') {
        const items = subjectsRes.value.data.data ?? [];
        if (items.length > 0) {
          newGroups.push({
            key: 'subjects',
            title: 'Đối tượng',
            icon: <Users className="w-3.5 h-3.5" />,
            color: 'text-purple-600',
            listHref: `/objects?search=${encodeURIComponent(q)}`,
            results: items.map((s) => ({
              id: s.id,
              label: subjectLabel(s),
              sublabel: subjectSublabel(s),
              href: `/objects?search=${encodeURIComponent(q)}`,
            })),
          });
        }
      }

      // Incidents
      if (incidentsRes.status === 'fulfilled') {
        const items = incidentsRes.value.data.data ?? [];
        if (items.length > 0) {
          newGroups.push({
            key: 'incidents',
            title: 'Vụ việc',
            icon: <AlertTriangle className="w-3.5 h-3.5" />,
            color: 'text-amber-600',
            listHref: `/vu-viec?search=${encodeURIComponent(q)}`,
            results: items.map((i) => ({
              id: i.id,
              label: incidentLabel(i),
              sublabel: incidentSublabel(i),
              href: `/vu-viec?search=${encodeURIComponent(q)}`,
            })),
          });
        }
      }

      setGroups(newGroups);
    } catch {
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(debouncedQuery);
  }, [debouncedQuery, runSearch]);

  // ── Flat list for keyboard nav ─────────────────────────────────────────────
  const flatResults = groups.flatMap((g) => g.results);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && flatResults[activeIndex]) {
        navigateTo(flatResults[activeIndex].href);
      } else if (groups.length > 0) {
        // Navigate to first group list page
        navigateTo(groups[0].listHref);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  };

  const navigateTo = (href: string) => {
    setIsOpen(false);
    setQuery('');
    setGroups([]);
    navigate(href);
  };

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Track global flat index per group item ────────────────────────────────
  let globalIndex = -1;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} className="flex-1 max-w-xl relative">
      {/* Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748b] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.trim().length >= 2) setIsOpen(true);
            else { setIsOpen(false); setGroups([]); }
          }}
          onFocus={() => {
            if (query.trim().length >= 2) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Tìm kiếm vụ án, đối tượng, hồ sơ..."
          autoComplete="off"
          className="w-full pl-10 pr-9 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white"
          data-testid="global-search-input"
          aria-label="Tìm kiếm toàn hệ thống"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        />
        {/* Clear button */}
        {query.length > 0 && (
          <button
            onClick={() => {
              setQuery('');
              setGroups([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Xóa tìm kiếm"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl z-50 overflow-hidden"
          role="listbox"
          data-testid="search-dropdown"
        >
          {/* Loading */}
          {isLoading && (
            <div className="flex items-center gap-2 px-4 py-3 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Đang tìm kiếm...</span>
            </div>
          )}

          {/* No results */}
          {!isLoading && debouncedQuery.length >= 2 && groups.length === 0 && (
            <div className="px-4 py-6 text-center">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">
                Không tìm thấy kết quả cho <strong className="text-slate-700">"{debouncedQuery}"</strong>
              </p>
            </div>
          )}

          {/* Result groups */}
          {!isLoading && groups.length > 0 && (
            <div className="max-h-[480px] overflow-y-auto">
              {groups.map((group) => (
                <div key={group.key}>
                  {/* Group header */}
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                    <div className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${group.color}`}>
                      {group.icon}
                      {group.title}
                    </div>
                    <button
                      onClick={() => navigateTo(group.listHref)}
                      className="flex items-center gap-0.5 text-xs text-slate-400 hover:text-primary transition-colors"
                    >
                      Xem tất cả
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Group items */}
                  {group.results.map((result) => {
                    globalIndex += 1;
                    const idx = globalIndex;
                    const isActive = activeIndex === idx;
                    return (
                      <div
                        key={result.id}
                        onClick={() => navigateTo(result.href)}
                        onMouseEnter={() => setActiveIndex(idx)}
                        className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                          isActive ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                        role="option"
                        aria-selected={isActive}
                        data-testid="search-result-item"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            <HighlightMatch text={result.label} query={debouncedQuery} />
                          </p>
                          {result.sublabel && (
                            <p className="text-xs text-slate-400 mt-0.5">{result.sublabel}</p>
                          )}
                        </div>
                        {isActive && (
                          <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 ml-2" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Footer hint */}
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                <p className="text-xs text-slate-400">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-500 font-mono text-[10px]">↑↓</kbd>
                  {' '}di chuyển &nbsp;
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-500 font-mono text-[10px]">↵</kbd>
                  {' '}chọn &nbsp;
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-slate-500 font-mono text-[10px]">Esc</kbd>
                  {' '}đóng
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Highlight matched text ────────────────────────────────────────────────────

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-100 text-yellow-800 rounded-sm px-0.5 font-semibold not-italic">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}
