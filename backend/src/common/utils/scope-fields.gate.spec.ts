import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * GATE: no service reads the four lists of a `DataScope` itself.
 *
 * `teamIds`, `userIds`, `writableTeamIds` and `writableUserIds` stop being the truth once permissions by team are
 * enforced (`scope.precise` is). The helpers at the end of `scope-filter.util.ts` answer from whichever is the truth;
 * a service that reads a list directly would keep answering from the old one. This gate reads the code the way the
 * compiler does: a property access (`scope.teamIds`, `scope?.teamIds`, `scope['teamIds']`) and a destructuring
 * (`const { teamIds } = scope`, also renamed, also in a parameter or an assignment) are reads. BUILDING an object
 * that has these keys (`{ teamIds: [...] }`), declaring a type, or a local variable of the same name are not.
 *
 * The syntax tree does not know types, so another object that merely shares a field name (a report draft's
 * `teamIds`, a DTO) is listed below, line by line, with what the object is. A listed line that no longer exists
 * fails the gate: the list cannot rot.
 */
const FIELDS = new Set(['teamIds', 'userIds', 'writableTeamIds', 'writableUserIds']);
const SRC = path.resolve(__dirname, '../..');

/** Files (or folders, ending in `/`) that own the lists: they define the scope or translate it. */
const OWNERS = [
  // Defines `DataScope` and fills the lists from the database.
  'auth/services/unit-scope.service.ts',
  // Builds the empty scope of a person with no team.
  'auth/interceptors/data-scope.interceptor.ts',
  // The one place that reads the lists on behalf of every service.
  'common/utils/scope-filter.util.ts',
  // The precise scope: its `tree` has lists of the same names, read only here and in the helpers.
  'common/utils/precise-scope.ts',
  // The permission engine's scope computation: builds the lists of a precise scope and of the legacy shape.
  'authz/engine/scope.ts',
  // Turns the engine's RecordScope into the DataScope of an enforced person: it FILLS the lists.
  'authz/authz-scope.service.ts',
  // Reads the `tree.teamIds` of the engine's RecordScope to name the teams a permission reaches.
  'authz/authz-lookup.service.ts',
  // The preview compares the teams two RecordScopes reach.
  'authz/admin/documents.ts',
];

/**
 * Reads of a field with one of the four names on an object that is NOT a `DataScope`. `file::trimmed line text`.
 * Every entry must match at least one line.
 */
const OTHER_OBJECTS = [
  // `CurrentUser` of the calendar: the teams the person is a member of, loaded by the calendar controller.
  `calendar-events/calendar-events.service.ts::{ scope: 'TEAM', teamId: { in: currentUser.teamIds ?? [] } },`,
  // `CreateMonthlyReportPackageDto`: the teams the person asked the monthly report for (then checked against the scope).
  'reports/monthly-package/monthly-report-package.controller.ts::dto.teamIds,',
  // `MonthlyReportPackage` input: the teams of the report, part of its identity key.
  "reports/monthly-package/monthly-report-package.service.ts::const scopeKey = `${input.unitCode ?? ''}|${[...input.teamIds].sort().join(',')}`;",
  // `MonthlyReportPackage` input: the teams of the report, stored on the row.
  'reports/monthly-package/monthly-report-package.service.ts::teamIds: input.teamIds,',
  // Monthly report builder input: the teams the figures are counted for.
  'reports/monthly-package/monthly-report-builder.service.ts::const teamWhere = input.teamIds.length',
  'reports/monthly-package/monthly-report-builder.service.ts::? { assignedTeamId: { in: input.teamIds } }',
  'reports/monthly-package/monthly-report-builder.service.ts::const scopeMustBeVerified = input.teamIds.length > 0 && end < new Date();',
  // A saved TDAC report draft: the teams the draft covers.
  'reports/tdac/tdac-pham-vi.ts::banNhap.teamIds.length > 0 &&',
  'reports/tdac/tdac-pham-vi.ts::banNhap.teamIds.every((t) => phamVi.includes(t))',
  // `CreateDraftDto`: the teams of the draft being saved.
  'reports/tdac/tdac-draft.service.ts::teamIds: dto.teamIds,',
  // TDAC query string: the comma-separated teams asked for (then checked against the scope).
  'reports/tdac/tdac.controller.ts::const teamIds = this.parseTeamIds(query.teamIds, req);',
  // `CreateDraftDto`: the teams asked for (then checked against the write scope).
  'reports/tdac/tdac.controller.ts::dto.teamIds ?? [],',
  // A custom report ("view") of a dynamic report: the teams it names. The one accessor every reader of it goes through.
  'dynamic-reports/views/report-view.ts::return view.teamIds;',
  // `ApplyTeamsDto` of the permission screen: the teams a configuration is applied to.
  'authz/admin/authz-admin.controller.ts::const teamIds = [...new Set(body.teamIds)];',
];

interface Read {
  line: number;
  /** The trimmed text of that line: what an allowlist entry quotes. */
  text: string;
  why: string;
}

/** Every read of one of the four fields in one source file. */
export function readsOf(fileName: string, text: string): Read[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const lines = text.split(/\r?\n/);
  const reads: Read[] = [];
  const add = (node: ts.Node, why: string) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
    reads.push({ line: line + 1, text: lines[line].trim(), why });
  };
  /** `const key = 'teamIds'` anywhere in the file: a computed read through it is a read of the field. */
  const constants = new Map<string, string>();
  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const value = unwrap(node.initializer);
      if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) constants.set(node.name.text, value.text);
    }
    ts.forEachChild(node, collect);
  };
  /** `('teamIds')`, `'teamIds' as const`, `<const>'teamIds'`, `x!`: the expression inside. */
  function unwrap(node: ts.Expression): ts.Expression {
    let inner = node;
    while (
      ts.isParenthesizedExpression(inner) || ts.isAsExpression(inner) || ts.isTypeAssertionExpression(inner) ||
      ts.isNonNullExpression(inner) || ts.isSatisfiesExpression(inner)
    ) {
      inner = inner.expression;
    }
    return inner;
  }
  collect(source);
  /** The field a name stands for: an identifier, a string, a computed string, or a constant that holds one. */
  const fieldOf = (name: ts.Node | undefined, resolveIdentifier = false): string | null => {
    if (!name) return null;
    const raw = ts.isComputedPropertyName(name) ? name.expression : name;
    const inner = ts.isExpression(raw) ? unwrap(raw) : raw;
    if (ts.isStringLiteral(inner) || ts.isNoSubstitutionTemplateLiteral(inner)) return FIELDS.has(inner.text) ? inner.text : null;
    if (!ts.isIdentifier(inner)) return null;
    const text = resolveIdentifier ? (constants.get(inner.text) ?? inner.text) : inner.text;
    return FIELDS.has(text) ? text : null;
  };
  /** `({ teamIds, userIds: people } = scope)`: an object literal that is being assigned TO takes fields out. */
  const assignmentTargets = (pattern: ts.ObjectLiteralExpression) => {
    for (const property of pattern.properties) {
      if (ts.isSpreadAssignment(property)) continue;
      const field = fieldOf(property.name);
      if (field) add(property, `destructures .${field}`);
      const nested = ts.isPropertyAssignment(property) ? property.initializer : null;
      if (nested && ts.isObjectLiteralExpression(nested)) assignmentTargets(nested);
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && FIELDS.has(node.name.text)) {
      add(node.name, `reads .${node.name.text}`);
    } else if (ts.isElementAccessExpression(node)) {
      // `scope[key]`: the key is looked up among the file's string constants.
      const field = fieldOf(node.argumentExpression, true);
      if (field) add(node.argumentExpression, `reads ['${field}']`);
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      // `const { teamIds } = scope`, `{ writableUserIds: people }`, a destructured parameter.
      const field = fieldOf(node.propertyName ?? node.name);
      if (field) add(node, `destructures .${field}`);
    } else if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isObjectLiteralExpression(node.left)
    ) {
      assignmentTargets(node.left);
    } else if ((ts.isForOfStatement(node) || ts.isForInStatement(node)) && ts.isObjectLiteralExpression(node.initializer)) {
      // `for ({ teamIds: ids } of scopes)`.
      assignmentTargets(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return reads;
}

/** What the gate says about the reads found: the ones nobody vouched for, and the entries that vouch for nothing. */
export function judge(
  found: { file: string; reads: Read[] }[],
  owners: string[],
  otherObjects: string[],
): { offences: string[]; stale: string[] } {
  const owned = (file: string) => owners.some((o) => (o.endsWith('/') ? file.startsWith(o) : file === o));
  const used = new Set<string>();
  const offences: string[] = [];
  for (const { file, reads } of found) {
    if (owned(file)) continue;
    for (const read of reads) {
      const entry = `${file}::${read.text}`;
      if (otherObjects.includes(entry)) used.add(entry);
      else offences.push(`${file}:${read.line}  ${read.why}  |  ${read.text}`);
    }
  }
  return { offences, stale: otherObjects.filter((entry) => !used.has(entry)) };
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') && !e.name.endsWith('.d.ts') ? [p] : [];
  });
}

describe('GATE: no service reads the lists of a scope itself', () => {
  const files = sourceFiles(SRC);
  const relative = (file: string) => path.relative(SRC, file).replace(/\\/g, '/');
  const found = files.map((file) => ({ file: relative(file), reads: readsOf(file, fs.readFileSync(file, 'utf8')) }));

  it('the scan visits the source, and sees the reads of the helpers themselves', () => {
    // A scan that visited nothing, or a detector that sees nothing, would be green for the wrong reason.
    expect(files.length).toBeGreaterThanOrEqual(300);
    const helpers = found.find((f) => f.file === 'common/utils/scope-filter.util.ts');
    expect(helpers?.reads.map((r) => r.why)).toEqual(
      expect.arrayContaining(['reads .teamIds', 'reads .userIds', 'reads .writableTeamIds', 'reads .writableUserIds']),
    );
  });

  it('no source file outside the owners reads teamIds, userIds, writableTeamIds or writableUserIds', () => {
    expect(judge(found, OWNERS, OTHER_OBJECTS).offences).toEqual([]);
  });

  it('every listed line of another object still exists, and every owner too', () => {
    expect(judge(found, OWNERS, OTHER_OBJECTS).stale).toEqual([]);
    expect(new Set(OTHER_OBJECTS).size).toBe(OTHER_OBJECTS.length);
    for (const owner of OWNERS) {
      expect({ owner, exists: found.some((f) => (owner.endsWith('/') ? f.file.startsWith(owner) : f.file === owner)) }).toEqual({ owner, exists: true });
    }
  });

  const whys = (body: string) => readsOf('sample.ts', body).map((r) => r.why);

  it.each([
    [`const teams = scope.teamIds;`, ['reads .teamIds']],
    [`if (dataScope.writableUserIds.includes(id)) run();`, ['reads .writableUserIds']],
    [`const where = { teamId: { in: req.dataScope.writableTeamIds } };`, ['reads .writableTeamIds']],
    [`const people = scope?.userIds ?? [];`, ['reads .userIds']],
    [`const teams = scope!.teamIds;`, ['reads .teamIds']],
    [`const teams = (scope as DataScope).teamIds;`, ['reads .teamIds']],
    [`const teams = scope['teamIds'];`, [`reads ['teamIds']`]],
    [`const teams = scope?.["writableTeamIds"];`, [`reads ['writableTeamIds']`]],
    ['const teams = scope[`userIds`];', [`reads ['userIds']`]],
    [`const key = 'teamIds' as const; const ids = scope[key];`, [`reads ['teamIds']`]],
    [`const ids = scope[('teamIds')];`, [`reads ['teamIds']`]],
    [`const ids = scope['writableUserIds' as const];`, [`reads ['writableUserIds']`]],
    [`for ({ teamIds: ids } of [scope]) use(ids);`, ['destructures .teamIds']],
    [`const { teamIds } = scope;`, ['destructures .teamIds']],
    [`const { userIds, teamIds, isWardOfficer } = dataScope;`, ['destructures .userIds', 'destructures .teamIds']],
    [`const { writableUserIds: people } = scope;`, ['destructures .writableUserIds']],
    [`const { 'teamIds': teams } = scope;`, ['destructures .teamIds']],
    [`const { ['teamIds']: teams } = scope;`, ['destructures .teamIds']],
    [`const { teamIds = [] } = scope ?? {};`, ['destructures .teamIds']],
    [`const { precise, ...rest } = scope; const { req: { dataScope: { userIds } } } = ctx;`, ['destructures .userIds']],
    [`function f({ teamIds }: DataScope) { return teamIds; }`, ['destructures .teamIds']],
    [`const f = ({ writableTeamIds: teams }: DataScope) => teams;`, ['destructures .writableTeamIds']],
    [`let teamIds: string[]; ({ teamIds } = scope);`, ['destructures .teamIds']],
    [`let teams: string[]; ({ teamIds: teams } = scope);`, ['destructures .teamIds']],
  ])('sees: %s', (body, expected) => {
    expect(whys(body)).toEqual(expected);
  });

  it('is not fooled by building a scope, a type, a local of the same name, a comment or a string', () => {
    expect(
      whys(`
        // scope.teamIds
        /* const { userIds } = scope; */
        const text = "scope.teamIds and scope['userIds']";
        interface Draft { teamIds: string[]; userIds?: string[] }
        type Lists = Pick<DataScope, 'teamIds' | 'writableTeamIds'>;
        const teamIds = await load();
        const built: DataScope = { teamIds, userIds: [me], writableTeamIds: [...teamIds], writableUserIds: [me] };
        function count(userIds: string[]) { return userIds.length + teamIds.length; }
        const other = scope.leaderTeamIds ?? scope.canDispatch ?? scope['wardTeamId'];
        const dynamic = scope[key];
      `),
    ).toEqual([]);
  });

  it('reports the line and its text, the way an entry quotes it', () => {
    expect(readsOf('sample.ts', `\n\n    return scope.teamIds;   `)).toEqual([
      { line: 3, text: 'return scope.teamIds;', why: 'reads .teamIds' },
    ]);
  });

  describe('judging', () => {
    const sample = [
      { file: 'a/service.ts', reads: [{ line: 7, text: 'return scope.teamIds;', why: 'reads .teamIds' }] },
      { file: 'owner/deep/engine.ts', reads: [{ line: 1, text: 'x.userIds', why: 'reads .userIds' }] },
    ];

    it('a read nobody vouched for is an offence with its file and line', () => {
      expect(judge(sample, ['owner/'], [])).toEqual({
        offences: ['a/service.ts:7  reads .teamIds  |  return scope.teamIds;'],
        stale: [],
      });
    });

    it('a listed line passes; the same text in another file does not', () => {
      expect(judge(sample, ['owner/'], ['a/service.ts::return scope.teamIds;'])).toEqual({ offences: [], stale: [] });
      const elsewhere = judge(sample, ['owner/'], ['b/service.ts::return scope.teamIds;']);
      expect(elsewhere.offences).toHaveLength(1);
      expect(elsewhere.stale).toEqual(['b/service.ts::return scope.teamIds;']);
    });

    it('an entry that matches no line is stale, also when it points into an owner', () => {
      expect(judge(sample, ['owner/'], ['a/service.ts::return scope.teamIds;', 'a/service.ts::gone();', 'owner/deep/engine.ts::x.userIds']).stale).toEqual([
        'a/service.ts::gone();',
        'owner/deep/engine.ts::x.userIds',
      ]);
    });

    it('an owner is a whole file or a folder, never a prefix of a name', () => {
      expect(judge(sample, ['owner/deep/engine.ts', 'a/serv'], []).offences).toHaveLength(1);
    });
  });
});
