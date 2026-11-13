import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';
import { permissions as L } from '@/locales/permissions.vi';
import { authzKeys, permissionsApi } from '../api';
import { effectiveSections } from '../effective';
import type { CatalogueIndex } from '../labels';
import type { CatalogueResource, EffectiveView } from '../types';
import { UserOverridesPanel } from './UserOverridesPanel';
import { CARD, INPUT } from './ui';

interface Props {
  resources: readonly CatalogueResource[];
  index: CatalogueIndex;
  canWrite: boolean;
  /** The person to open with (from `?user=`). */
  initialUserId?: string;
  onSelectUser?: (userId: string) => void;
}

const T = L.lookup;

function EffectiveBox({ resources, view }: { resources: readonly CatalogueResource[]; view: EffectiveView }) {
  const [showAll, setShowAll] = useState(false);
  const sections = useMemo(() => effectiveSections(resources, view, showAll), [resources, view, showAll]);
  return (
    <div className={`${CARD} space-y-2 p-4`} data-testid="lookup-effective">
      <p className="text-sm text-slate-700" data-testid="lookup-teams">
        {view.teams.length > 0 ? T.teams(view.teams.map((t) => t.name).join(', ')) : T.noTeams}
      </p>
      {view.admin && (
        <p className="text-sm font-medium text-amber-800" data-testid="lookup-admin">
          {T.admin}
        </p>
      )}
      {view.validUntil && <p className="text-xs text-slate-500">{T.validUntil(formatVNDateTime(view.validUntil))}</p>}
      <label className="inline-flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" data-testid="lookup-show-all" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        {T.showAll}
      </label>
      {sections.length === 0 ? (
        <p className="text-sm text-slate-500" data-testid="lookup-nothing">
          {T.nothing}
        </p>
      ) : (
        <ul className="space-y-2 text-sm">
          {sections.map((section) => (
            <li key={section.resourceKey} data-testid={`lookup-resource-${section.resourceKey}`}>
              <span className="font-semibold text-slate-800">{section.label}</span>
              <ul className="pl-4">
                {section.lines.map((line) => (
                  <li key={line.permission} data-testid={`lookup-line-${line.permission}`} className={line.held ? 'text-slate-700' : 'text-slate-400'}>
                    {section.label} · {line.label}: <span className="font-medium">{line.reach}</span> {T.because} {line.why}
                    {line.detail && (
                      <span className="block pl-4 text-xs text-slate-500">
                        {T.reachesLabel} {line.detail}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Pick a person: what they may do, why, and their own exceptions. */
export function LookupTab({ resources, index, canWrite, initialUserId, onSelectUser }: Props) {
  const [userId, setUserId] = useState(initialUserId ?? '');
  const [search, setSearch] = useState('');
  const officers = useOfficerOptions();
  const effective = useQuery({
    queryKey: authzKeys.effective(userId),
    queryFn: () => permissionsApi.effective(userId),
    enabled: !!userId,
  });

  const needle = search.trim().toLocaleLowerCase('vi');
  const options = (officers.data ?? []).filter((o) => o.value === userId || !needle || o.label.toLocaleLowerCase('vi').includes(needle));
  const peopleError = officers.isError ? extractApiError(officers.error, L.common.unknownError).message : '';
  const loadError = effective.isError ? extractApiError(effective.error, L.common.unknownError).message : '';
  const select = (id: string) => {
    setUserId(id);
    onSelectUser?.(id);
  };

  return (
    <div className="space-y-3" data-testid="lookup-tab">
      <LoadErrorBanner error={peopleError} what={T.peopleWhat} onRetry={() => void officers.refetch()} loading={officers.isFetching} data-testid="lookup-people-error" />
      <div className={`${CARD} flex flex-wrap items-end gap-3 p-4`}>
        <label className="text-xs font-medium text-slate-600">
          {T.search}
          <input data-testid="lookup-search" className={`${INPUT} mt-1 block`} value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="text-xs font-medium text-slate-600">
          {T.person}
          <select data-testid="lookup-user" className={`${INPUT} mt-1 block min-w-[16rem]`} value={userId} onChange={(e) => select(e.target.value)}>
            <option value="">{T.pickPlaceholder}</option>
            {/* A person named in the link who is not in the list (e.g. a locked account) can still be looked up. */}
            {userId && !options.some((o) => o.value === userId) && <option value={userId}>{userId}</option>}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!userId && <p className={`${CARD} p-6 text-sm text-slate-500`}>{T.prompt}</p>}
      <LoadErrorBanner error={loadError} what={T.what} onRetry={() => void effective.refetch()} loading={effective.isFetching} data-testid="lookup-load-error" />
      {userId && effective.isLoading && <p className="text-sm text-slate-400">{L.common.loading}</p>}
      {userId && effective.data && <EffectiveBox resources={resources} view={effective.data} />}
      {userId && <UserOverridesPanel key={userId} userId={userId} index={index} canWrite={canWrite} />}
    </div>
  );
}
