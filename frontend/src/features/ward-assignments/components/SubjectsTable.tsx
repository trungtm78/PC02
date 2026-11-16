/** "Đối tượng": the people a request is about, one editable row each, or "not identified". */
import { Trash2 } from 'lucide-react';
import { useCheDoXem } from '@/components/form/CheDoXem';
import { BTN_ICON_RED, BTN_SECONDARY } from '@/constants/styles';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import { EMPTY_SUBJECT, type WardSubjectRow } from '../formModel';

const CELL_INPUT = 'w-full rounded border border-slate-300 px-2 py-1.5 text-sm read-only:bg-slate-50';
const S = L.form.subjects;

export interface SubjectsTableProps {
  rows: WardSubjectRow[];
  unknown: boolean;
  onRowsChange: (rows: WardSubjectRow[]) => void;
  onUnknownChange: (unknown: boolean) => void;
  /** Row numbers (1-based) whose birth year is refused. */
  badBirthYears?: readonly number[];
}

export function SubjectsTable({ rows, unknown, onRowsChange, onUnknownChange, badBirthYears = [] }: SubjectsTableProps) {
  const readOnly = useCheDoXem();
  const set = (i: number, key: keyof WardSubjectRow, value: string) => onRowsChange(rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  return (
    <div data-testid="ward-subjects">
      <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          data-testid="ward-subjects-unknown"
          checked={unknown}
          disabled={readOnly}
          onChange={(e) => onUnknownChange(e.target.checked)}
        />
        {L.form.fields.subjectsUnknown}
      </label>
      {!unknown && (
        <>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">{S.none}</p>
          ) : (
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-slate-600">
                  <th className="w-10 px-2 py-1">{S.index}</th>
                  <th className="px-2 py-1">{S.fullName}</th>
                  <th className="w-24 px-2 py-1">{S.birthYear}</th>
                  <th className="w-40 px-2 py-1">{S.idNumber}</th>
                  <th className="px-2 py-1">{S.address}</th>
                  {!readOnly && <th className="w-12 px-2 py-1"><span className="sr-only">{S.remove}</span></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} data-testid={`ward-subject-${i + 1}`} className="align-top">
                    <td className="px-2 py-1 tabular-nums text-slate-500">{i + 1}</td>
                    <td className="px-2 py-1">
                      <input aria-label={`${S.fullName} ${i + 1}`} className={CELL_INPUT} readOnly={readOnly} value={r.fullName} onChange={(e) => set(i, 'fullName', e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        aria-label={`${S.birthYear} ${i + 1}`}
                        inputMode="numeric"
                        maxLength={4}
                        aria-invalid={badBirthYears.includes(i + 1) || undefined}
                        className={`${CELL_INPUT} ${badBirthYears.includes(i + 1) ? 'border-red-500' : ''}`}
                        readOnly={readOnly}
                        value={r.birthYear}
                        onChange={(e) => set(i, 'birthYear', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input aria-label={`${S.idNumber} ${i + 1}`} className={CELL_INPUT} readOnly={readOnly} value={r.idNumber} onChange={(e) => set(i, 'idNumber', e.target.value)} />
                    </td>
                    <td className="px-2 py-1">
                      <input aria-label={`${S.address} ${i + 1}`} className={CELL_INPUT} readOnly={readOnly} value={r.address} onChange={(e) => set(i, 'address', e.target.value)} />
                    </td>
                    {!readOnly && (
                      <td className="px-2 py-1">
                        <button type="button" className={BTN_ICON_RED} aria-label={S.removeRow(i + 1)} onClick={() => onRowsChange(rows.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!readOnly && (
            <button type="button" data-testid="ward-subject-add" className={`${BTN_SECONDARY} mt-2 text-sm`} onClick={() => onRowsChange([...rows, { ...EMPTY_SUBJECT }])}>
              {S.add}
            </button>
          )}
        </>
      )}
    </div>
  );
}
