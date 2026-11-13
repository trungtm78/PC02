import { Fragment, useEffect, useRef } from 'react';
import { permissions as L } from '@/locales/permissions.vi';
import { capabilityLabel, extraLabel, groupLabel, reachLabel, resourceLabel } from '../labels';
import {
  canTick,
  columnState,
  groupState,
  setPermission,
  setView,
  tickColumn,
  tickGroup,
  viewKeyOf,
  viewReachOf,
  type TickState,
} from '../matrix';
import {
  ACTION_CAPABILITIES,
  PLAIN_REACHES,
  REACH,
  RESOURCE_GROUPS,
  type CatalogueResource,
  type Entries,
  type Reach,
} from '../types';

interface Props {
  resources: readonly CatalogueResource[];
  entries: Entries;
  onChange: (entries: Entries) => void;
  /** Shows the fourth reach, "exactly this team". */
  advanced: boolean;
  readOnly: boolean;
}

const M = L.matrix;

/** A checkbox that can also say "some of them". */
function TriBox({ state, ...rest }: { state: TickState } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'checked'>) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some';
  }, [state]);
  return <input ref={ref} type="checkbox" checked={state === 'all'} {...rest} />;
}

function SensitiveMark() {
  return (
    <span title={M.sensitiveTitle} className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800">
      {M.sensitive}
    </span>
  );
}

/** The matrix of a template: one row per resource, how far it is seen, what may be done, and its other permissions. */
export function TemplateMatrix({ resources, entries, onChange, advanced, readOnly }: Props) {
  const renderView = (resource: CatalogueResource) => {
    const view = viewKeyOf(resource);
    if (!view) return <span className="text-slate-400">—</span>;
    const current = viewReachOf(resource, entries);
    const mark = resource.sensitive.includes(view) && <SensitiveMark />;
    if (!resource.recordScoped) {
      return (
        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            data-testid={`perm-view-${resource.key}`}
            checked={current !== null}
            disabled={readOnly}
            onChange={(e) => onChange(setView(resource, entries, e.target.checked ? REACH.ALL : null))}
          />
          {M.allowed}
          {mark}
        </label>
      );
    }
    const reaches: (Reach | null)[] = [null, ...PLAIN_REACHES];
    // "Exactly this team" is an advanced choice, but one already saved is never hidden.
    if (advanced || current === REACH.TEAM) reaches.splice(2, 0, REACH.TEAM);
    return (
      <span role="radiogroup" aria-label={M.viewOf(resourceLabel(resource.key))} className="inline-flex flex-wrap gap-x-3 gap-y-1">
        {reaches.map((reach) => (
          <label key={reach ?? 'NONE'} className="inline-flex items-center gap-1 whitespace-nowrap">
            <input
              type="radio"
              name={`perm-view-${resource.key}`}
              data-testid={`perm-view-${resource.key}-${reach ?? 'NONE'}`}
              checked={current === reach}
              disabled={readOnly}
              onChange={() => onChange(setView(resource, entries, reach))}
            />
            {reachLabel(reach)}
          </label>
        ))}
        {mark}
      </span>
    );
  };

  /** A tick for one permission key; shows the reach beside it when it is narrower than "view". */
  const renderTick = (resource: CatalogueResource, key: string, testId: string, label?: string, aria?: string) => {
    const reach = entries[key];
    const viewReach = viewReachOf(resource, entries);
    const tickable = canTick(resource, entries);
    return (
      <label className="inline-flex items-center gap-1" title={tickable ? undefined : M.needsView}>
        <input
          type="checkbox"
          data-testid={testId}
          aria-label={aria}
          checked={!!reach}
          disabled={readOnly || !tickable}
          onChange={(e) => onChange(setPermission(resource, entries, key, e.target.checked))}
        />
        {label}
        {reach && viewReach && reach !== viewReach && <span className="text-xs text-slate-500">{M.narrower(reachLabel(reach))}</span>}
        {resource.sensitive.includes(key) && <SensitiveMark />}
      </label>
    );
  };

  const renderExtras = (resource: CatalogueResource) => {
    const extras = Object.entries(resource.extras);
    if (extras.length === 0) return null;
    const ticked = extras.filter(([, key]) => entries[key]).length;
    return (
      <details data-testid={`perm-extras-${resource.key}`}>
        <summary className="cursor-pointer whitespace-nowrap text-slate-600">{M.otherCount(ticked, extras.length)}</summary>
        <div className="mt-1 flex flex-col gap-1">
          {extras.map(([extra, key]) => (
            <span key={extra}>{renderTick(resource, key, `perm-extra-${resource.key}-${extra}`, extraLabel(extra))}</span>
          ))}
        </div>
      </details>
    );
  };

  return (
    <div className="overflow-x-auto" data-testid="perm-matrix">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="px-2 py-2">{M.resource}</th>
            <th className="px-2 py-2">{M.view}</th>
            {ACTION_CAPABILITIES.map((capability) => (
              <th key={capability} className="px-2 py-2 text-center">
                <label className="inline-flex items-center gap-1" title={M.columnTick(capabilityLabel(capability))}>
                  <TriBox
                    data-testid={`perm-col-${capability}`}
                    aria-label={M.columnTick(capabilityLabel(capability))}
                    state={columnState(resources, entries, capability)}
                    disabled={readOnly}
                    onChange={(e) => onChange(tickColumn(resources, entries, capability, e.target.checked))}
                  />
                  {capabilityLabel(capability)}
                </label>
              </th>
            ))}
            <th className="px-2 py-2">{M.other}</th>
          </tr>
        </thead>
        <tbody>
          {RESOURCE_GROUPS.map((group) => {
            const rows = resources.filter((r) => r.group === group);
            if (rows.length === 0) return null;
            return (
              <Fragment key={group}>
                <tr className="bg-slate-50">
                  <td colSpan={3 + ACTION_CAPABILITIES.length} className="px-2 py-1.5 font-semibold text-slate-700">
                    <label className="inline-flex items-center gap-2">
                      <TriBox
                        data-testid={`perm-group-${group}`}
                        aria-label={M.groupTick(groupLabel(group))}
                        state={groupState(resources, entries, group)}
                        disabled={readOnly}
                        onChange={(e) => onChange(tickGroup(resources, entries, group, e.target.checked))}
                      />
                      {groupLabel(group)}
                    </label>
                  </td>
                </tr>
                {rows.map((resource) => (
                  <tr key={resource.key} data-testid={`perm-row-${resource.key}`} className="border-b border-slate-100 align-top">
                    <td className="px-2 py-1.5 pl-6 text-slate-800">{resourceLabel(resource.key)}</td>
                    <td className="px-2 py-1.5">{renderView(resource)}</td>
                    {ACTION_CAPABILITIES.map((capability) => {
                      const key = resource.basic[capability];
                      return (
                        <td key={capability} className="px-2 py-1.5 text-center">
                          {key && key !== viewKeyOf(resource) ? renderTick(resource, key, `perm-cap-${resource.key}-${capability}`, undefined, `${resourceLabel(resource.key)} · ${capabilityLabel(capability)}`) : null}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5">{renderExtras(resource)}</td>
                  </tr>
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
