/**
 * GlobalSearchBar — Thanh tìm kiếm toàn cục trong header
 *
 * Cách hoạt động:
 * - Người dùng gõ ≥ 2 ký tự → debounce 300ms → gọi song song 4 API (/cases, /petitions, /subjects,
 *   /incidents) với thẻ "tất cả các cột" `tk=*~<chữ gõ>` — máy chủ bỏ dấu, CÙNG quy tắc mọi màn danh
 *   sách. Cờ `TIM_KIEM_THE` tắt → gửi `search` như cũ.
 * - Kết quả hiển thị dropdown nhóm theo loại (tối đa 4 kết quả mỗi loại)
 * - Click vào kết quả → mở hồ sơ (vụ án, đơn thư, vụ việc) hoặc danh sách đối tượng đúng loại lọc theo
 *   họ tên
 * - "Xem tất cả" / Enter → danh sách của nhóm mang thẻ "*" trên đúng khoá URL màn ấy đọc
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
import { boDau } from '@/lib/bo-dau';
import { useFeatureBatMacDinh } from '@/lib/features/useFeature';
import { khoaUrlThe } from '@/shared/tim-kiem/the';
import {
  CASE_STATUS_LABEL,
  INCIDENT_STATUS_LABEL,
  PETITION_STATUS_LABEL,
} from '@/shared/enums/status-labels';
import { SUBJECT_TYPE_LABEL, SubjectType } from '@/shared/enums/subject-status';

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

// ── API response shapes — ĐÚNG tên trường API trả về ─────────────────────────
//
// [lỗi có sẵn] Bản trước đọc `caseNumber`/`caseName`, `incidentNumber`/`incidentName` — API không có
// các trường ấy (vụ án `caseCode`/`name`, vụ việc `code`/`name`), nên nhãn chỉ còn id.

interface CaseItem {
  id: string;
  caseCode?: string | null;
  name?: string | null;
  status?: string;
}

interface PetitionItem {
  id: string;
  stt?: string | null;
  senderName?: string | null;
  status?: string;
}

interface SubjectItem {
  id: string;
  fullName?: string | null;
  type?: string;
}

interface IncidentItem {
  id: string;
  code?: string | null;
  name?: string | null;
  status?: string;
}

// ── Label helpers — nhãn trạng thái từ bảng nhãn chung, không chép tay ────────

const nhan = (bang: Record<string, string>, ma?: string) => (ma ? (bang[ma] ?? ma) : '');

function caseLabel(c: CaseItem): string {
  return [c.caseCode, c.name].filter(Boolean).join(' — ') || c.id;
}
function petitionLabel(p: PetitionItem): string {
  return [p.stt, p.senderName].filter(Boolean).join(' — ') || p.id;
}
function subjectLabel(s: SubjectItem): string {
  return s.fullName || s.id;
}
function incidentLabel(i: IncidentItem): string {
  return [i.code, i.name].filter(Boolean).join(' — ') || i.id;
}

// ── Đường tới danh sách — khoá URL mà màn ấy đọc ─────────────────────────────

/** Máy chủ nhận giá trị thẻ tối đa 200 ký tự; dán dài hơn là 400 cả bốn nhóm. */
const DO_DAI_TIM_TOI_DA = 200;

/** Danh sách đối tượng theo loại: đường + tiền tố khoá URL (`ObjectListPageShell` TYPE_CONFIG). */
const DS_DOI_TUONG: Record<string, { duong: string; prefix: string }> = {
  [SubjectType.SUSPECT]: { duong: '/objects', prefix: 'objects' },
  [SubjectType.VICTIM]: { duong: '/people/victims', prefix: 'victims' },
  [SubjectType.WITNESS]: { duong: '/people/witnesses', prefix: 'witnesses' },
};

/**
 * Địa chỉ danh sách lọc sẵn. Cờ bật → thẻ `<prefix>_tk=<khoá>~<giá trị>`; cờ tắt → khoá chữ cũ
 * `<prefix>_q=` (chỉ cho thẻ "*"). Bản trước gửi `?search=` mà KHÔNG màn nào đọc → danh sách chưa lọc.
 */
function diaChiDanhSach(
  duong: string,
  prefix: string,
  giaTri: string,
  theBat: boolean,
  khoa = '*',
): string {
  const ts = new URLSearchParams();
  if (theBat) ts.append(khoaUrlThe(prefix), `${khoa}~${giaTri}`);
  else ts.set(`${prefix}_q`, giaTri);
  return `${duong}?${ts.toString()}`;
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
  const theBat = useFeatureBatMacDinh('TIM_KIEM_THE');
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

    const chu = q.slice(0, DO_DAI_TIM_TOI_DA);
    const params = theBat ? { tk: [`*~${chu}`], limit: 4 } : { search: chu, limit: 4 };

    try {
      const [casesRes, petitionsRes, subjectsRes, incidentsRes] = await Promise.allSettled([
        api.get<{ data: CaseItem[] }>('/cases', { params }),
        api.get<{ data: PetitionItem[] }>('/petitions', { params }),
        api.get<{ data: SubjectItem[] }>('/subjects', { params }),
        api.get<{ data: IncidentItem[] }>('/incidents', { params }),
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
            listHref: diaChiDanhSach('/cases', 'cases', chu, theBat),
            results: items.map((c) => ({
              id: c.id,
              label: caseLabel(c),
              sublabel: nhan(CASE_STATUS_LABEL, c.status),
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
            listHref: diaChiDanhSach('/petitions', 'petitions', chu, theBat),
            results: items.map((p) => ({
              id: p.id,
              label: petitionLabel(p),
              sublabel: nhan(PETITION_STATUS_LABEL, p.status),
              href: `/petitions/${p.id}/edit`,
            })),
          });
        }
      }

      // Subjects — không có trang chi tiết: mở danh sách ĐÚNG loại, lọc đúng họ tên ấy.
      if (subjectsRes.status === 'fulfilled') {
        const items = subjectsRes.value.data.data ?? [];
        if (items.length > 0) {
          const bican = DS_DOI_TUONG[SubjectType.SUSPECT];
          newGroups.push({
            key: 'subjects',
            title: 'Đối tượng',
            icon: <Users className="w-3.5 h-3.5" />,
            color: 'text-purple-600',
            listHref: diaChiDanhSach(bican.duong, bican.prefix, chu, theBat),
            results: items.map((s) => {
              const ds = DS_DOI_TUONG[s.type ?? ''] ?? bican;
              const ten = s.fullName || chu;
              return {
                id: s.id,
                label: subjectLabel(s),
                sublabel: nhan(SUBJECT_TYPE_LABEL, s.type),
                href: theBat
                  ? diaChiDanhSach(ds.duong, ds.prefix, ten, true, 'hoTen')
                  : diaChiDanhSach(ds.duong, ds.prefix, ten, false),
              };
            }),
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
            listHref: diaChiDanhSach('/vu-viec', 'incidents', chu, theBat),
            results: items.map((i) => ({
              id: i.id,
              label: incidentLabel(i),
              sublabel: nhan(INCIDENT_STATUS_LABEL, i.status),
              href: `/vu-viec/${i.id}`,
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
  }, [theBat]);

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
      // Bộ gõ Telex/VNI/IME dùng Enter để CHỐT chữ đang ghép — lúc ấy chưa phải lệnh mở kết quả.
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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

/**
 * Vị trí [đầu, cuối) của đoạn khớp KHÔNG phân biệt dấu trong chữ GỐC. Máy chủ tìm bỏ dấu, nên gõ
 * "nguyen" ra "Nguyễn" — tô sáng so có dấu thì kết quả ấy không được tô. Bỏ dấu từng ký tự và giữ bảng
 * vị trí gốc: "ễ" dựng sẵn thành "e", dấu kết hợp (chữ NFD) thành rỗng và dính vào ký tự trước.
 */
function viTriKhop(text: string, query: string): [number, number] | null {
  const q = boDau(query).trim();
  if (!q) return null;
  let chuan = '';
  // goc[k] = [đầu, cuối) trong chữ gốc của ký tự chuẩn thứ k.
  const goc: Array<[number, number]> = [];
  let viTri = 0;
  for (const ch of text) {
    const n = boDau(ch);
    const ketThuc = viTri + ch.length;
    if (n.length === 0 && goc.length > 0) {
      // Dấu kết hợp (chữ NFD) không sinh ký tự chuẩn — gộp vào ký tự trước để tô trọn chữ.
      goc[goc.length - 1] = [goc[goc.length - 1][0], ketThuc];
    }
    for (let k = 0; k < n.length; k++) goc.push([viTri, ketThuc]);
    chuan += n;
    viTri = ketThuc;
  }
  const at = chuan.indexOf(q);
  if (at < 0) return null;
  return [goc[at][0], goc[at + q.length - 1][1]];
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const khop = viTriKhop(text, query);
  if (!khop) return <>{text}</>;
  const [dau, cuoi] = khop;
  return (
    <>
      {text.slice(0, dau)}
      <mark className="bg-yellow-100 text-yellow-800 rounded-sm px-0.5 font-semibold not-italic">
        {text.slice(dau, cuoi)}
      </mark>
      {text.slice(cuoi)}
    </>
  );
}
