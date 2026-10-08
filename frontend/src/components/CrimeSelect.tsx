import { CasePolicyField } from '@/features/cases/native-field-policy';
import { useState, useRef, useEffect, useMemo, useId, useCallback } from 'react';
import { Search, ChevronDown, X, Loader2 } from 'lucide-react';
import { LABEL_BASE, FIELD_ERROR_TEXT } from '@/constants/styles';
import { useCrimeOptions } from '@/hooks/useCrimeOptions';
import { useListboxNav } from '@/hooks/useListboxNav';
import { visibleCrimes, type CrimeOption } from './crime-select-utils';

function crimeLabel(c: CrimeOption): string {
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
//
// Nút mở là <button> THẬT, không phải <div onClick>: Tab tới được, Enter/Space/↓ mở được, và
// <fieldset disabled> khoá được nó. Bản <div> trước đây lọt qua fieldset nên ở chế độ khoá của
// form Vụ án ô tội danh vẫn mở và đổi được. Bàn phím trong hộp dùng `useListboxNav` chung với
// FKSelect và ONhapGoiY.
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
  const all = useMemo(() => Array.isArray(crimesRaw) ? crimesRaw : [], [crimesRaw]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const maGoc = useId().replace(/:/g, '');
  const maDanhSach = `${maGoc}-ds`;
  const maNhan = `${maGoc}-nhan`;

  const selected = useMemo(() => all.find((c) => c.id === value), [all, value]);
  const visible = useMemo(
    () => visibleCrimes(all, { search, showAll }),
    [all, search, showAll],
  );
  const pc02Count = useMemo(() => all.filter((c) => c.pc02Relevant).length, [all]);

  const dong = useCallback(() => {
    setIsOpen(false);
    setSearch('');
  }, []);

  const select = useCallback(
    (id: string) => {
      onChange(id);
      dong();
      // Ô tìm biến mất cùng hộp; không trả tiêu điểm thì nó rơi về <body> và người dùng bàn phím mất chỗ.
      triggerRef.current?.focus();
    },
    [onChange, dong],
  );

  // Khoá nhận dạng danh sách đang hiện: đổi khoá (gõ lọc, bật "hiện tất cả") thì bỏ tô.
  const khoaDanhSach = useMemo(() => visible.map((c) => c.id).join(','), [visible]);

  const nav = useListboxNav({
    count: visible.length,
    resetKey: khoaDanhSach,
    idPrefix: maGoc,
    onSelect: (i) => {
      const c = visible[i];
      if (c) select(c.id);
    },
    onEscape: () => {
      dong();
      triggerRef.current?.focus();
    },
    // Không có onTab: Tab phải đi tiếp tự nhiên (ô tìm → nút "Hiện tất cả" → ô kế tiếp). Đóng hộp ngay lúc
    // bấm Tab sẽ gỡ luôn ô tìm đang giữ tiêu điểm, tiêu điểm rơi về <body> và nút "Hiện tất cả" không tới được.
    // Hộp tự đóng khi tiêu điểm thật sự sang phần tử ngoài ô (xem onBlur bên dưới).
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dong();
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [dong]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  return (
    <CasePolicyField label={label} testId={testId}><div
      ref={containerRef}
      className="relative"
      data-testid={testId}
      onBlur={(e) => {
        // Chỉ đóng khi tiêu điểm sang một phần tử CỤ THỂ ngoài ô. relatedTarget rỗng (bấm vào vùng không
        // nhận tiêu điểm trong hộp, thanh cuộn…) thì giữ nguyên — bấm ra ngoài đã có onClickOutside lo.
        const sang = e.relatedTarget as Node | null;
        if (sang && containerRef.current && !containerRef.current.contains(sang)) dong();
      }}
    >
      <label id={maNhan} className={LABEL_BASE}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={maDanhSach}
          // Tên lấy từ nhãn, KHÔNG dùng aria-label: aria-label đè nội dung nút nên trình đọc màn hình
          // không đọc tội danh đang chọn (giá trị của combobox chính là chữ trong nút).
          aria-labelledby={maNhan}
          disabled={disabled}
          onClick={() => setIsOpen((o) => !o)}
          onKeyDown={(e) => {
            // Enter/Space đã mở hộp qua sự kiện click của <button>; ↓ mở thêm theo mẫu combobox.
            if (e.key === 'ArrowDown' && !isOpen) {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
          className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left border rounded-lg transition-colors bg-white cursor-pointer focus:outline-none focus-visible:ring-2 disabled:bg-slate-100 disabled:cursor-not-allowed ${
            value && !disabled ? 'pr-16' : 'pr-10'
          } ${
            error
              ? 'border-red-300 focus-visible:ring-red-500'
              : 'border-slate-300 focus-visible:ring-blue-500'
          } ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
          data-testid={`${testId}-trigger`}
        >
          <span className={`text-sm ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
            {selected ? crimeLabel(selected) : placeholder}
          </span>
          <ChevronDown
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {/* Nằm NGOÀI nút mở: <button> lồng <button> là HTML sai và trình duyệt tách chúng tuỳ ý. */}
        {value && !disabled && (
          <button
            type="button"
            aria-label="Xoá lựa chọn"
            onClick={() => onChange('')}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded"
            data-testid={`${testId}-clear`}
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </button>
        )}
      </div>

      {error && <p className={FIELD_ERROR_TEXT}>{error}</p>}

      {isOpen && (
        <div
          className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
          data-testid={`${testId}-dropdown`}
          onKeyDown={(e) => {
            // Escape khi tiêu điểm ở nút "Hiện tất cả" (ô tìm đã tự xử lý Escape của nó rồi).
            if (e.key === 'Escape') {
              e.stopPropagation();
              dong();
              triggerRef.current?.focus();
            }
          }}
        >
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  nav.reset();
                }}
                onKeyDown={nav.onKeyDown}
                aria-label={`Tìm trong ${label}`}
                aria-controls={maDanhSach}
                aria-activedescendant={nav.activeDescendantId}
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

          <div
            id={maDanhSach}
            role="listbox"
            aria-label={label}
            className="max-h-56 overflow-y-auto"
          >
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
              visible.map((c, i) => {
                const dangTo = i === nav.activeIndex;
                return (
                  <button
                    key={c.id}
                    id={nav.optionId(i)}
                    type="button"
                    role="option"
                    tabIndex={-1}
                    // `aria-selected` = ĐÃ CHỌN, không phải đang tô (cái đang tô đã có aria-activedescendant).
                    aria-selected={c.id === value}
                    data-active={dangTo ? 'true' : undefined}
                    // Giữ tiêu điểm ở ô tìm khi bấm chuột vào mục.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(c.id)}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      dangTo
                        ? 'bg-blue-100 text-blue-800'
                        : c.id === value
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
                );
              })
            )}
          </div>
        </div>
      )}
    </div></CasePolicyField>
  );
}
