import { useState, useRef, useEffect } from "react";
import { ChevronDown, Save, FileText } from "lucide-react";

/**
 * Nút lưu kiểu split-button cho form đơn thư.
 *  ┌──────────┬───┐
 *  │   Lưu    │ ▼ │  → bấm "Lưu" = onSave (hành vi cũ); ▼ → menu "Lưu" / "Lưu và xuất file".
 *  └──────────┴───┘   "Lưu và xuất file" = onSaveAndExport (mở popup xuất chứng từ).
 */
interface Props {
  onSave: () => void;
  onSaveAndExport: () => void;
  isSubmitting: boolean;
  label?: string;
}

export function SaveSplitButton({
  onSave,
  onSaveAndExport,
  isSubmitting,
  label = "Lưu",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
    return undefined;
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-flex" data-testid="save-split-button">
      <button
        type="button"
        data-testid="btn-save-split-main"
        onClick={onSave}
        disabled={isSubmitting}
        className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded-l-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        {isSubmitting ? "Đang lưu..." : label}
      </button>
      <button
        type="button"
        data-testid="btn-save-split-caret"
        onClick={() => setIsOpen((v) => !v)}
        disabled={isSubmitting}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Tuỳ chọn lưu"
        className="flex items-center px-2 bg-blue-600 text-white rounded-r-lg border-l border-blue-500 hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden"
          data-testid="save-split-menu"
        >
          <button
            type="button"
            role="menuitem"
            data-testid="menu-item-save"
            onClick={() => {
              setIsOpen(false);
              onSave();
            }}
            className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm text-slate-800"
          >
            <Save className="w-4 h-4 text-slate-500 flex-shrink-0" />
            {label}
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="menu-item-save-export"
            onClick={() => {
              setIsOpen(false);
              onSaveAndExport();
            }}
            className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors flex items-center gap-2 text-sm text-slate-800 border-t border-slate-100"
          >
            <FileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
            Lưu và xuất file
          </button>
        </div>
      )}
    </div>
  );
}

export default SaveSplitButton;
