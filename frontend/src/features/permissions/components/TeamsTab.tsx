import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { extractApiError } from '@/lib/api-errors';
import { permissions as L } from '@/locales/permissions.vi';
import { authzKeys, permissionsApi } from '../api';
import type { CatalogueIndex } from '../labels';
import { flattenTeams, teamChip } from '../teamTree';
import { TeamConfigPanel } from './TeamConfigPanel';
import { CARD, Notice } from './ui';

interface Props {
  index: CatalogueIndex;
  canWrite: boolean;
  /** The team to open with (from `?team=`). */
  initialTeamId?: string;
  onSelectTeam?: (teamId: string) => void;
}

const T = L.teams;

/** Permissions per team: the tree on the left, the chosen team's configuration on the right. */
export function TeamsTab({ index, canWrite, initialTeamId, onSelectTeam }: Props) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(initialTeamId ?? '');
  const [notice, setNotice] = useState('');
  const [reloads, setReloads] = useState(0);
  const teamsQuery = useQuery({ queryKey: authzKeys.teams, queryFn: permissionsApi.teams });
  const templatesQuery = useQuery({ queryKey: authzKeys.templates, queryFn: permissionsApi.templates });

  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);
  const rows = useMemo(() => flattenTeams(teams), [teams]);
  const selected = teams.find((t) => t.teamId === selectedId);
  const failed = teamsQuery.isError ? teamsQuery : templatesQuery.isError ? templatesQuery : null;
  const loadError = failed ? extractApiError(failed.error, L.common.unknownError).message : '';
  const loading = teamsQuery.isLoading || templatesQuery.isLoading;

  const refresh = () => void queryClient.invalidateQueries({ queryKey: authzKeys.all });
  const select = (teamId: string) => {
    setSelectedId(teamId);
    setNotice('');
    onSelectTeam?.(teamId);
  };

  return (
    <div className="space-y-3" data-testid="teams-tab">
      <LoadErrorBanner
        error={loadError}
        what={teamsQuery.isError ? T.what : L.templates.what}
        onRetry={() => {
          void teamsQuery.refetch();
          void templatesQuery.refetch();
        }}
        loading={teamsQuery.isFetching || templatesQuery.isFetching}
        data-testid="teams-load-error"
      />
      <Notice text={notice} testId="teams-notice" />
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,1fr)_2fr]">
        <div className={CARD}>
          <div className="rounded-t-lg border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">{T.listTitle}</div>
          {loading ? (
            <p className="p-6 text-center text-sm text-slate-400">{L.common.loading}</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400" data-testid="teams-empty">
              {loadError ? L.templates.notLoaded : T.empty}
            </p>
          ) : (
            <ul className="max-h-[70vh] overflow-y-auto" data-testid="teams-tree">
              {rows.map(({ team, depth }) => {
                const chip = teamChip(team);
                return (
                  <li key={team.teamId}>
                    <button
                      type="button"
                      data-testid={`team-row-${team.teamId}`}
                      data-depth={depth}
                      aria-current={team.teamId === selectedId}
                      onClick={() => select(team.teamId)}
                      style={{ paddingLeft: `${depth * 20 + 16}px` }}
                      className={`flex w-full flex-wrap items-center gap-2 border-b border-slate-100 py-2 pr-3 text-left text-sm hover:bg-slate-50 ${
                        team.teamId === selectedId ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span className="font-medium text-slate-800">{team.name}</span>
                      <span
                        data-testid={`team-chip-${team.teamId}`}
                        className={`rounded px-2 py-0.5 text-xs ${chip.own ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {chip.text}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          {selected && templatesQuery.isSuccess ? (
            <TeamConfigPanel
              key={`${selected.teamId}:${selected.revision}:${reloads}`}
              team={selected}
              teams={teams}
              templates={templatesQuery.data}
              index={index}
              canWrite={canWrite}
              onReload={() => {
                // A fresh form on the latest data, even when the revision turns out to be the same.
                setReloads((n) => n + 1);
                refresh();
              }}
              onDone={(message) => {
                setNotice(message);
                refresh();
              }}
            />
          ) : (
            !loading && !loadError && <p className={`${CARD} p-6 text-sm text-slate-500`}>{T.pick}</p>
          )}
        </div>
      </div>
    </div>
  );
}
