import { describe, it, expect } from 'vitest';
import { buildTeamTree, filterTeamNodes, nodeState, selectionForPayload } from '../customReport';
import {
  customReportErrorText,
  customReportMarkText,
  customReportNoteText,
  reportCriteria,
} from '@/locales/reportCriteria.vi';
import type { CellMark, CustomNote } from '../types';

describe('selectionForPayload', () => {
  it('a saved subset that covers everything this period shows stays that subset when unticked and ticked again', () => {
    // Saved as [a] where the period had a and b; opened where only a exists.
    expect(selectionForPayload(new Set(['a']), ['a'], ['a'])).toEqual(['a']);
    // Ticking something MORE than was saved, up to everything shown, is a real change to "all".
    expect(selectionForPayload(new Set(['a', 'b']), ['a', 'b'], ['a'])).toBeNull();
  });

  it('everything on the screen ticked is null ("all"), never the list of today', () => {
    expect(selectionForPayload(new Set(['a', 'b']), ['a', 'b'])).toBeNull();
  });

  it('a partial selection is the ticked keys in the order shown', () => {
    expect(selectionForPayload(new Set(['c', 'a']), ['a', 'b', 'c'])).toEqual(['a', 'c']);
  });

  it('nothing ticked is an empty list, not "all"', () => {
    expect(selectionForPayload(new Set(), ['a'])).toEqual([]);
  });

  it('keeps what the saved report names that this period does not show', () => {
    expect(selectionForPayload(new Set(['a']), ['a', 'b'], ['a', 'old'])).toEqual(['a', 'old']);
  });

  it('teams: a report saved with [A, B], in a period that only has A, stays [A, B] after A is unticked and ticked again', () => {
    const saved = ['team-a', 'team-b'];
    const periodTeams = ['team-a'];
    // Unticked: only the team this period does not have is left.
    expect(selectionForPayload(new Set(), periodTeams, saved)).toEqual(['team-b']);
    // Ticked again: every team on the screen is ticked, and still it is not "all teams".
    expect(selectionForPayload(new Set(['team-a']), periodTeams, saved)).toEqual(['team-a', 'team-b']);
  });

  it('criteria: everything shown ticked is an explicit list while the saved report names a criterion this version lacks', () => {
    expect(selectionForPayload(new Set(['k1', 'k2']), ['k1', 'k2'], ['k1', 'gone'])).toEqual(['k1', 'k2', 'gone']);
  });

  it('is null only when everything shown is ticked and the saved report names nothing that is absent', () => {
    expect(selectionForPayload(new Set(['a', 'b']), ['a', 'b'], ['a'])).toBeNull();
    expect(selectionForPayload(new Set(['a', 'b']), ['a', 'b'], null)).toBeNull();
    expect(selectionForPayload(new Set(['a', 'b']), ['a', 'b'], [])).toBeNull();
  });
});

describe('buildTeamTree', () => {
  const teams = [
    { teamId: 't2', name: 'Tổ 2' },
    { teamId: 't10', name: 'Tổ 10' },
    { teamId: 'd1', name: 'Đội 1' },
    { teamId: 't1', name: 'Tổ 1' },
  ];

  it('without a directory the teams are a flat list by name, numbers in order', () => {
    const nodes = buildTeamTree(teams, []);
    expect(nodes.map((n) => [n.name, n.depth])).toEqual([
      ['Đội 1', 0],
      ['Tổ 1', 0],
      ['Tổ 2', 0],
      ['Tổ 10', 0],
    ]);
    expect(nodes.every((n) => !n.hasChildren && n.memberIds.length === 1)).toBe(true);
  });

  it('draws children under a parent that is in the period; the parent stands for itself and them', () => {
    const nodes = buildTeamTree(teams, [
      { id: 'd1', name: 'Đội 1', parentId: null },
      { id: 't1', name: 'Tổ 1', parentId: 'd1' },
      { id: 't2', name: 'Tổ 2', parentId: 'd1' },
      { id: 't10', name: 'Tổ 10', parentId: null },
    ]);
    expect(nodes.map((n) => [n.id, n.depth])).toEqual([
      ['d1', 0],
      ['t1', 1],
      ['t2', 1],
      ['t10', 0],
    ]);
    expect(nodes[0]).toMatchObject({ inPeriod: true, hasChildren: true, memberIds: ['d1', 't1', 't2'] });
  });

  it('a parent outside the period is a heading over two or more teams, and is dropped over a single one', () => {
    const nodes = buildTeamTree(
      [
        { teamId: 't1', name: 'Tổ 1' },
        { teamId: 't2', name: 'Tổ 2' },
        { teamId: 't3', name: 'Tổ 3' },
      ],
      [
        { id: 'p', name: 'Phòng A', parentId: null },
        { id: 't1', name: 'Tổ 1', parentId: 'p' },
        { id: 't2', name: 'Tổ 2', parentId: 'p' },
        { id: 'q', name: 'Phòng B', parentId: null },
        { id: 't3', name: 'Tổ 3', parentId: 'q' },
      ],
    );
    expect(nodes.map((n) => [n.id, n.depth, n.inPeriod])).toEqual([
      ['p', 0, false],
      ['t1', 1, true],
      ['t2', 1, true],
      ['t3', 0, true],
    ]);
    expect(nodes[0].memberIds).toEqual(['t1', 't2']);
    expect(nodeState(new Set(['t1']), nodes[0])).toBe('some');
    expect(nodeState(new Set(['t1', 't2']), nodes[0])).toBe('all');
    expect(nodeState(new Set(), nodes[0])).toBe('none');
  });

  it('a loop of parents loses no team', () => {
    const nodes = buildTeamTree(
      [
        { teamId: 'a', name: 'A' },
        { teamId: 'b', name: 'B' },
      ],
      [
        { id: 'a', name: 'A', parentId: 'b' },
        { id: 'b', name: 'B', parentId: 'a' },
      ],
    );
    expect(nodes.filter((n) => n.inPeriod).map((n) => n.id).sort()).toEqual(['a', 'b']);
  });

  it('searching keeps the lines that match and the parents above them, accents ignored', () => {
    const nodes = buildTeamTree(teams, [
      { id: 't1', name: 'Tổ 1', parentId: 'd1' },
      { id: 't2', name: 'Tổ 2', parentId: 'd1' },
    ]);
    expect(filterTeamNodes(nodes, 'to 2').map((n) => n.id)).toEqual(['d1', 't2']);
    expect(filterTeamNodes(nodes, '  ').length).toBe(nodes.length);
    expect(filterTeamNodes(nodes, 'khong co')).toEqual([]);
  });
});

describe('the words of a custom report', () => {
  // Every code the server can answer with (backend/src/dynamic-reports/views): a code without words would reach the screen raw.
  const ERROR_CODES = [
    'VIEW_NAME_REQUIRED',
    'VIEW_NAME_TOO_LONG',
    'VIEW_TITLE_TOO_LONG',
    'VIEW_SELECTION_EMPTY',
    'VIEW_TEAMS_EMPTY',
    'VIEW_ITEM_KEY_UNKNOWN',
    'VIEW_TEAM_UNKNOWN',
    'CUSTOM_REPORT_TOO_LARGE',
    'REPORT_NOT_FOUND',
    'VIEW_NOT_FOUND',
    'PERIOD_NOT_FOUND',
    'VIEW_NAME_TAKEN',
    'REVISION_CONFLICT',
    'VIEW_ARCHIVED',
    'VIEW_ALREADY_ARCHIVED',
    'VIEW_NOT_ARCHIVED',
    'PERIOD_TEAMS_CHANGED',
  ];

  it.each(ERROR_CODES)('error %s has its own sentence', (code) => {
    const text = customReportErrorText(code, code);
    expect(text).not.toBe(code);
    expect(text).not.toBe(reportCriteria.errorFallback);
    expect(text.trim().length).toBeGreaterThan(10);
  });

  it('an unknown code is never shown raw', () => {
    expect(customReportErrorText('SOMETHING_NEW', 'SOMETHING_NEW')).toBe(reportCriteria.errorFallback);
    expect(customReportErrorText(undefined, 'Mất kết nối')).toBe('Mất kết nối');
  });

  it('every mark is worded as the Excel file words it', () => {
    const marks: Record<CellMark, [string, string]> = {
      NOT_ASSIGNED: ['—', '—'],
      EXEMPT: ['miễn nộp', 'miễn nộp'],
      NOT_COUNTED: ['chưa nộp', 'chưa duyệt'],
      BLANK: ['', ''],
      NOT_AGGREGATED: ['', ''],
    };
    for (const [mark, [submitted, approved]] of Object.entries(marks) as Array<[CellMark, [string, string]]>) {
      expect(customReportMarkText(mark, 'SUBMITTED')).toBe(submitted);
      expect(customReportMarkText(mark, 'ALL_SAVED')).toBe(submitted);
      expect(customReportMarkText(mark, 'APPROVED')).toBe(approved);
    }
    expect(Object.keys(reportCriteria.customReport.marks).sort()).toEqual(Object.keys(marks).sort());
  });

  it('every note is worded from its code and its numbers', () => {
    const notes: CustomNote[] = [
      { code: 'PERIOD_OPEN', params: { mode: 'APPROVED' } },
      { code: 'GROUP_INCLUDES_UNLISTED', params: { code: 'I', label: 'Tin báo', listed: 1, total: 3 } },
      { code: 'ITEM_KEYS_IGNORED', params: { count: 4 } },
      { code: 'TEAMS_IGNORED', params: { count: 5 } },
    ];
    expect(Object.keys(reportCriteria.customReport.notes).sort()).toEqual(notes.map((n) => n.code).sort());
    expect(customReportNoteText(notes[0])).toContain('đã duyệt');
    expect(customReportNoteText(notes[1])).toContain('"I Tin báo"');
    expect(customReportNoteText(notes[1])).toContain('kể cả những tiêu chí không được liệt kê');
    // The reader of the report is not told how many criteria there are.
    expect(customReportNoteText(notes[1])).not.toMatch(/\d/);
    expect(customReportNoteText(notes[2])).toContain('4 tiêu chí');
    expect(customReportNoteText(notes[3])).toContain('5 tổ');
  });

  it('the filter line names the teams when not all are in, and counts the criteria', () => {
    const line = reportCriteria.customReport.preview.filterLine;
    expect(line({ teamNames: ['Tổ 1', 'Tổ 2'], teamsTotal: 2, mode: 'đã duyệt' })).toBe(
      'Đơn vị: tất cả các tổ · Số liệu: đã duyệt',
    );
    expect(line({ teamNames: ['Tổ 1'], teamsTotal: 4, mode: 'đã duyệt' })).toBe(
      'Đơn vị: Tổ 1 · Số liệu: đã duyệt',
    );
    const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    expect(line({ teamNames: many, teamsTotal: 9, mode: 'x' })).toContain('A, B, C, D, E, F và 2 tổ khác');
  });
});
