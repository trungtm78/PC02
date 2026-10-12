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

  // Focus goes in once, and back to the cell it was last opened from when the popover goes away. Opening it on
  // another figure re-anchors the same popover: that must not hand the focus back to the previous cell.
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;
  useEffect(() => {
    ref.current?.focus();
    return () => anchorRef.current.focus();
  }, []);

  // A popover that outlives its cell would explain the wrong figure: close it when the cell is gone (the
  // table redrew without it), when anything but the popover itself scrolls, and when the window is resized.
  useEffect(() => {
    if (!anchor.isConnected) onClose();
  });
  useEffect(() => {
    const onMove = (e: Event) => {
      if (e.target instanceof Node && ref.current?.contains(e.target)) return; // the list inside it may scroll
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      // Not only from inside: after a Shift+Tab into the grid the focus is elsewhere and Escape must still work.
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

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
      onBlur={(e) => {
        // Focus left for somewhere else: a popover nobody is looking at must not stay up. The cell it came
        // from is the exception — focus going back there (Shift+Tab) keeps it open, Escape still closes it.
        const next = e.relatedTarget as Node | null;
        if (next && !ref.current?.contains(next) && !anchor.contains(next)) onClose();
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
