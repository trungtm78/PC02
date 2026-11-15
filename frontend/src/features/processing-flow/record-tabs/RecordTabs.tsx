/**
 * The two extra tabs of a record's form, as pieces the three forms (petition, incident, case) put into their own tab
 * bars. They are NOT among the ten tabs of the old form: they come after them, and the body switches on a separate id,
 * so the form's own tab state and its unsaved edits are never touched by them.
 */
import type { ReactNode } from 'react';
import { AssignmentTab } from './AssignmentTab';
import { RECORD_TAB_IDS, RECORD_TAB_LABEL, type RecordTabId } from './tabAvailability';
import { ResultsTab } from './ResultsTab';
import type { RecordKind } from './types';

interface ButtonsProps {
  active: RecordTabId | null;
  onSelect: (tab: RecordTabId) => void;
  /** `tab-nut-` for the forms that follow the old form's test ids. */
  testIdPrefix?: string;
}

/** The two buttons, in the look of the old form's tab bar. Render inside that bar, after the legacy buttons. */
export function RecordTabButtons({ active, onSelect, testIdPrefix = 'tab-nut-' }: ButtonsProps) {
  return (
    <>
      {RECORD_TAB_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelect(id)}
          data-testid={`${testIdPrefix}${id}`}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
            active === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          {RECORD_TAB_LABEL[id]}
        </button>
      ))}
    </>
  );
}

/**
 * The tabs sit inside the record's own <form>. Pressing Enter in a text box of a tab must not submit THAT form (it would
 * save the record): the tab's own buttons are the only way to act.
 */
export function StopEnterSubmit({ children }: { children: ReactNode }) {
  return (
    <div
      onKeyDown={(event) => {
        const target = event.target as HTMLElement;
        if (event.key === 'Enter' && target.tagName === 'INPUT' && (target as HTMLInputElement).type !== 'button') event.preventDefault();
      }}
    >
      {children}
    </div>
  );
}

interface BodyProps {
  kind: RecordKind;
  recordId: string;
  active: RecordTabId | null;
}

/** The body of the open tab; nothing while no record tab is open. Keyed by the record so it never shows another's flow. */
export function RecordTabBody({ kind, recordId, active }: BodyProps) {
  if (active === 'phan-cong-xu-ly') return <StopEnterSubmit><AssignmentTab key={`${kind}:${recordId}`} kind={kind} recordId={recordId} /></StopEnterSubmit>;
  if (active === 'ket-qua-xu-ly') return <StopEnterSubmit><ResultsTab key={`${kind}:${recordId}`} kind={kind} recordId={recordId} /></StopEnterSubmit>;
  return null;
}
