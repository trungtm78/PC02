import { Eye, Edit, Trash2, Download } from "lucide-react";
import {
  BTN_ICON_BLUE,
  BTN_ICON_RED,
  BTN_ICON_SLATE,
} from "@/constants/styles";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActionButtonsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ActionButtons({ onView, onEdit, onDelete, onDownload }: ActionButtonsProps) {
  return (
    <div className="flex items-center gap-2">
      {onView && (
        <button onClick={onView} className={BTN_ICON_BLUE} title="Xem">
          <Eye className="w-4 h-4" />
        </button>
      )}
      {onEdit && (
        <button onClick={onEdit} className={BTN_ICON_BLUE} title="Sua">
          <Edit className="w-4 h-4" />
        </button>
      )}
      {onDownload && (
        <button onClick={onDownload} className={BTN_ICON_SLATE} title="Tai xuong">
          <Download className="w-4 h-4" />
        </button>
      )}
      {onDelete && (
        <button onClick={onDelete} className={BTN_ICON_RED} title="Xoa">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
