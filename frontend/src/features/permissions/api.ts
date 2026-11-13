import { api } from '@/lib/api';
import type {
  ApplyTeamsBody,
  Catalogue,
  ChangeSet,
  EffectiveView,
  ModeComparison,
  ModeStatus,
  SaveUserOverridesBody,
  UserOverrides,
  PreviewRequest,
  PreviewResult,
  SaveTeamBody,
  SaveTemplateBody,
  StarterTemplatesResult,
  SwitchableMode,
  TeamRow,
  TemplateSummary,
  WriteResult,
} from './types';

const data = <T>(r: { data: T }): T => r.data;

/** Every call of the "permissions by team" screen. Reading needs `read:Role`, changing needs `write:Role`. */
export const permissionsApi = {
  catalogue: () => api.get<Catalogue>('/authz/catalogue').then(data),

  templates: () => api.get<TemplateSummary[]>('/authz/templates').then(data),
  createTemplate: (body: SaveTemplateBody) => api.post<WriteResult>('/authz/templates', body).then(data),
  updateTemplate: (id: string, body: SaveTemplateBody & { expectedRevision: number }) =>
    api.patch<WriteResult>(`/authz/templates/${id}`, body).then(data),
  copyTemplate: (id: string, body: { name: string; reason?: string }) =>
    api.post<WriteResult>(`/authz/templates/${id}/copy`, body).then(data),
  archiveTemplate: (id: string, expectedRevision: number) =>
    api.post<WriteResult>(`/authz/templates/${id}/archive`, { expectedRevision }).then(data),
  restoreTemplate: (id: string, expectedRevision: number) =>
    api.post<WriteResult>(`/authz/templates/${id}/restore`, { expectedRevision }).then(data),
  deleteTemplate: (id: string, expectedRevision: number) =>
    api.delete<WriteResult>(`/authz/templates/${id}`, { params: { expectedRevision } }).then(data),

  /** Creates whichever of the three starter templates do not exist yet, from what the officer role holds. */
  createStarterTemplates: () => api.post<StarterTemplatesResult>('/authz/templates/starters').then(data),

  teams: () => api.get<TeamRow[]>('/authz/teams').then(data),
  saveTeam: (teamId: string, body: SaveTeamBody) => api.put<WriteResult>(`/authz/teams/${teamId}`, body).then(data),
  removeTeamConfig: (teamId: string, expectedRevision: number) =>
    api.delete<WriteResult>(`/authz/teams/${teamId}`, { params: { expectedRevision } }).then(data),
  applyTeams: (body: ApplyTeamsBody) => api.post<WriteResult>('/authz/teams/apply', body).then(data),

  userOverrides: (userId: string) => api.get<UserOverrides>(`/authz/users/${userId}/overrides`).then(data),
  saveUserOverrides: (userId: string, body: SaveUserOverridesBody) =>
    api.put<WriteResult>(`/authz/users/${userId}/overrides`, body).then(data),

  preview: (body: PreviewRequest) => api.post<PreviewResult>('/authz/preview', body).then(data),

  changes: (params: { limit: number; before?: string }) => api.get<ChangeSet[]>('/authz/changes', { params }).then(data),
  undo: (changeId: string, reason?: string) =>
    api.post<WriteResult>(`/authz/changes/${changeId}/undo`, reason ? { reason } : {}).then(data),

  effective: (userId: string) => api.get<EffectiveView>(`/authz/effective/${userId}`).then(data),

  mode: () => api.get<ModeStatus>('/authz/mode').then(data),
  modeComparison: () => api.get<ModeComparison>('/authz/mode/comparison').then(data),
  /** Off or trial run: one administrator, at once. */
  setMode: (body: { mode: SwitchableMode; reason: string }) => api.post<unknown>('/authz/mode', body).then(data),
  /** Enforcing takes two administrators: one asks, another approves, each on the comparison they read. */
  requestEnforce: (body: { reason: string; acknowledge: string }) => api.post<unknown>('/authz/mode/requests', body).then(data),
  approveEnforce: (id: string, body: { acknowledge: string }) =>
    api.post<unknown>(`/authz/mode/requests/${id}/approve`, body).then(data),
  /** The asker withdraws, or another administrator rejects. */
  closeEnforceRequest: (id: string) => api.post<unknown>(`/authz/mode/requests/${id}/close`).then(data),
};

/** Query keys: everything sits under `authz`, so one invalidation after a write refreshes every tab. */
export const authzKeys = {
  all: ['authz'] as const,
  catalogue: ['authz', 'catalogue'] as const,
  templates: ['authz', 'templates'] as const,
  teams: ['authz', 'teams'] as const,
  changes: ['authz', 'changes'] as const,
  effective: (userId: string) => ['authz', 'effective', userId] as const,
  userOverrides: (userId: string) => ['authz', 'user-overrides', userId] as const,
  mode: ['authz', 'mode'] as const,
  modeComparison: ['authz', 'mode-comparison'] as const,
};
