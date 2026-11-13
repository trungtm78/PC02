import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { usePermission } from '@/hooks/usePermission';
import { extractApiError } from '@/lib/api-errors';
import { permissions as L } from '@/locales/permissions.vi';
import { authzKeys, permissionsApi } from '@/features/permissions/api';
import { buildIndex } from '@/features/permissions/labels';
import { AUTHZ_MODE, PAGE_TAB, PAGE_TABS, SCREEN_PERMISSION, type PageTab } from '@/features/permissions/types';
import { ApplyTab } from '@/features/permissions/components/ApplyTab';
import { HistoryTab } from '@/features/permissions/components/HistoryTab';
import { LookupTab } from '@/features/permissions/components/LookupTab';
import { TeamsTab } from '@/features/permissions/components/TeamsTab';
import { TemplatesTab } from '@/features/permissions/components/TemplatesTab';

const PARAM = { TAB: 'tab', TEAM: 'team', USER: 'user' } as const;
const isTab = (value: string | null): value is PageTab => PAGE_TABS.includes(value as PageTab);

/**
 * "Phân quyền theo tổ": templates, what each team gives, what a person ends up with and why, the history, and the
 * switch that puts all of it into effect.
 * The tab, the team and the person are in the address (`?tab=teams&team=<id>`, `?tab=lookup&user=<id>`), so the team
 * and user screens can link straight here.
 */
export default function PermissionsPage() {
  const [params, setParams] = useSearchParams();
  const { permissions: held } = usePermission();
  // Unknown yet (profile still loading) = shown: the server refuses anyway, and buttons that blink in are worse.
  const canWrite = held === null || held.includes(SCREEN_PERMISSION.WRITE);

  const catalogue = useQuery({ queryKey: authzKeys.catalogue, queryFn: permissionsApi.catalogue });
  const resources = useMemo(() => catalogue.data?.resources ?? [], [catalogue.data]);
  const index = useMemo(() => buildIndex(resources), [resources]);
  const loadError = catalogue.isError ? extractApiError(catalogue.error, L.common.unknownError).message : '';

  const requested = params.get(PARAM.TAB);
  const tab: PageTab = isTab(requested) ? requested : PAGE_TAB.TEMPLATES;
  const setParam = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) next.set(key, value);
    setParams(next, { replace: true });
  };
  const mode = catalogue.data?.mode;

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6" data-testid="permissions-page">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold text-slate-800">{L.title}</h1>
      </div>

      <LoadErrorBanner error={loadError} what={L.common.catalogueWhat} onRetry={() => void catalogue.refetch()} loading={catalogue.isFetching} data-testid="permissions-load-error" />

      {mode && (
        <div
          role="status"
          data-testid="permissions-mode"
          data-mode={mode}
          className={`rounded-md border px-4 py-2 text-sm ${
            mode === AUTHZ_MODE.ENFORCE ? 'border-green-300 bg-green-50 text-green-900' : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
        >
          {L.mode[mode] ?? mode}
        </div>
      )}
      {catalogue.isSuccess && !canWrite && (
        <p className="text-xs text-slate-500" data-testid="permissions-read-only">
          {L.common.readOnly}
        </p>
      )}

      <div className="flex flex-wrap gap-1" role="tablist">
        {PAGE_TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            data-testid={`permissions-tab-${key}`}
            onClick={() => setParam({ [PARAM.TAB]: key })}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              tab === key ? 'border-primary bg-blue-50 font-semibold text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {L.tabs[key]}
          </button>
        ))}
      </div>

      {catalogue.isLoading && <p className="text-sm text-slate-400">{L.common.loading}</p>}
      {/* Without the catalogue no permission can be named: the tabs wait for it rather than show raw keys. */}
      {catalogue.isSuccess && (
        <>
          {tab === PAGE_TAB.TEMPLATES && <TemplatesTab resources={resources} index={index} canWrite={canWrite} />}
          {tab === PAGE_TAB.TEAMS && (
            <TeamsTab
              index={index}
              canWrite={canWrite}
              initialTeamId={params.get(PARAM.TEAM) ?? undefined}
              onSelectTeam={(teamId) => setParam({ [PARAM.TAB]: PAGE_TAB.TEAMS, [PARAM.TEAM]: teamId })}
            />
          )}
          {tab === PAGE_TAB.LOOKUP && (
            <LookupTab
              resources={resources}
              index={index}
              canWrite={canWrite}
              initialUserId={params.get(PARAM.USER) ?? undefined}
              onSelectUser={(userId) => setParam({ [PARAM.TAB]: PAGE_TAB.LOOKUP, [PARAM.USER]: userId })}
            />
          )}
          {tab === PAGE_TAB.HISTORY && <HistoryTab index={index} canWrite={canWrite} />}
          {tab === PAGE_TAB.APPLY && <ApplyTab index={index} canWrite={canWrite} />}
        </>
      )}
    </div>
  );
}
