/**
 * Which teams appear in a custom report. Everything is ticked to begin with; the person unticks what is not wanted.
 * A team with teams under it ticks or clears them with itself; a parent that is not in the period is a heading that
 * ticks or clears the teams under it.
 */
import { useEffect, useRef, useState } from 'react';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { reportCriteria } from '@/locales/reportCriteria.vi';
import { tickAll, untickAll } from '../criteria/criteria';
import { filterTeamNodes, nodeState } from './customReport';
import type { TeamNode } from './customReport';

const t = reportCriteria.customReport.builder;

interface Props {
  nodes: readonly TeamNode[];
  /** How many teams the period has. */
  total: number;
  ticked: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** True while the ticks must not change (a save of them is on its way): every box and bulk button is off. */
  disabled?: boolean;
}

export default function TeamTreePicker({ nodes, total, ticked, onChange, disabled = false }: Props) {
  const [query, setQuery] = useState('');
  const shown = filterTeamNodes(nodes, query);
  const shownIds = shown.filter((n) => n.inPeriod).map((n) => n.id);
  const filtering = query.trim() !== '';
  const smallButton = `px-2 py-1 border border-slate-300 text-slate-700 text-xs rounded hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`;

  return (
    <div data-testid="custom-report-teams">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-700">{t.teamsSection}</span>
        <span
          className={`text-xs ${ticked.size === 0 ? 'text-red-700 font-semibold' : 'text-slate-600'}`}
          data-testid="custom-report-teams-count"
        >
          {t.teamsCount(ticked.size, total)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 my-2">
        <input
          type="search"
          data-testid="custom-report-teams-search"
          aria-label={t.teamSearch}
          placeholder={t.teamSearch}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-40 border border-slate-300 rounded px-2 py-1 text-sm"
        />
        <button type="button" data-testid="custom-report-teams-all" disabled={disabled} onClick={() => onChange(tickAll(ticked, shownIds))} className={smallButton}>
          {t.teamAll}
        </button>
        <button type="button" data-testid="custom-report-teams-none" disabled={disabled} onClick={() => onChange(untickAll(ticked, shownIds))} className={smallButton}>
          {t.teamNone}
        </button>
      </div>
      {filtering && shownIds.length > 0 && <p className="text-xs text-slate-500 mb-2">{t.teamFilteredNote(shownIds.length)}</p>}

      {shown.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="custom-report-teams-nomatch">
          {t.teamNoMatch}
        </p>
      ) : (
        <ul className="border border-slate-200 rounded max-h-72 overflow-y-auto px-2 py-1.5">
          {shown.map((node) => (
            <li key={node.id} style={{ paddingLeft: `${node.depth * 1.25}rem` }} data-depth={node.depth}>
              <TeamBox
                node={node}
                ticked={ticked}
                disabled={disabled}
                onToggle={(on) => {
                  // A line with teams under it carries them with it; a single team is only itself.
                  const ids = node.hasChildren ? node.memberIds : [node.id];
                  onChange(on ? tickAll(ticked, ids) : untickAll(ticked, ids));
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TeamBox({
  node,
  ticked,
  disabled,
  onToggle,
}: {
  node: TeamNode;
  ticked: ReadonlySet<string>;
  disabled: boolean;
  onToggle: (on: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  const state = nodeState(ticked, node);
  // A team in the period shows its own tick; a heading shows the teams under it ("some" is a property, not an attribute).
  const checked = node.inPeriod ? ticked.has(node.id) : state === 'all';
  const indeterminate = !node.inPeriod && state === 'some';
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className={`flex items-center gap-2 py-0.5 text-sm cursor-pointer ${node.hasChildren ? 'font-semibold text-slate-800' : ''}`}>
      <input
        ref={ref}
        type="checkbox"
        data-testid={`custom-report-team-${node.id}`}
        aria-label={node.hasChildren ? t.teamGroupOf(node.name) : undefined}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span>{node.name}</span>
    </label>
  );
}
