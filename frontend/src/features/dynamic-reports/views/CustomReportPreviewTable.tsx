/**
 * The custom report as the Excel file will show it: title, the line describing the filter, the table, the footnotes.
 * Every figure comes from the server (the file is made from the same answer); only the words are chosen here.
 */
import { AlertTriangle } from 'lucide-react';
import { customReportMarkText, customReportNoteText, reportCriteria } from '@/locales/reportCriteria.vi';
import type { CustomReportPreview } from './types';

const t = reportCriteria.customReport;
const p = t.preview;

export default function CustomReportPreviewTable({ preview }: { preview: CustomReportPreview }) {
  // Team columns exist only when the report has them: a row then carries one cell per team.
  const teamColumns = preview.rows.some((r) => r.cells.length > 0) ? preview.teams : [];
  const ignoredTeams = preview.ignored.teams.map((team) => team.name ?? p.unknownTeam).join(', ');

  return (
    <div data-testid="custom-report-preview">
      {preview.ignored.teams.length > 0 && (
        <p className="flex gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-2" data-testid="custom-report-ignored-teams">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {p.ignoredTeams(ignoredTeams)}
        </p>
      )}
      {preview.ignored.itemKeys.length > 0 && (
        <p className="flex gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2 mb-2" data-testid="custom-report-ignored-criteria">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {p.ignoredCriteria(preview.ignored.itemKeys.length)}
        </p>
      )}
      {preview.newCriteria > 0 && (
        <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded p-2 mb-2" data-testid="custom-report-new-criteria">
          {p.newCriteria(preview.newCriteria)}
        </p>
      )}

      <p className="text-base font-semibold text-slate-800 text-center" data-testid="custom-report-preview-title">
        {preview.title}
      </p>
      {preview.filterLine !== null && (
        <p className="text-xs text-slate-600 text-center mb-2" data-testid="custom-report-preview-filter-line">
          {p.filterLine({
            teamNames: preview.teams.map((team) => team.name),
            teamsTotal: preview.counts.teams.total,
            criteriaSelected: preview.counts.criteria.selected,
            criteriaTotal: preview.counts.criteria.total,
            mode: t.modes[preview.mode],
          })}
        </p>
      )}

      {/* A long report scrolls inside this box, so the buttons under it stay within reach. */}
      <div className="overflow-auto max-h-[28rem] border border-slate-200 rounded mt-2">
        <table className="min-w-full text-sm" data-testid="custom-report-preview-table">
          <thead className="bg-slate-50 text-slate-600 text-xs sticky top-0">
            <tr>
              <th scope="col" className="text-left px-2 py-1.5 whitespace-nowrap">{p.columns.code}</th>
              <th scope="col" className="text-left px-2 py-1.5 min-w-56">{p.columns.label}</th>
              <th scope="col" className="text-left px-2 py-1.5 whitespace-nowrap">{p.columns.unit}</th>
              <th scope="col" className="text-right px-2 py-1.5 whitespace-nowrap">{p.columns.total}</th>
              {teamColumns.map((team) => (
                <th key={team.teamId} scope="col" className="text-right px-2 py-1.5 whitespace-nowrap">
                  {team.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {preview.rows.map((row) => (
              <tr
                key={`${row.kind}:${row.itemKey}`}
                data-testid={`custom-report-row-${row.itemKey}`}
                data-kind={row.kind}
                data-depth={row.depth}
                className={row.kind === 'GROUP' ? 'bg-slate-50 font-semibold text-slate-800' : 'text-slate-700'}
              >
                <td className="px-2 py-1 whitespace-nowrap text-slate-500">{row.code ?? ''}</td>
                <td className="px-2 py-1" style={{ paddingLeft: `${0.5 + row.depth * 1.25}rem` }}>
                  {row.label}
                  {row.partial && (
                    <span className="ml-2 text-xs font-normal text-amber-700" data-testid={`custom-report-partial-${row.itemKey}`}>
                      ({p.partialTag})
                    </span>
                  )}
                </td>
                <td className="px-2 py-1 whitespace-nowrap text-slate-500">{row.unit ?? ''}</td>
                <td className="px-2 py-1 text-right tabular-nums font-medium" data-testid={`custom-report-total-${row.itemKey}`}>
                  {row.total ?? (row.totalMark ? customReportMarkText(row.totalMark, preview.mode) : '')}
                </td>
                {teamColumns.map((team, i) => {
                  const cell = row.cells[i];
                  const mark = cell && cell.value === null && cell.mark ? customReportMarkText(cell.mark, preview.mode) : null;
                  return (
                    <td
                      key={team.teamId}
                      data-testid={`custom-report-cell-${row.itemKey}-${team.teamId}`}
                      className={`px-2 py-1 text-right whitespace-nowrap ${mark !== null ? 'text-xs font-normal text-slate-500' : 'tabular-nums'}`}
                    >
                      {cell?.value ?? mark ?? ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.notes.length > 0 && (
        <div className="mt-2 text-xs text-slate-600" data-testid="custom-report-notes">
          <p className="font-medium">{p.notesHeading}</p>
          <ul className="list-disc ml-5">
            {preview.notes.map((note, i) => (
              <li key={`${note.code}:${i}`} data-testid={`custom-report-note-${note.code}`}>
                {customReportNoteText(note)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
