import { createElement, type ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { buildIndex } from '../labels';
import { REACH, TEAM_MODE, TEMPLATE_STATUS, type TeamRow, type TemplateSummary } from '../types';
import { RESOURCES } from './fixtures';

export const INDEX = buildIndex(RESOURCES);

export function renderWithClient(ui: ReactElement, route = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  // No JSX here: this file also holds data, and a `.tsx` file may only export components.
  return render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [route] }, ui)));
}

export const TEMPLATES: TemplateSummary[] = [
  {
    id: 'tpl-entry',
    code: 'can-bo-nhap-lieu',
    name: 'Cán bộ nhập liệu',
    description: 'Nhập và sửa hồ sơ của mình',
    status: TEMPLATE_STATUS.ACTIVE,
    revision: 3,
    entries: { 'read:Petition': REACH.OWN, 'write:Petition': REACH.OWN },
    usedByTeams: 2,
  },
  {
    id: 'tpl-lead',
    code: 'lanh-dao-to',
    name: 'Lãnh đạo tổ',
    description: null,
    status: TEMPLATE_STATUS.ACTIVE,
    revision: 1,
    entries: { 'read:Petition': REACH.TEAM_TREE, 'read:User': REACH.ALL, 'write:User': REACH.ALL },
    usedByTeams: 0,
  },
  {
    id: 'tpl-old',
    code: 'mau-cu',
    name: 'Mẫu cũ',
    description: null,
    status: TEMPLATE_STATUS.ARCHIVED,
    revision: 5,
    entries: {},
    usedByTeams: 0,
  },
];

const team = (row: Partial<TeamRow> & Pick<TeamRow, 'teamId' | 'name'>): TeamRow => ({
  code: row.teamId.toUpperCase(),
  parentId: null,
  status: 'ACTIVE',
  members: 5,
  revision: 0,
  config: null,
  governedByTeamId: null,
  governedByTeamName: null,
  ...row,
});

export const TEAMS: TeamRow[] = [
  team({
    teamId: 'doi',
    name: 'Đội 2',
    revision: 4,
    config: { mode: TEAM_MODE.EXPLICIT, memberTemplateId: 'tpl-entry', leaderTemplateId: 'tpl-lead', overrides: [] },
    governedByTeamId: 'doi',
    governedByTeamName: 'Đội 2',
  }),
  team({ teamId: 'to2', name: 'Tổ CT số 2', parentId: 'doi', governedByTeamId: 'doi', governedByTeamName: 'Đội 2' }),
  team({ teamId: 'phuong', name: 'Tổ Phường Bến Nghé' }),
];
