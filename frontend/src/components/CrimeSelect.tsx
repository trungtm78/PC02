import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Loader2 } from 'lucide-react';
import { LABEL_BASE, FIELD_ERROR_TEXT } from '@/constants/styles';
import { useCrimeOptions } from '@/hooks/useCrimeOptions';
import { visibleCrimes, type CrimeOption } from './crime-select-utils';

export function crimeLabel(c: CrimeOption): string {
  return `Điều ${c.articleNo} · ${c.name}`;
}

interface CrimeSelectProps {
  label: string;
  required?: boolean;
  error?: string;
  value: string; // crime id
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
}

// Select master Tội danh BLHS 2015: mặc định lọc PC02, toggle "Hiện tất cả 316", search bỏ lọc.
export function CrimeSelect({
  label,
  required,
  error,
  value,
  onChange,
  placeholder = 'Chọn tội danh...',
  disabled = false,
  testId = 'crime-select',
}: CrimeSelectProps) {
  const { data: crimesRaw, isLoading } = useCrimeOptions();
  // Giá trị mặc định của tham số CHỈ chạy khi dữ liệu là `undefined`. Máy chủ (và bản giả
  // trong ca kiểm) có thể trả `null` hoặc một hình dạng khác — khi ấy `all` là null và
  // `all.find` làm trắng nguyên trang. Ép về mảng ngay tại đây, không dựa vào mặc định.
  const all = Array.isArray(crimesRaw) ? crimesRaw : [];
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(() => all.find((c) => c.id === value), [all, value]);
  const visible = useMemo(
    () => visibleCrimes(all, { search, showAll }),
    [all, search, showAll],
  );
  const pc02Count = useMemo(() => all.filter((c) => c.pc02Relevant).length, [all]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const select = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative" data-testid={testId}>
      <label className={LABEL_BASE}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div
        onClick={() => !disabled && setIsOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-2.5 border rounded-lg transition-colors ${
          disabled ? 'bg-slate-100 cursor-not-allowed' : 'bg-white cursor-pointer'
        } ${
          error
            ? 'border-red-300 focus-within:ring-2 focus-within:ring-red-500'
            : 'border-slate-300 focus-within:ring-2 focus-within:ring-blue-500'
        } ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
        data-testid={`${testId}-trigger`}
      >
        <span className={`text-sm ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
          {selected ? crimeLabel(selected) : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-0.5 hover:bg-slate-100 rounded"
              data-testid={`${testId}-clear`}
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {error && <p className={FIELD_ERROR_TEXT}>{error}</p>}

      {isOpen && (
        <div
          className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
          data-testid={`${testId}-dropdown`}
        >
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Tìm theo tên hoặc Điều... (tìm cả ngoài PC02)"
                data-testid={`${testId}-search`}
              />
            </div>
            {/* Badge lọc + toggle hiện tất cả (ẩn khi đang search vì search bao toàn bộ) */}
            {!search.trim() && (
              <div className="flex items-center justify-between mt-2 px-1 text-xs">
                <span className="text-slate-500" data-testid={`${testId}-filter-badge`}>
                  {showAll
                    ? `Hiện tất cả ${all.length} điều`
                    : `Đang lọc PC02 · ${pc02Count}/${all.length}`}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAll((s) => !s)}
                  className="text-blue-600 hover:underline font-medium"
                  data-testid={`${testId}-toggle-all`}
                >
                  {showAll ? 'Chỉ tội danh PC02' : 'Hiện tất cả'}
                </button>
              </div>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="ml-2 text-sm text-slate-500">Đang tải...</span>
              </div>
            ) : visible.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">
                Không tìm thấy tội danh
              </div>
            ) : (
              visible.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    c.id === value
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-slate-700 hover:bg-blue-50'
                  }`}
                  data-testid={`${testId}-option-${c.code}`}
                >
                  {crimeLabel(c)}
                  {!c.pc02Relevant && (
                    <span className="ml-2 text-[10px] text-amber-600">(ngoài PC02)</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
