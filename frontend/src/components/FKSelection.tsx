import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Search, ChevronDown, X, Loader2 } from "lucide-react";
import { LABEL_BASE, FIELD_ERROR_TEXT } from "@/constants/styles";
import { usePermission } from "@/hooks/usePermission";

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

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FKOption {
  value: string;
  label: string;
}

interface FKSelectionProps {
  label: string;
  required?: boolean;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  options: FKOption[];
  placeholder?: string;
  /** Resource name for permission checking (e.g., 'cases', 'users') */
  resource: string;
  /** Called when user clicks "Tạo mới" button */
  onCreateNew?: () => void;
  /** Loading state while fetching options */
  loading?: boolean;
  /** data-testid for E2E */
  testId?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function FKSelection({
  label,
  required,
  error,
  value,
  onChange,
  options,
  placeholder = "Tìm kiếm hoặc chọn...",
  resource,
  onCreateNew,
  loading = false,
  testId,
}: FKSelectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Use permission hook to check create permission
  const { canCreate } = usePermission();
  const hasCreatePermission = canCreate(resource);

  // Find selected option label
  const selectedOption = options.find((o) => o.value === value);

  // Filter options based on search query
  const filteredOptions = options.filter((o) => fuzzyMatch(o.label, searchQuery));
  const hasNoResults = filteredOptions.length === 0 && searchQuery.length > 0 && !loading;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
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

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setIsOpen(false);
      setSearchQuery("");
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
    }
  }, [isOpen]);

  const handleCreateNew = () => {
    setIsOpen(false);
    setSearchQuery("");
    onCreateNew?.();
  };

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
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Nhập để tìm kiếm..."
                data-testid={testId ? `${testId}-search` : undefined}
              />
            </div>
          </div>

          {/* Options list */}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <span className="ml-2 text-sm text-slate-500">Đang tải...</span>
              </div>
            ) : hasNoResults ? (
              <div className="py-6 text-center">
                <p className="text-sm text-slate-500 mb-3">Không tìm thấy kết quả</p>
                {/* Edge case EC-04: Suggest create new if has permission */}
                {hasCreatePermission && onCreateNew && (
                  <button
                    onClick={handleCreateNew}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    data-testid={testId ? `${testId}-create-suggestion` : undefined}
                  >
                    Nhấn để tạo mới "{searchQuery}"
                  </button>
                )}
              </div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                    option.value === value
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-700"
                  }`}
                  data-testid={testId ? `${testId}-option-${option.value}` : undefined}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>

          {/* Create new button (permission-gated) */}
          {/* Edge case EC-01: Hidden if no create permission */}
          {hasCreatePermission && onCreateNew && !hasNoResults && (
            <div className="border-t border-slate-200 p-2">
              <button
                onClick={handleCreateNew}
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
