import { aggregateValues } from '../engine/aggregate';
import { contributionsFor } from '../aggregate/contributors';
import type { SummaryMode } from '../aggregate/contributors';
import { buildCustomSummary } from './custom-summary';
import type { CustomSummaryInput, CustomSummaryRow } from './custom-summary';
import { ViewError } from './report-view';
import type { ViewDefinition } from './report-view';

/**
 * Every expected figure below is worked out by hand from this table (what each team typed):
 *
 *            1.1   1.2    2     3     state      given
 *   Tổ A      11    12    20    —     SUBMITTED  1.1, 1.2, 2   (not given criterion 3)
 *   Tổ B     101   102   200   300    APPROVED   everything
 *   Tổ C    1001  (blank) 2000 (blank) DRAFT     everything
 *
 * "1" is a heading: 1 = 1.1 + 1.2. Nobody types it.
 */
const field = (fieldKey: string, itemKey: string, code: string, label: string, parentItemKey: string | null) => ({
  fieldKey,
  itemKey,
  code,
  label,
  unit: 'vụ' as string | null,
  type: 'NUM' as const,
  aggregate: 'SUM' as const,
  blankPolicy: 'ZERO' as const,
  parentItemKey,
});
const FIELDS: CustomSummaryInput['fields'] = [
  field('S!C3', 'k11', '1.1', 'Tin báo mới', 'g1'),
  field('S!C4', 'k12', '1.2', 'Tin báo đã giải quyết', 'g1'),
  field('S!C5', 'k2', '2', 'Số vụ khởi tố', null),
  field('S!C6', 'k3', '3', 'Số bị can', null),
];
const GROUPS = [{ itemKey: 'g1', code: '1', name: 'Tin báo tội phạm', parentItemKey: null }];
const TEAMS: CustomSummaryInput['teams'] = [
  { teamId: 'A', name: 'Tổ A', obligation: 'REQUIRED', state: 'SUBMITTED', ownedFieldKeys: ['S!C3', 'S!C4', 'S!C5'], values: { 'S!C3': '11', 'S!C4': '12', 'S!C5': '20' } },
  { teamId: 'B', name: 'Tổ B', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: { 'S!C3': '101', 'S!C4': '102', 'S!C5': '200', 'S!C6': '300' } },
  { teamId: 'C', name: 'Tổ C', obligation: 'REQUIRED', state: 'DRAFT', ownedFieldKeys: null, values: { 'S!C3': '1001', 'S!C5': '2000' } },
];
const ALL: ViewDefinition = { title: null, showFilterLine: true, itemKeys: null, teamIds: null, teamColumns: true };

function input(over: Partial<CustomSummaryInput> = {}, definition: Partial<ViewDefinition> = {}): CustomSummaryInput {
  return {
    reportName: 'Báo cáo tháng',
    periodKey: '2026-10',
    periodStatus: 'OPEN',
    mode: 'SUBMITTED',
    fields: FIELDS,
    groups: GROUPS,
    teams: TEAMS,
    definition: { ...ALL, ...definition },
    ...over,
  };
}
const totals = (rows: CustomSummaryRow[]) => rows.map((r) => [r.kind, r.code, r.total]);
const cellsOf = (row: CustomSummaryRow) => row.cells.map((c) => c.mark ?? c.value);
const rowOf = (rows: CustomSummaryRow[], code: string) => rows.find((r) => r.code === code) as CustomSummaryRow;

describe('buildCustomSummary', () => {
  describe('nothing unticked', () => {
    const summary = buildCustomSummary(input());

    it('lists every criterion under its heading, with the totals of the teams that count (A and B: submitted + approved)', () => {
      expect(totals(summary.rows)).toEqual([
        ['GROUP', '1', '226'], // 112 + 114
        ['CRITERION', '1.1', '112'], // 11 + 101
        ['CRITERION', '1.2', '114'], // 12 + 102
        ['CRITERION', '2', '220'], // 20 + 200
        ['CRITERION', '3', '300'], // B only: A was not given it
      ]);
      expect(summary.rows.map((r) => r.depth)).toEqual([0, 1, 1, 0, 0]);
      expect(summary.rows.some((r) => r.partial)).toBe(false);
    });

    it('has the four fixed columns and then one per team, in the order of the teams', () => {
      expect(summary.columns).toEqual([
        { key: 'code', label: 'Mã' },
        { key: 'label', label: 'Tiêu chí' },
        { key: 'unit', label: 'ĐVT' },
        { key: 'total', label: 'Tổng' },
        { key: 'team:A', label: 'Tổ A' },
        { key: 'team:B', label: 'Tổ B' },
        { key: 'team:C', label: 'Tổ C' },
      ]);
      expect(summary.teams).toEqual([
        { teamId: 'A', name: 'Tổ A' },
        { teamId: 'B', name: 'Tổ B' },
        { teamId: 'C', name: 'Tổ C' },
      ]);
    });

    it('under each team stands its own figure; a criterion it was not given is marked, a team not counted is marked', () => {
      expect(cellsOf(rowOf(summary.rows, '1.1'))).toEqual(['11', '101', 'NOT_COUNTED']);
      expect(cellsOf(rowOf(summary.rows, '3'))).toEqual(['NOT_ASSIGNED', '300', 'NOT_COUNTED']);
      // The heading under a team: what that team reports under it (A: 11 + 12, B: 101 + 102).
      expect(cellsOf(rowOf(summary.rows, '1'))).toEqual(['23', '203', 'NOT_COUNTED']);
    });

    it('the title is made from the report and the period, and the filter line says what is in the report', () => {
      expect(summary.title).toBe('Báo cáo tháng — kỳ 2026-10');
      expect(summary.filterLine).toBe('Đơn vị: tất cả 3 tổ · Số liệu: đã nộp + đã duyệt');
      expect(summary.counts).toEqual({ criteria: { selected: 4, total: 4 }, teams: { selected: 3, total: 3 } });
      expect(summary.ignored).toEqual({ itemKeys: [], teamIds: [], teams: [] });
      expect(summary.newCriteria).toBe(0);
      expect(summary.mode).toBe('SUBMITTED');
    });

    it('an open period is said to be open; nothing else is noted', () => {
      expect(summary.notes).toEqual([{ code: 'PERIOD_OPEN', params: { mode: 'SUBMITTED' } }]);
      expect(buildCustomSummary(input({ periodStatus: 'FINALIZED', mode: 'APPROVED' })).notes).toEqual([]);
    });

    it.each(['SUBMITTED', 'APPROVED', 'ALL_SAVED'] as SummaryMode[])(
      'its totals are the ones the aggregate engine gives for the whole period (%s)',
      (mode) => {
        const rows = TEAMS.map((t) => ({
          id: t.teamId,
          obligation: t.obligation,
          ownedFieldKeys: t.ownedFieldKeys,
          submission: { state: t.state, values: Object.fromEntries(Object.entries(t.values).map(([k, v]) => [k, { v: v ?? null }])) },
        }));
        const engine = FIELDS.map((f) => aggregateValues(f.aggregate, f.blankPolicy, contributionsFor(rows, f.fieldKey, mode)).value);
        const mine = buildCustomSummary(input({ mode })).rows.filter((r) => r.kind === 'CRITERION').map((r) => r.total);
        expect(mine).toEqual(engine);
      },
    );
  });

  describe('the calculation mode', () => {
    it('APPROVED counts team B only', () => {
      const summary = buildCustomSummary(input({ mode: 'APPROVED' }));
      expect(totals(summary.rows)).toEqual([
        ['GROUP', '1', '203'],
        ['CRITERION', '1.1', '101'],
        ['CRITERION', '1.2', '102'],
        ['CRITERION', '2', '200'],
        ['CRITERION', '3', '300'],
      ]);
      expect(cellsOf(rowOf(summary.rows, '1.1'))).toEqual(['NOT_COUNTED', '101', 'NOT_COUNTED']);
      expect(summary.filterLine).toContain('Số liệu: đã duyệt');
    });

    it('ALL_SAVED counts the draft of team C too; what it left blank is a blank cell and adds nothing', () => {
      const summary = buildCustomSummary(input({ mode: 'ALL_SAVED' }));
      expect(totals(summary.rows)).toEqual([
        ['GROUP', '1', '1227'], // 1113 + 114
        ['CRITERION', '1.1', '1113'], // 11 + 101 + 1001
        ['CRITERION', '1.2', '114'], // 12 + 102 + blank
        ['CRITERION', '2', '2220'], // 20 + 200 + 2000
        ['CRITERION', '3', '300'], // 300 + blank
      ]);
      expect(cellsOf(rowOf(summary.rows, '1.2'))).toEqual(['12', '102', 'BLANK']);
      expect(cellsOf(rowOf(summary.rows, '1'))).toEqual(['23', '203', '1001']);
    });
  });

  describe('some criteria and some teams unticked', () => {
    const summary = buildCustomSummary(input({}, { itemKeys: ['k11', 'k2'], teamIds: ['A', 'B'] }));

    it('lists only the ticked criteria and teams; the total is the sum of the TICKED teams', () => {
      expect(totals(summary.rows)).toEqual([
        ['GROUP', '1', '226'],
        ['CRITERION', '1.1', '112'],
        ['CRITERION', '2', '220'],
      ]);
      expect(summary.columns.map((c) => c.key)).toEqual(['code', 'label', 'unit', 'total', 'team:A', 'team:B']);
      expect(summary.counts).toEqual({ criteria: { selected: 2, total: 4 }, teams: { selected: 2, total: 3 } });
      expect(summary.filterLine).toBe('Đơn vị: Tổ A, Tổ B (2/3 tổ) · Số liệu: đã nộp + đã duyệt');
    });

    it('the heading keeps the FULL sum of its criteria (1.2 is not listed but is in it), and a note says so', () => {
      const heading = rowOf(summary.rows, '1');
      expect(heading.total).toBe('226'); // 112 (listed) + 114 (not listed)
      expect(heading.partial).toBe(true);
      expect(summary.notes).toContainEqual({
        code: 'GROUP_INCLUDES_UNLISTED',
        params: { code: '1', label: 'Tin báo tội phạm', listed: 1, total: 2 },
      });
    });

    it('a team left out is in no total: with A and C under ALL_SAVED, 1.1 = 11 + 1001', () => {
      const other = buildCustomSummary(input({ mode: 'ALL_SAVED' }, { itemKeys: ['k11'], teamIds: ['C', 'A'] }));
      expect(rowOf(other.rows, '1.1').total).toBe('1012');
      // Columns follow the order of the period's teams, not the order they were ticked in.
      expect(other.teams.map((t) => t.teamId)).toEqual(['A', 'C']);
      expect(rowOf(other.rows, '1').total).toBe('1024'); // 11 + 12 + 1001 + blank
    });

    it('a heading with none of its criteria ticked is not listed', () => {
      const only2 = buildCustomSummary(input({}, { itemKeys: ['k2'] }));
      expect(totals(only2.rows)).toEqual([['CRITERION', '2', '220']]);
      expect(only2.notes.map((n) => n.code)).toEqual(['PERIOD_OPEN']);
    });
  });

  it('a criterion no ticked team was given has no total, and the team shows the "not given" mark', () => {
    const summary = buildCustomSummary(input({}, { itemKeys: ['k3'], teamIds: ['A'] }));
    const row = rowOf(summary.rows, '3');
    expect(row.total).toBeNull();
    expect(row.totalMark).toBeNull();
    expect(cellsOf(row)).toEqual(['NOT_ASSIGNED']);
  });

  it('an exempt team is marked exempt and adds nothing', () => {
    const teams = TEAMS.map((t) => (t.teamId === 'B' ? { ...t, obligation: 'EXEMPT' } : t));
    const summary = buildCustomSummary(input({ teams }));
    expect(rowOf(summary.rows, '1.1').total).toBe('11');
    expect(cellsOf(rowOf(summary.rows, '1.1'))).toEqual(['11', 'EXEMPT', 'NOT_COUNTED']);
    expect(cellsOf(rowOf(summary.rows, '1'))).toEqual(['23', 'EXEMPT', 'NOT_COUNTED']);
  });

  it('a heading whose criteria do not all add up (one is an average) carries no number', () => {
    const fields = FIELDS.map((f) => (f.itemKey === 'k12' ? { ...f, aggregate: 'AVG' as const } : f));
    const summary = buildCustomSummary(input({ fields }));
    const heading = rowOf(summary.rows, '1');
    expect(heading.total).toBeNull();
    expect(heading.totalMark).toBe('NOT_AGGREGATED');
    expect(cellsOf(heading)).toEqual(['NOT_AGGREGATED', 'NOT_AGGREGATED', 'NOT_COUNTED']);
    // The criteria themselves are untouched: 1.2 is the average of 12 and 102.
    expect(rowOf(summary.rows, '1.2').total).toBe('57');
  });

  it('a criterion that is not aggregated (text) has no total and says so; the teams show what they typed', () => {
    const fields = [...FIELDS, { ...field('S!C7', 'k9', '9', 'Ghi chú', null), type: 'TEXT' as const, aggregate: 'NONE' as const, unit: null }];
    const teams = TEAMS.map((t) => (t.teamId === 'B' ? { ...t, values: { ...t.values, 'S!C7': 'đã rà soát' } } : t));
    const row = rowOf(buildCustomSummary(input({ fields, teams }, { itemKeys: ['k9'], teamIds: ['B'] })).rows, '9');
    expect(row).toMatchObject({ total: null, totalMark: 'NOT_AGGREGATED', type: 'TEXT' });
    expect(cellsOf(row)).toEqual(['đã rà soát']);
  });

  describe('a saved selection used on a period it does not fit exactly', () => {
    it('a criterion that no longer exists is left out and reported', () => {
      const summary = buildCustomSummary(input({}, { itemKeys: ['k2', 'gone'] }));
      expect(totals(summary.rows)).toEqual([['CRITERION', '2', '220']]);
      expect(summary.ignored.itemKeys).toEqual(['gone']);
      expect(summary.notes).toContainEqual({ code: 'ITEM_KEYS_IGNORED', params: { count: 1 } });
    });

    it('a team with no assignment in this period is left out and reported, by name when it is known', () => {
      const summary = buildCustomSummary(input({ otherTeamNames: { Z: 'Tổ Z' } }, { teamIds: ['B', 'Z', 'Y'] }));
      expect(summary.teams).toEqual([{ teamId: 'B', name: 'Tổ B' }]);
      expect(summary.ignored.teamIds).toEqual(['Z', 'Y']);
      expect(summary.ignored.teams).toEqual([
        { teamId: 'Z', name: 'Tổ Z' },
        { teamId: 'Y', name: null },
      ]);
      expect(summary.notes).toContainEqual({ code: 'TEAMS_IGNORED', params: { count: 2 } });
      expect(rowOf(summary.rows, '1.1').total).toBe('101');
    });

    it('criteria added since the selection was saved are counted as new; the ones unticked back then are not', () => {
      // Saved when the report had 1.1 and 2 only, with 1.1 ticked: 1.2 and 3 came later.
      const summary = buildCustomSummary(input({ knownItemKeysAtSave: ['k11', 'k2'] }, { itemKeys: ['k11'] }));
      expect(summary.newCriteria).toBe(2);
      // "Everything" has nothing new to report: it takes what comes.
      expect(buildCustomSummary(input({ knownItemKeysAtSave: ['k11'] })).newCriteria).toBe(0);
    });

    describe('nothing left of it', () => {
      const refused = (definition: Partial<ViewDefinition>) => {
        try {
          buildCustomSummary(input({}, definition), { allowNothingLeft: false });
          return null;
        } catch (err) {
          return err instanceof ViewError ? err.code : err;
        }
      };

      it('every criterion it names is gone: the preview answers with no rows and says which keys were left out', () => {
        const summary = buildCustomSummary(input({}, { itemKeys: ['gone', 'gone-too'] }), { allowNothingLeft: true });
        expect(summary.rows).toEqual([]);
        expect(summary.ignored).toEqual({ itemKeys: ['gone', 'gone-too'], teamIds: [], teams: [] });
        expect(summary.notes).toEqual([
          { code: 'PERIOD_OPEN', params: { mode: 'SUBMITTED' } },
          { code: 'ITEM_KEYS_IGNORED', params: { count: 2 } },
        ]);
        expect(summary.counts).toEqual({ criteria: { selected: 0, total: 4 }, teams: { selected: 3, total: 3 } });
        // The teams are still the period's: only the criteria are missing.
        expect(summary.teams.map((t) => t.teamId)).toEqual(['A', 'B', 'C']);
        expect(summary.columns.map((c) => c.key)).toEqual(['code', 'label', 'unit', 'total', 'team:A', 'team:B', 'team:C']);
        expect(summary.title).toBe('Báo cáo tháng — kỳ 2026-10');
      });

      it('every team it names is absent from the period: no rows, no team, the four fixed columns, and the teams left out are said', () => {
        const summary = buildCustomSummary(input({ otherTeamNames: { Z: 'Tổ Z' } }, { teamIds: ['Z', 'Y'] }), { allowNothingLeft: true });
        expect(summary.rows).toEqual([]);
        expect(summary.teams).toEqual([]);
        expect(summary.columns.map((c) => c.key)).toEqual(['code', 'label', 'unit', 'total']);
        expect(summary.ignored).toEqual({
          itemKeys: [],
          teamIds: ['Z', 'Y'],
          teams: [{ teamId: 'Z', name: 'Tổ Z' }, { teamId: 'Y', name: null }],
        });
        expect(summary.notes).toEqual([
          { code: 'PERIOD_OPEN', params: { mode: 'SUBMITTED' } },
          { code: 'TEAMS_IGNORED', params: { count: 2 } },
        ]);
        expect(summary.counts).toEqual({ criteria: { selected: 4, total: 4 }, teams: { selected: 0, total: 3 } });
      });

      it('both gone at once: both are reported', () => {
        const summary = buildCustomSummary(input({}, { itemKeys: ['gone'], teamIds: ['Z'] }), { allowNothingLeft: true });
        expect(summary.rows).toEqual([]);
        expect(summary.notes.map((n) => n.code)).toEqual(['PERIOD_OPEN', 'ITEM_KEYS_IGNORED', 'TEAMS_IGNORED']);
        expect(summary.counts).toEqual({ criteria: { selected: 0, total: 4 }, teams: { selected: 0, total: 3 } });
      });

      it('the export still refuses either: there is no file to make', () => {
        expect(refused({ itemKeys: ['gone'] })).toBe('VIEW_SELECTION_EMPTY');
        expect(refused({ teamIds: ['Z'] })).toBe('VIEW_TEAMS_EMPTY');
        // The criteria are judged first when both are gone.
        expect(refused({ itemKeys: ['gone'], teamIds: ['Z'] })).toBe('VIEW_SELECTION_EMPTY');
      });

      it('refusing is what happens when the caller does not say otherwise', () => {
        expect(() => buildCustomSummary(input({}, { itemKeys: ['gone'] }))).toThrow(ViewError);
        expect(() => buildCustomSummary(input({}, { teamIds: ['Z'] }))).toThrow(ViewError);
      });

      it('allowing it changes nothing of a report that has something in it', () => {
        expect(buildCustomSummary(input(), { allowNothingLeft: true })).toEqual(buildCustomSummary(input()));
      });
    });
  });

  describe('the number of a heading when there is nothing to add up', () => {
    const heading = (summary: { rows: CustomSummaryRow[] }) => rowOf(summary.rows, '1');
    const blankIgnored = FIELDS.map((f) => ({ ...f, blankPolicy: 'IGNORE' as const }));
    const team = (teamId: string, state: string, values: Record<string, string>): CustomSummaryInput['teams'][number] => ({
      teamId,
      name: `Tổ ${teamId}`,
      obligation: 'REQUIRED',
      state,
      ownedFieldKeys: null,
      values,
    });

    it('no team counts (approved figures, the only team is still a draft): the criteria have no total and neither has the heading', () => {
      const summary = buildCustomSummary(input({ mode: 'APPROVED' }, { teamIds: ['C'] }));
      expect(totals(summary.rows)).toEqual([
        ['GROUP', '1', null],
        ['CRITERION', '1.1', null],
        ['CRITERION', '1.2', null],
        ['CRITERION', '2', null],
        ['CRITERION', '3', null],
      ]);
      expect(heading(summary).totalMark).toBeNull();
      expect(heading(summary).cells).toEqual([{ value: null, mark: 'NOT_COUNTED' }]);
    });

    it('a team that typed nothing under the heading has a blank there, not a zero', () => {
      const summary = buildCustomSummary(input({ teams: [team('D', 'APPROVED', { 'S!C5': '7' })] }));
      expect(heading(summary).cells).toEqual([{ value: null, mark: 'BLANK' }]);
      expect(rowOf(summary.rows, '1.1').cells).toEqual([{ value: null, mark: 'BLANK' }]);
    });

    it('every figure under it blank and blanks not counted: the criteria have no total and neither has the heading', () => {
      const summary = buildCustomSummary(input({ fields: blankIgnored, teams: [team('D', 'APPROVED', {})] }));
      expect([rowOf(summary.rows, '1.1').total, rowOf(summary.rows, '1.2').total]).toEqual([null, null]);
      expect(heading(summary).total).toBeNull();
      expect(heading(summary).totalMark).toBeNull();
    });

    it('the heading is the sum of the totals shown under it: where a blank counts as zero the criteria say 0 and so does the heading', () => {
      const summary = buildCustomSummary(input({ teams: [team('D', 'APPROVED', {})] }));
      expect([rowOf(summary.rows, '1.1').total, rowOf(summary.rows, '1.2').total]).toEqual(['0', '0']);
      expect(heading(summary).total).toBe('0');
      // The team itself typed nothing: its own cell stays blank.
      expect(heading(summary).cells).toEqual([{ value: null, mark: 'BLANK' }]);
    });

    it('a zero somebody typed is a zero', () => {
      const summary = buildCustomSummary(input({ fields: blankIgnored, teams: [team('D', 'APPROVED', { 'S!C3': '0' })] }));
      expect(heading(summary).total).toBe('0');
      expect(heading(summary).cells).toEqual([{ value: '0', mark: null }]);
      const both = buildCustomSummary(input({ teams: [team('D', 'APPROVED', { 'S!C3': '0', 'S!C4': '0' })] }));
      expect(heading(both).total).toBe('0');
      expect(heading(both).cells).toEqual([{ value: '0', mark: null }]);
    });

    it('some with a figure and some without: the figures are added up', () => {
      const summary = buildCustomSummary(
        input({
          fields: blankIgnored,
          teams: [team('D', 'APPROVED', { 'S!C3': '5' }), team('E', 'APPROVED', {}), team('F', 'DRAFT', { 'S!C4': '9' })],
        }),
      );
      expect([rowOf(summary.rows, '1.1').total, rowOf(summary.rows, '1.2').total]).toEqual(['5', null]);
      expect(heading(summary).total).toBe('5');
      expect(heading(summary).cells).toEqual([
        { value: '5', mark: null },
        { value: null, mark: 'BLANK' },
        { value: null, mark: 'NOT_COUNTED' },
      ]);
    });
  });

  describe('what the person set', () => {
    it('a title typed is the title; the filter line can be turned off; without team columns there are four columns', () => {
      const summary = buildCustomSummary(input({}, { title: 'Báo cáo gửi Bộ', showFilterLine: false, teamColumns: false }));
      expect(summary.title).toBe('Báo cáo gửi Bộ');
      expect(summary.filterLine).toBeNull();
      expect(summary.columns.map((c) => c.key)).toEqual(['code', 'label', 'unit', 'total']);
      expect(summary.rows.every((r) => r.cells.length === 0)).toBe(true);
      // The teams are still said, for the screen to word its own line.
      expect(summary.teams).toHaveLength(3);
      expect(rowOf(summary.rows, '1.1').total).toBe('112');
    });

    it('a long list of teams is shortened in the filter line', () => {
      const teams = Array.from({ length: 9 }, (_, i) => ({ ...TEAMS[1], teamId: `T${i + 1}`, name: `Tổ ${i + 1}` }));
      const summary = buildCustomSummary(input({ teams }, { teamIds: teams.slice(0, 8).map((t) => t.teamId) }));
      expect(summary.filterLine).toBe(
        'Đơn vị: Tổ 1, Tổ 2, Tổ 3, Tổ 4, Tổ 5, Tổ 6 và 2 tổ khác (8/9 tổ) · Số liệu: đã nộp + đã duyệt',
      );
    });
  });

  it('a report made from an Excel template has no headings: one plain row per input cell, named by its cell', () => {
    const fields: CustomSummaryInput['fields'] = [
      { fieldKey: 'Bieu1!D7', itemKey: 'Bieu1!D7', code: null, label: 'Số vụ', unit: null, type: 'NUM', aggregate: 'SUM', blankPolicy: 'ZERO', parentItemKey: null },
      { fieldKey: 'Bieu1!D8', itemKey: 'Bieu1!D8', code: null, label: 'Số người', unit: null, type: 'NUM', aggregate: 'MAX', blankPolicy: 'IGNORE', parentItemKey: null },
    ];
    const teams: CustomSummaryInput['teams'] = [
      { teamId: 'A', name: 'Tổ A', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: { 'Bieu1!D7': '4', 'Bieu1!D8': '9' } },
      { teamId: 'B', name: 'Tổ B', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: { 'Bieu1!D7': '6', 'Bieu1!D8': '2' } },
    ];
    const summary = buildCustomSummary(input({ fields, groups: [], teams }, { itemKeys: ['Bieu1!D8', 'Bieu1!D7'] }));
    expect(summary.rows.map((r) => [r.kind, r.itemKey, r.code, r.label, r.total, r.depth])).toEqual([
      ['CRITERION', 'Bieu1!D7', null, 'Số vụ', '10', 0],
      ['CRITERION', 'Bieu1!D8', null, 'Số người', '9', 0],
    ]);
  });

  it('headings inside headings: each is listed once above its first criterion and adds up everything under it', () => {
    const fields = [
      field('S!C3', 'a', 'I.1.1', 'a', 'g11'),
      field('S!C4', 'b', 'I.1.2', 'b', 'g11'),
      field('S!C5', 'c', 'I.2', 'c', 'gI'),
    ];
    const groups = [
      { itemKey: 'gI', code: 'I', name: 'Phần I', parentItemKey: null },
      { itemKey: 'g11', code: 'I.1', name: 'Mục 1', parentItemKey: 'gI' },
    ];
    const teams: CustomSummaryInput['teams'] = [
      { teamId: 'A', name: 'Tổ A', obligation: 'REQUIRED', state: 'APPROVED', ownedFieldKeys: null, values: { 'S!C3': '1', 'S!C4': '2', 'S!C5': '4' } },
    ];
    const summary = buildCustomSummary(input({ fields, groups, teams }, { itemKeys: ['b', 'c'] }));
    expect(summary.rows.map((r) => [r.code, r.total, r.depth, r.partial ?? false])).toEqual([
      ['I', '7', 0, true], // 1 + 2 + 4, although "a" is not listed
      ['I.1', '3', 1, true],
      ['I.1.2', '2', 2, false],
      ['I.2', '4', 1, false],
    ]);
  });
});
