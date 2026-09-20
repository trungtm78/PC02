import { useState, useRef, useEffect, useCallback, useId } from "react";
import { Plus, Search, ChevronDown, X, Loader2 } from "lucide-react";
import { LABEL_BASE, FIELD_ERROR_TEXT } from "@/constants/styles";
import { useDirectoryOptions } from "@/hooks/useDirectoryOptions";
import { useMasterClassOptions } from "@/hooks/useMasterClassOptions";

import { khopKhongDau as fuzzyMatch } from "@/lib/bo-dau";

function matchesAbbreviation(text: string, query: string): boolean {
  if (!query || query.length < 2) return false;
  const initials = text
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .toLowerCase();
  return initials.includes(query.toLowerCase());
}

function smartMatch(text: string, query: string): boolean {
  if (!query) return true;
  if (fuzzyMatch(text, query)) return true;
  if (matchesAbbreviation(text, query)) return true;
  return false;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FKOption {
  value: string;
  label: string;
}

/**
 * Một nhóm trong danh sách chọn — vd một Tổ công tác.
 *
 * Luật tìm khi có nhóm khác hẳn danh sách phẳng: gõ khớp TÊN NHÓM thì giữ CẢ nhóm (cán bộ
 * đang muốn xem cả tổ), gõ khớp TÊN MỤC thì lọc trong từng nhóm và bỏ nhóm không còn ai.
 */
export interface FKGroup {
  key: string;
  label: string;
  options: FKOption[];
}

interface FKSelectProps {
  label: string;
  required?: boolean;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  options?: FKOption[];
  placeholder?: string;
  canCreate?: boolean;
  /** Nhận chữ vừa gõ để điền sẵn vào màn tạo mới. */
  onCreateNew?: (tenGoiY?: string) => void;
  loading?: boolean;
  testId?: string;
  'data-testid'?: string;
  resource?: string;
  searchPlaceholder?: string;
  /** Auto-fetch options from Directory API by type */
  directoryType?: string;
  /** Auto-fetch options from MasterClass API by type code (00, 01, 02...) */
  masterClassType?: string;
  /** Bật chế độ nhóm. Khi có, `options`/`directoryType` không được dùng để dựng danh sách. */
  groups?: FKGroup[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FKSelect({
  label,
  required,
  error,
  value,
  onChange,
  options: optionsProp,
  placeholder = "Tìm kiếm hoặc chọn...",
  canCreate = false,
  onCreateNew,
  loading: loadingProp = false,
  testId,
  'data-testid': dataTestId,
  resource: _resource,
  searchPlaceholder,
  directoryType,
  masterClassType,
  groups,
}: FKSelectProps) {
  testId = testId ?? dataTestId;
  const maGoc = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /**
   * Từ khoá gửi lên máy chủ — trễ 250ms sau khi ngừng gõ.
   *
   * Có bước này vì máy chủ chặn cứng `limit` ở 1.000 dòng, mà danh mục `DON_VI` sẽ có ~1.868
   * dòng sau khi nạp dữ liệu cũ. Lọc phía trình duyệt trên một trang đã cắt là hỏng IM LẶNG:
   * cán bộ gõ tên một đơn vị CÓ THẬT trong cơ sở dữ liệu mà ô tìm báo không có, rồi tạo ra một
   * bản trùng — đúng thứ danh mục này vừa được dọn để tránh.
   */
  const [tuKhoaMayChu, setTuKhoaMayChu] = useState("");
  useEffect(() => {
    if (!directoryType) return;
    const h = setTimeout(() => setTuKhoaMayChu(searchQuery), 250);
    return () => clearTimeout(h);
  }, [searchQuery, directoryType]);

  // Auto-fetch from Directory API if directoryType is set
  const { data: directoryOptions, isLoading: directoryLoading } =
    useDirectoryOptions(directoryType, { search: tuKhoaMayChu });

  // Auto-fetch from MasterClass API if masterClassType is set
  const { data: masterClassOpts, isLoading: masterClassLoading } =
    useMasterClassOptions(masterClassType);

  const options = masterClassType
    ? (masterClassOpts ?? [])
    : directoryType
      ? (directoryOptions ?? [])
      : (optionsProp ?? []);
  const loading = loadingProp || (directoryType ? directoryLoading : false) || (masterClassType ? masterClassLoading : false);

  /**
   * Mọi mục có thể chọn, KHÔNG lọc.
   *
   * Ở chế độ nhóm, `options` rỗng (danh sách nằm trong `groups`), nên tra nhãn đã chọn trong
   * `options` là luôn không thấy — ô hiện chữ gợi ý và trông như chưa chọn gì, trong khi giá
   * trị đã nằm trong form. Đúng lớp lỗi mà `nhanDaChon` bên dưới sinh ra để chặn.
   */
  const tatCaMuc: FKOption[] = groups ? groups.flatMap((g) => g.options) : options;

  // Find selected option label
  const selectedOption = tatCaMuc.find((o) => o.value === value);

  /**
   * Nhãn hiện ở ô khi đã chọn.
   *
   * KHÔNG chỉ dựa vào `options`: với danh mục tìm-trên-máy-chủ, danh sách đang tải về chỉ là
   * MỘT TRANG. Chọn xong thì ô tìm được xoá và truy vấn quay lại trang mặc định — mục vừa chọn
   * nằm ngoài trang ấy nên `find` không thấy, ô hiện lại chữ gợi ý và trông như chưa chọn gì,
   * trong khi giá trị ĐÃ nằm trong form. Cùng lỗi khi mở hồ sơ cũ có giá trị nằm sâu.
   *
   * Với `directoryType`, `value` chính là TÊN (xem `useDirectoryOptions`), nên dùng thẳng nó
   * làm nhãn là đúng. Với danh sách truyền tay, `value` có thể là id nên không lùi về nó.
   */
  const nhanDaChon = selectedOption?.label ?? (directoryType && value ? value : "");

  /**
   * Lọc tại máy CHỈ khi danh sách vốn đã đầy đủ ở đây (options truyền vào, danh mục nhỏ).
   *
   * Với `directoryType`, máy chủ đã lọc rồi — lọc lại tại máy sẽ cắt bớt kết quả máy chủ vừa
   * trả về đúng lúc chữ gõ và độ trễ chưa khớp nhau, làm danh sách nhấp nháy rỗng.
   */
  const filteredOptions = directoryType
    ? options
    : options.filter((o) => smartMatch(o.label, searchQuery));

  /**
   * Nhóm sau khi lọc.
   *
   * Khớp TÊN NHÓM thì giữ nguyên cả nhóm — cán bộ gõ "Tổ 1" là đang muốn xem cả tổ, lọc tiếp
   * bên trong sẽ ra rỗng. Khớp TÊN MỤC thì lọc trong nhóm rồi bỏ nhóm không còn ai: một tiêu
   * đề nhóm trơ trọi không mục nào chỉ tổ chắn tầm mắt.
   */
  const nhomHienThi: FKGroup[] = (groups ?? [])
    .map((g) =>
      smartMatch(g.label, searchQuery)
        ? g
        : { ...g, options: g.options.filter((o) => smartMatch(o.label, searchQuery)) },
    )
    .filter((g) => g.options.length > 0);

  /**
   * Danh sách PHẲNG theo đúng thứ tự nhìn thấy — phím mũi tên chạy trên nó.
   *
   * Không có nó thì mỗi nhóm phải tự đếm chỉ số, và mũi tên sẽ nhảy cóc ở ranh giới nhóm.
   */
  const dsPhang: FKOption[] = groups ? nhomHienThi.flatMap((g) => g.options) : filteredOptions;

  /** Đang ở trạng thái "gõ rồi mà không ra gì" — điều kiện để mời tạo mới. */
  const khongCoKetQua = !loading && dsPhang.length === 0 && searchQuery.trim().length > 0;

  /**
   * Bỏ tô mỗi khi DANH SÁCH NHÌN THẤY đổi, không chỉ khi chữ tìm đổi.
   *
   * `highlightedIndex` là CHỈ SỐ, mà danh sách đổi được dưới chân nó: hồ sơ phân công về muộn
   * làm một người biến khỏi danh sách, hoặc danh sách cán bộ 245 người về sau khi cán bộ đã
   * bấm mũi tên. Giữ nguyên chỉ số cũ thì Enter chọn NGƯỜI KHÁC — im lặng, và tên người ấy đi
   * thẳng lên Phiếu đề xuất.
   */
  const khoaDanhSach = dsPhang.map((o) => o.value).join(" ");
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery, khoaDanhSach]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-option-index]");
      items[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setIsOpen(false);
      setSearchQuery("");
      setHighlightedIndex(-1);
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      setSearchQuery("");
    },
    [onChange]
  );

  const toggleDropdown = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (isOpen) {
      setSearchQuery("");
      setHighlightedIndex(-1);
    }
  }, [isOpen]);

  /** Bàn phím trên ô bấm mở: Enter / Space / mũi tên xuống đều mở hộp, Escape đóng. */
  const handleTriggerKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      /**
       * Bộ gõ tiếng Việt dùng Enter để CHỐT chữ đang bỏ dấu, và trình duyệt vẫn bắn keydown.
       * Không chặn thì mỗi lần cán bộ bỏ dấu một chữ, hộp "tạo mới" lại bật lên.
       *
       * `isComposing` là dấu hiệu chuẩn; `keyCode === 229` là đường lùi cho trình duyệt cũ
       * không đặt cờ ấy.
       */
      const dangGoDau =
        (e.nativeEvent as KeyboardEvent).isComposing || (e.nativeEvent as KeyboardEvent).keyCode === 229;
      if (dangGoDau) return;

      if (dsPhang.length === 0) {
        if (e.key === "Escape") {
          setIsOpen(false);
          setSearchQuery("");
          setHighlightedIndex(-1);
        }
        // Gõ rồi mà không ra gì → mời tạo mới, kèm nguyên chữ vừa gõ để điền sẵn.
        if (e.key === "Enter" && canCreate && onCreateNew && khongCoKetQua) {
          e.preventDefault();
          const ten = searchQuery.trim();
          setIsOpen(false);
          setSearchQuery("");
          setHighlightedIndex(-1);
          onCreateNew(ten);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < dsPhang.length - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : dsPhang.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          // CHỈ chọn khi đang tô một mục. Trước đây Enter không-tô tự lấy mục đầu danh sách:
          // cán bộ gõ để LỌC rồi bấm Enter là bị gán bừa người đầu tiên, mà tên ấy in thẳng lên
          // Phiếu đề xuất. Một lựa chọn phải do người ta chỉ đích danh.
          if (highlightedIndex >= 0 && highlightedIndex < dsPhang.length) {
            handleSelect(dsPhang[highlightedIndex].value);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setSearchQuery("");
          setHighlightedIndex(-1);
          break;
      }
    },
    [dsPhang, highlightedIndex, handleSelect, canCreate, onCreateNew, khongCoKetQua, searchQuery]
  );

  /** Mã DOM của một mục theo chỉ số phẳng — `aria-activedescendant` trỏ vào đây. */
  const maMuc = (chiSo: number) => `${maGoc}-muc-${chiSo}`;

  /**
   * Vẽ một mục. Dùng chung cho cả danh sách phẳng lẫn danh sách có nhóm, để hai đường không
   * trôi khỏi nhau về lớp CSS, testid hay thuộc tính trợ năng.
   */
  const veMuc = (option: FKOption, chiSo: number, laBanLap = false) => {
    const dangTo = chiSo === highlightedIndex;
    return (
      <button
        key={`${option.value}-${chiSo}`}
        id={maMuc(chiSo)}
        type="button"
        role="option"
        /**
         * `aria-selected` nghĩa là ĐÃ CHỌN, không phải đang tô — cái đang tô đã có
         * `aria-activedescendant` nói rồi. Gộp hai thứ làm một thì trình đọc màn hình đọc mỗi
         * lần bấm mũi tên là "đã chọn", nghe như đã phân công xong.
         */
        aria-selected={option.value === value}
        data-option-index={chiSo}
        onClick={() => handleSelect(option.value)}
        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
          dangTo
            ? "bg-blue-100 text-blue-800"
            : option.value === value
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-slate-700 hover:bg-blue-50"
        }`}
        /**
         * Một cán bộ thuộc HAI tổ hiện ở cả hai nhóm, nên cùng một `value` xuất hiện hai lần.
         * Để testid trùng là `getByTestId` nổ ("Found multiple elements") và kịch bản Playwright
         * hỏng ở chế độ nghiêm — ngay trên dữ liệu thật. Bản lặp mang thêm chỉ số.
         */
        data-testid={
          testId
            ? laBanLap
              ? `${testId}-option-${option.value}--${chiSo}`
              : `${testId}-option-${option.value}`
            : undefined
        }
      >
        {option.label}
      </button>
    );
  };

  return (
    <div ref={containerRef} className="relative" data-testid={testId}>
      {/* Label */}
      <label className={LABEL_BASE}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Trigger button */}
      {/**
        * Ô bấm mở LÀ combobox theo chuẩn APG: nó là thứ người ta Tab tới và mở bằng bàn phím.
        *
        * Trước đây đây chỉ là một `div` có `onClick` — không `tabIndex`, không `role`, không
        * `onKeyDown`. Ba ô chọn cán bộ vốn là `<select>` thật (Tab tới được) nên đổi sang đây
        * là LÙI: người dùng bàn phím hoặc trình đọc màn hình không mở nổi ô. Còn `role` đặt ở
        * ô tìm BÊN TRONG hộp thì chỉ tồn tại sau khi hộp đã mở — tả một thứ không ai với tới.
        */}
      <div
        onClick={toggleDropdown}
        onKeyDown={handleTriggerKeyDown}
        role="combobox"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={`${maGoc}-ds`}
        aria-label={label}
        className={`w-full flex items-center justify-between px-4 py-2.5 border rounded-lg cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error
            ? "border-red-300 focus-within:ring-2 focus-within:ring-red-500"
            : "border-slate-300 focus-within:ring-2 focus-within:ring-blue-500"
        } ${isOpen ? "ring-2 ring-blue-500 border-blue-500" : ""} bg-white`}
        data-testid={testId ? `${testId}-trigger` : undefined}
      >
        <span className={`text-sm ${nhanDaChon ? "text-slate-800" : "text-slate-400"}`}>
          {nhanDaChon || placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-100 rounded"
              data-testid={testId ? `${testId}-clear` : undefined}
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </div>

      {/* Error */}
      {error && <p className={FIELD_ERROR_TEXT}>{error}</p>}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden" data-testid={testId ? `${testId}-dropdown` : undefined}>
          {/* Search input */}
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={searchPlaceholder ?? "Nhập để tìm kiếm..."}
                data-testid={testId ? `${testId}-search` : undefined}
                aria-label={`Tìm trong ${label}`}
                aria-controls={`${maGoc}-ds`}
                aria-activedescendant={
                  highlightedIndex >= 0 ? maMuc(highlightedIndex) : undefined
                }
              />
            </div>
          </div>

          {/* Options list */}
          <div
            ref={listRef}
            className="max-h-48 overflow-y-auto"
            role="listbox"
            id={`${maGoc}-ds`}
            aria-label={label}
          >
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="ml-2 text-sm text-slate-500">Đang tải...</span>
              </div>
            ) : dsPhang.length === 0 && !searchQuery.trim() ? (
              /**
               * Chưa gõ gì mà danh sách rỗng KHÔNG phải "không tìm thấy kết quả" — nó nghĩa là
               * nguồn dữ liệu rỗng hoặc hỏng. Nói nhầm hai thứ này là bảo cán bộ "không có cán
               * bộ nào" trong khi thật ra lời gọi vừa lỗi.
               */
              <div
                className="py-6 text-center text-sm text-slate-500"
                data-testid={testId ? `${testId}-rong` : undefined}
              >
                Chưa có dữ liệu để chọn
              </div>
            ) : dsPhang.length === 0 ? (
              <div
                className="py-6 text-center text-sm text-slate-500"
                data-testid={testId ? `${testId}-khong-co-ket-qua` : undefined}
              >
                Không tìm thấy kết quả
                {khongCoKetQua && canCreate && onCreateNew && (
                  <span className="block mt-1 text-xs text-blue-600">
                    Nhấn Enter để tạo mới "{searchQuery.trim()}"
                  </span>
                )}
              </div>
            ) : groups ? (
              // Chỉ số chạy XUYÊN nhóm để khớp `dsPhang` — phím mũi tên và chuột phải cùng
              // nói về một mục, nếu không thì Enter chọn nhầm người ở ranh giới nhóm.
              (() => {
                let chiSo = -1;
                const daVe = new Set<string>();
                return nhomHienThi.map((nhom) => (
                  <div key={nhom.key} role="group" aria-label={nhom.label}>
                    <div className="px-4 py-1.5 bg-slate-50 border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500 flex items-center justify-between">
                      <span>{nhom.label}</span>
                      <span className="rounded-full bg-slate-200 px-1.5 text-slate-600 normal-case">
                        {nhom.options.length}
                      </span>
                    </div>
                    {nhom.options.map((option) => {
                      chiSo += 1;
                      // Bản lặp = cùng một người đã xuất hiện ở nhóm trước (thuộc nhiều tổ).
                      const laBanLap = daVe.has(option.value);
                      daVe.add(option.value);
                      return veMuc(option, chiSo, laBanLap);
                    })}
                  </div>
                ));
              })()
            ) : (
              filteredOptions.map((option, index) => veMuc(option, index))
            )}
          </div>

          {/* Create new button (permission-gated) */}
          {canCreate && onCreateNew && (
            <div className="border-t border-slate-200 p-2">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery("");
                  const ten = searchQuery.trim();
                  setHighlightedIndex(-1);
                  onCreateNew(ten);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-medium"
                data-testid={testId ? `${testId}-create-new` : undefined}
              >
                <Plus className="w-4 h-4" />
                Tạo mới
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
