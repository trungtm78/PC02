/** Read-only overview of who reports what: one row per criterion, one column per team, a mark where the team owes it. */
import { Check } from 'lucide-react';
import { reportCriteria } from '@/locales/reportCriteria.vi';
import type { ReportableItem } from './criteria';

const t = reportCriteria.teams;

interface Props {
  items: readonly ReportableItem[];
  teams: ReadonlyArray<{ id: string; name: string; ticked: ReadonlySet<string> }>;
}

export default function TeamCriteriaMatrix({ items, teams }: Props) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-auto max-h-96" data-testid="team-criteria-matrix">
      <table className="text-xs border-collapse w-full">
        <caption className="sr-only">{t.matrixCaption}</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky top-0 left-0 z-10 bg-slate-100 text-left px-2 py-1 border-b border-slate-200">
              {t.matrixCriterion}
            </th>
            {teams.map((team) => (
              <th
                key={team.id}
                scope="col"
                className="sticky top-0 bg-slate-100 px-2 py-1 border-b border-slate-200 whitespace-nowrap"
              >
                {team.name}
                <span className="block font-normal text-slate-500">
                  {team.ticked.size}/{items.length}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key} className="border-b border-slate-100">
              <th scope="row" className="sticky left-0 bg-white text-left font-normal px-2 py-1">
                {item.label}
                {item.unit && <span className="text-slate-500"> ({item.unit})</span>}
              </th>
              {teams.map((team) => {
                const on = team.ticked.has(item.key);
                return (
                  <td
                    key={team.id}
                    className="text-center px-2 py-1"
                    data-testid={`matrix-${team.id}-${item.key}`}
                    data-ticked={on ? 'true' : 'false'}
                  >
                    {on ? <Check className="w-3.5 h-3.5 inline text-green-700" aria-hidden="true" /> : null}
                    <span className="sr-only">{on ? t.matrixYes : t.matrixNo}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
