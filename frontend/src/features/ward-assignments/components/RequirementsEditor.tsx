/** "Yêu cầu": the numbered requirements of a review; add, reorder, delete. Read-only: a numbered list. */
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { BTN_ICON_RED, BTN_ICON_SLATE, BTN_SECONDARY, INPUT_BASE } from '@/constants/styles';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import { addLine, moveLine, removeLine, setLine } from '../requirements';

const R = L.review;

export interface RequirementsEditorProps {
  lines: string[];
  onChange?: (lines: string[]) => void;
  /** The requirements of the previous decision, offered to copy. */
  previous?: string[] | null;
  readOnly?: boolean;
  testId?: string;
}

export function RequirementsEditor({ lines, onChange, previous, readOnly = false, testId = 'ward-requirements' }: RequirementsEditorProps) {
  if (readOnly || !onChange) {
    return lines.length === 0 ? (
      <p data-testid={testId} className="text-sm text-slate-500">{R.noRequirements}</p>
    ) : (
      <ol data-testid={testId} className="list-decimal space-y-1 pl-6 text-sm text-slate-800">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ol>
    );
  }
  return (
    <div data-testid={testId} className="space-y-2">
      {lines.length === 0 && <p className="text-sm text-slate-500">{R.noRequirements}</p>}
      {lines.map((line, i) => (
        <div key={i} className="flex items-start gap-2" data-testid={`${testId}-${i + 1}`}>
          <span className="w-6 pt-2.5 text-right text-sm tabular-nums text-slate-500">{i + 1}.</span>
          <textarea
            rows={1}
            aria-label={`${R.requirements} ${i + 1}`}
            className={`${INPUT_BASE} min-h-[2.75rem] flex-1`}
            placeholder={R.requirementPlaceholder}
            value={line}
            onChange={(e) => onChange(setLine(lines, i, e.target.value))}
          />
          <button type="button" className={BTN_ICON_SLATE} aria-label={R.moveUp(i + 1)} disabled={i === 0} onClick={() => onChange(moveLine(lines, i, -1))}>
            <ArrowUp className="h-4 w-4" />
          </button>
          <button type="button" className={BTN_ICON_SLATE} aria-label={R.moveDown(i + 1)} disabled={i === lines.length - 1} onClick={() => onChange(moveLine(lines, i, 1))}>
            <ArrowDown className="h-4 w-4" />
          </button>
          <button type="button" className={BTN_ICON_RED} aria-label={R.removeRequirement(i + 1)} onClick={() => onChange(removeLine(lines, i))}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" data-testid={`${testId}-add`} className={`${BTN_SECONDARY} text-sm`} onClick={() => onChange(addLine(lines))}>
          {R.addRequirement}
        </button>
        {previous && previous.length > 0 && (
          <button type="button" data-testid={`${testId}-copy`} className={`${BTN_SECONDARY} text-sm`} onClick={() => onChange([...lines, ...previous])}>
            {R.copyPrevious}
          </button>
        )}
      </div>
    </div>
  );
}
