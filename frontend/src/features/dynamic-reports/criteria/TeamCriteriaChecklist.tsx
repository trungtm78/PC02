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
  /** The heading, when the checklist is not about what one team reports (default: "Tiêu chí tổ này phải báo"). */
  sectionLabel?: string;
  /** The counter beside the heading (default: "<team>: 3/8 tiêu chí"). */
  countLabel?: (ticked: number, total: number) => string;
  /**
   * Test ids of a checklist that is not a team's: every id is `<prefix>-<part>` (`<prefix>-item-<key>`). Without it
   * the ids are the team checklist's own (`team-criteria-item-<teamId>-<key>`, `btn-team-criteria-all-<teamId>`).
   */
  testIdPrefix?: string;
  /** True while the ticks must not change (a save of them is on its way): every box and bulk button is off. */
  disabled?: boolean;
}

/** The test ids of one checklist: the team checklist's historical ones, or `<prefix>-…` for another use. */
function testIdsFor(teamId: string, prefix: string | undefined) {
  if (prefix) {
    return {
      root: prefix,
      part: (name: string) => `${prefix}-${name}`,
      button: (name: string) => `${prefix}-${name}`,
      keyed: (name: string, key: string) => `${prefix}-${name}-${key}`,
    };
  }
  return {
    root: `team-criteria-${teamId}`,
    part: (name: string) => `team-criteria-${name}-${teamId}`,
    button: (name: string) => `btn-team-criteria-${name}-${teamId}`,
    keyed: (name: string, key: string) => `team-criteria-${name}-${teamId}-${key}`,
  };
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
  sectionLabel,
  countLabel,
  testIdPrefix,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const shown = filterGroups(groups, query);
  const shownKeys = shown.flatMap((g) => g.items.map((i) => i.key));
  const filtering = query.trim() !== '';
  const ids = testIdsFor(teamId, testIdPrefix);
  const panelId = ids.part('panel');
  const smallButton = `px-2 py-1 border border-slate-300 text-slate-700 text-xs rounded hover:bg-slate-50 disabled:opacity-50 ${A11Y_FOCUS_RING}`;

  return (
    <div className="mt-3 border-t border-slate-100 pt-2" data-testid={ids.root}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          data-testid={ids.button('toggle')}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900 ${A11Y_FOCUS_RING}`}
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          {sectionLabel ?? t.section}
        </button>
        <span
          className={`text-xs ${ticked.size === 0 ? 'text-red-700 font-semibold' : 'text-slate-600'}`}
          data-testid={ids.part('count')}
        >
          {countLabel ? countLabel(ticked.size, total) : t.count(teamName, ticked.size, total)}
        </span>
      </div>

      {open && (
        <div id={panelId} className="mt-2" data-testid={panelId}>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <input
              type="search"
              data-testid={ids.part('search')}
              aria-label={t.search}
              placeholder={t.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 min-w-40 border border-slate-300 rounded px-2 py-1 text-sm"
            />
            <button
              type="button"
              data-testid={ids.button('all')}
              disabled={disabled}
              onClick={() => onChange(tickAll(ticked, shownKeys))}
              className={smallButton}
            >
              {t.all}
            </button>
            <button
              type="button"
              data-testid={ids.button('none')}
              disabled={disabled}
              onClick={() => onChange(untickAll(ticked, shownKeys))}
              className={smallButton}
            >
              {t.none}
            </button>
            <button
              type="button"
              data-testid={ids.button('invert')}
              disabled={disabled}
              onClick={() => onChange(invertTicks(ticked, shownKeys))}
              className={smallButton}
            >
              {t.invert}
            </button>
          </div>
          {filtering && shownKeys.length > 0 && <p className="text-xs text-slate-500 mb-2">{t.filteredNote(shownKeys.length)}</p>}

          {shown.length === 0 ? (
            <p className="text-sm text-slate-500" data-testid={ids.part('nomatch')}>
              {t.noMatch}
            </p>
          ) : (
            <div className="border border-slate-200 rounded max-h-72 overflow-y-auto divide-y divide-slate-100">
              {shown.map((g) => (
                <div key={g.key ?? '__none__'} className="px-2 py-1.5">
                  {g.key !== null && (
                    <GroupBox
                      testId={ids.keyed('group', g.key)}
                      label={g.label ?? g.key}
                      state={groupState(ticked, g)}
                      disabled={disabled}
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
                            data-testid={ids.keyed('item', item.key)}
                            checked={ticked.has(item.key)}
                            disabled={disabled}
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
                  data-testid={ids.part('copy')}
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
                data-testid={ids.button('apply-all')}
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
  disabled,
  onToggle,
}: {
  testId: string;
  label: string;
  state: 'all' | 'some' | 'none';
  disabled: boolean;
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
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
