import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS,
  DYN_REPORT_SUBMISSION_STATE_LABEL,
} from '@/shared/enums/status-labels';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import type { FieldAggregateView } from '../types';

/**
 * The teams behind one aggregated figure (S18 drill-down, on the grid): opened
 * from an input cell of the aggregate view. It lists exactly the teams counted
 * in that figure — the server builds `contributors` from the same population
 * as the total — so the list always adds up to the number the cell shows.
 *
 * A dialog, not a tooltip: it takes focus, closes on Escape or an outside click
 * and hands focus back to the cell, so a keyboard user is never stranded.
 */

const WIDTH = 360;
const MARGIN = 8;

export interface GridContributorsPopoverProps {
  field: FieldAggregateView;
  /** The cell it was opened from: positions the dialog and gets the focus back. */
  anchor: HTMLElement;
  onClose: () => void;
}

export default function GridContributorsPopover({ field, anchor, onClose }: GridContributorsPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: MARGIN, top: MARGIN });

  // Under the cell, flipped above it / pulled back inside the window when there is no room.
  useLayoutEffect(() => {
    const box = anchor.getBoundingClientRect();
    const height = ref.current?.offsetHeight ?? 0;
    const maxLeft = Math.max(MARGIN, window.innerWidth - WIDTH - MARGIN);
    const left = Math.min(Math.max(MARGIN, box.left), maxLeft);
    const below = box.bottom + 4;
    const top =
      below + height <= window.innerHeight - MARGIN ? below : Math.max(MARGIN, box.top - height - 4);
    setPos({ left, top });
  }, [anchor, field]);

  useEffect(() => {
    ref.current?.focus();
    return () => anchor.focus();
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // The cell it came from is left to its own click handler, which toggles: closing here would let that
      // same click open it again.
      if (ref.current && !ref.current.contains(target) && !anchor.contains(target)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [onClose, anchor]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Các tổ đóng góp cho ${field.label || field.fieldKey}`}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      data-testid="contributors-popover"
      className={`fixed z-50 bg-white border border-slate-300 rounded-lg shadow-lg p-3 text-xs ${A11Y_FOCUS_RING}`}
      style={{ left: pos.left, top: pos.top, width: WIDTH, maxWidth: `calc(100vw - ${MARGIN * 2}px)` }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-semibold text-slate-800 text-sm">{field.label || field.fieldKey}</p>
          <p className="text-slate-500">
            {field.sheetKey}!{field.address}
          </p>
        </div>
        <button
          type="button"
          aria-label="Đóng"
          onClick={onClose}
          className={`p-1 rounded text-slate-500 hover:bg-slate-100 ${A11Y_FOCUS_RING}`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-slate-500">Tổng hợp</span>
        <span className="font-semibold text-slate-800 text-sm" data-testid="contributors-total">
          {field.displayNotAggregated ? '— / Không tổng hợp' : (field.value ?? '—')}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <span className="text-slate-500">Số tổ có số liệu</span>
        <span className="text-slate-700" data-testid="contributors-count">
          {field.countNonBlank}/{field.countTotal}
        </span>
      </div>

      {field.contributors.length === 0 ? (
        <p className="text-slate-500" data-testid="contributors-empty">
          Chưa có tổ nào đóng góp vào chỉ tiêu này ở chế độ hiện tại.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 max-h-64 overflow-auto">
          {field.contributors.map((c, i) => (
            <li
              key={`${c.teamName}-${i}`}
              data-testid={`contributor-${c.teamName}`}
              className="py-1.5 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-slate-800 truncate">{c.teamName}</p>
                <p className="text-slate-500">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded font-medium ${DYN_REPORT_SUBMISSION_STATE_BADGE_CLASS[c.state]}`}
                  >
                    {DYN_REPORT_SUBMISSION_STATE_LABEL[c.state]}
                  </span>
                  {c.updatedAt ? ` · ${formatVNDateTime(c.updatedAt)}` : ''}
                </p>
              </div>
              <span className="font-medium text-slate-800 text-sm">{c.value ?? '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
