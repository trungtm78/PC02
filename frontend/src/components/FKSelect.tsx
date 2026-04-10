import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Search, ChevronDown, X, Loader2 } from "lucide-react";
import { LABEL_BASE, FIELD_ERROR_TEXT } from "@/constants/styles";
import { useDirectoryOptions } from "@/hooks/useDirectoryOptions";

// ─── Vietnamese diacritics removal ──────────────────────────────────────────

const VIETNAMESE_MAP: Record<string, string> = {
  a: "aàảãáạăằẳẵắặâầẩẫấậ",
  d: "dđ",
  e: "eèẻẽéẹêềểễếệ",
  i: "iìỉĩíị",
  o: "oòỏõóọôồổỗốộơờởỡớợ",
  u: "uùủũúụưừửữứự",
  y: "yỳỷỹýỵ",
};

function removeVietnameseDiacritics(str: string): string {
  let result = str.toLowerCase();
  for (const [latin, chars] of Object.entries(VIETNAMESE_MAP)) {
    for (const char of chars) {
      result = result.replaceAll(char, latin);
    }
  }
  return result;
}

function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  const normalizedText = removeVietnameseDiacritics(text);
  const normalizedQuery = removeVietnameseDiacritics(query);
  return normalizedText.includes(normalizedQuery);
}

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

interface FKSelectProps {
  label: string;
  required?: boolean;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  options?: FKOption[];
  placeholder?: string;
  canCreate?: boolean;
  onCreateNew?: () => void;
  loading?: boolean;
  testId?: string;
  'data-testid'?: string;
  resource?: string;
  searchPlaceholder?: string;
  /** Auto-fetch options from Directory API by type */
  directoryType?: string;
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
}: FKSelectProps) {
  testId = testId ?? dataTestId;
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-fetch from Directory API if directoryType is set
  const { data: directoryOptions, isLoading: directoryLoading } =
    useDirectoryOptions(directoryType);

  const options = directoryType ? (directoryOptions ?? []) : (optionsProp ?? []);
  const loading = loadingProp || (directoryType ? directoryLoading : false);

  // Find selected option label
  const selectedOption = options.find((o) => o.value === value);

  // Filter options based on search query
  const filteredOptions = options.filter((o) => smartMatch(o.label, searchQuery));

  // Reset highlight when search query or filtered results change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery]);

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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (filteredOptions.length === 0) {
        if (e.key === "Escape") {
          setIsOpen(false);
          setSearchQuery("");
          setHighlightedIndex(-1);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
            handleSelect(filteredOptions[highlightedIndex].value);
          } else if (filteredOptions.length > 0) {
            handleSelect(filteredOptions[0].value);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setSearchQuery("");
          setHighlightedIndex(-1);
          break;
      }
    },
    [filteredOptions, highlightedIndex, handleSelect]
  );

  return (
    <div ref={containerRef} className="relative" data-testid={testId}>
      {/* Label */}
      <label className={LABEL_BASE}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Trigger button */}
      <div
        onClick={toggleDropdown}
        className={`w-full flex items-center justify-between px-4 py-2.5 border rounded-lg cursor-pointer transition-colors ${
          error
            ? "border-red-300 focus-within:ring-2 focus-within:ring-red-500"
            : "border-slate-300 focus-within:ring-2 focus-within:ring-blue-500"
        } ${isOpen ? "ring-2 ring-blue-500 border-blue-500" : ""} bg-white`}
        data-testid={testId ? `${testId}-trigger` : undefined}
      >
        <span className={`text-sm ${selectedOption ? "text-slate-800" : "text-slate-400"}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && (
            <button
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
              />
            </div>
          </div>

          {/* Options list */}
          <div ref={listRef} className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="ml-2 text-sm text-slate-500">Đang tải...</span>
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">
                Không tìm thấy kết quả
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  data-option-index={index}
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    index === highlightedIndex
                      ? "bg-blue-100 text-blue-800"
                      : option.value === value
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-slate-700 hover:bg-blue-50"
                  }`}
                  data-testid={testId ? `${testId}-option-${option.value}` : undefined}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>

          {/* Create new button (permission-gated) */}
          {canCreate && onCreateNew && (
            <div className="border-t border-slate-200 p-2">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSearchQuery("");
                  setHighlightedIndex(-1);
                  onCreateNew();
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
