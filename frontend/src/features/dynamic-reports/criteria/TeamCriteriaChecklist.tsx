/**
 * "Tiêu chí tổ này phải báo": which of the report's criteria ONE team reports. Everything is ticked to begin with;
 * the author unticks what the team does not owe. A parent criterion's box ticks or clears its children.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { reportCriteria } from '@/locales/reportCriteria.vi';
import { filterGroups, groupState, invertTicks, tickAll, toggleTick, untickAll } from './criteria';
import type { ItemGroup } from './criteria';

const t = reportCriteria.teams;

interface Props {
  teamId: string;
  teamName: string;
  groups: readonly ItemGroup[];
  /** How many items the report has in all. */
  total: number;
  ticked: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  /** The other teams of the report, to copy ticks from. */
  otherTeams: ReadonlyArray<{ id: string; name: string }>;
  onCopyFrom: (teamId: string) => void;
  onApplyToAll: () => void;
  /** True where the checklist is the whole point of the panel it sits in: it starts unfolded. */
  defaultOpen?: boolean;
}

export default function TeamCriteriaChecklist({
  teamId,
  teamName,
  groups,
  total,
  ticked,
  onChange,
  otherTeams,
  onCopyFrom,
  onApplyToAll,
  defaultOpen = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const shown = filterGroups(groups, query);
  const shownKeys = shown.flatMap((g) => g.items.map((i) => i.key));
  const filtering = query.trim() !== '';
  const panelId = `team-criteria-panel-${teamId}`;
  const smallButton = `px-2 py-1 border border-slate-300 text-slate-700 text-xs rounded hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`;

  return (
    <div className="mt-3 border-t border-slate-100 pt-2" data-testid={`team-criteria-${teamId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          data-testid={`btn-team-criteria-toggle-${teamId}`}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 ${A11Y_FOCUS_RING}`}
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {t.section}
        </button>
        <span
          className={`text-xs ${ticked.size === 0 ? 'text-red-700 font-semibold' : 'text-slate-600'}`}
          data-testid={`team-criteria-count-${teamId}`}
        >
          {t.count(teamName, ticked.size, total)}
        </span>
      </div>

      {open && (
        <div id={panelId} className="mt-2" data-testid={`team-criteria-panel-${teamId}`}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <input
              type="search"
              data-testid={`team-criteria-search-${teamId}`}
              aria-label={t.search}
              placeholder={t.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 min-w-40 border border-slate-300 rounded px-2 py-1 text-sm"
            />
            <button
              type="button"
              data-testid={`btn-team-criteria-all-${teamId}`}
              onClick={() => onChange(tickAll(ticked, shownKeys))}
              className={smallButton}
            >
              {t.all}
            </button>
            <button
              type="button"
              data-testid={`btn-team-criteria-none-${teamId}`}
              onClick={() => onChange(untickAll(ticked, shownKeys))}
              className={smallButton}
            >
              {t.none}
            </button>
            <button
              type="button"
              data-testid={`btn-team-criteria-invert-${teamId}`}
              onClick={() => onChange(invertTicks(ticked, shownKeys))}
              className={smallButton}
            >
              {t.invert}
            </button>
          </div>
          {filtering && shownKeys.length > 0 && <p className="text-xs text-slate-500 mb-2">{t.filteredNote(shownKeys.length)}</p>}

          {shown.length === 0 ? (
            <p className="text-sm text-slate-500" data-testid={`team-criteria-nomatch-${teamId}`}>
              {t.noMatch}
            </p>
          ) : (
            <div className="border border-slate-200 rounded max-h-72 overflow-y-auto divide-y divide-slate-100">
              {shown.map((g) => (
                <div key={g.key ?? '__none__'} className="px-2 py-1.5">
                  {g.key !== null && (
                    <GroupBox
                      testId={`team-criteria-group-${teamId}-${g.key}`}
                      label={g.label ?? g.key}
                      state={groupState(ticked, g)}
                      onToggle={(on) => {
                        const keys = g.items.map((i) => i.key);
                        onChange(on ? tickAll(ticked, keys) : untickAll(ticked, keys));
                      }}
                    />
                  )}
                  <ul className={g.key !== null ? 'ml-6' : ''}>
                    {g.items.map((item) => (
                      <li key={item.key}>
                        <label className="flex items-center gap-2 py-0.5 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            data-testid={`team-criteria-item-${teamId}-${item.key}`}
                            checked={ticked.has(item.key)}
                            onChange={() => onChange(toggleTick(ticked, item.key))}
                          />
                          <span>{item.label}</span>
                          {item.unit && <span className="text-xs text-slate-500">({item.unit})</span>}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {otherTeams.length > 0 && (
              <label className="flex items-center gap-1 text-xs text-slate-700">
                {t.copyFrom}
                <select
                  data-testid={`team-criteria-copy-${teamId}`}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) onCopyFrom(e.target.value);
                  }}
                  className={`border border-slate-300 rounded px-2 py-1 text-xs ${A11Y_FOCUS_RING}`}
                >
                  <option value="">{t.copyPlaceholder}</option>
                  {otherTeams.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {otherTeams.length > 0 && (
              <button
                type="button"
                data-testid={`btn-team-criteria-apply-all-${teamId}`}
                onClick={onApplyToAll}
                className={smallButton}
              >
                {t.applyToAll}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupBox({
  testId,
  label,
  state,
  onToggle,
}: {
  testId: string;
  label: string;
  state: 'all' | 'some' | 'none';
  onToggle: (on: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  // "Some ticked" has no attribute in HTML: it is a property of the element.
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);
  return (
    <label className="flex items-center gap-2 py-0.5 text-sm font-semibold text-slate-800 cursor-pointer">
      <input
        ref={ref}
        type="checkbox"
        data-testid={testId}
        aria-label={t.groupOf(label)}
        checked={state === 'all'}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
