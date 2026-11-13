import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { ROLE_NAMES } from '../common/constants/role.constants';

/**
 * GATE: nothing decides what a person may do from the NAME of their role, unless that decision is listed here.
 *
 * Permissions by team replace what a ROLE gives for everybody but the administrator. A check written against a role
 * name (`user.role === ROLE_NAMES.HEAD_UNIT`) keeps answering from the role whatever the teams give or take away:
 * a person given the permission by their team is refused, a person whose team took it away is let through. Such a
 * check either asks `holdsPermission(...)` (`enforcement.ts`), or is a FACT ABOUT THE ROLE that stays true under
 * permissions by team, and then it is listed below with the reason.
 *
 * The decisions, recorded once here:
 *   - ADMIN: the administrator stays a role. Team permissions never restrict an administrator (the engine gives
 *     ADMIN what the role holds, unrestricted), so "is the administrator" is a fact about the role.
 *   - SUPER_ADMIN: no account has it and the engine does not know it (such an account would be compiled like
 *     anybody else); the two places that name it guard operator tools next to ADMIN and are listed as such.
 *   - SYSTEM, OFFICER, DEADLINE_APPROVER, INVESTIGATOR: only where the role itself is the subject (seeding, looking
 *     a role up to assign it), never to decide what a person may do.
 *   - HEAD_UNIT: was the only business decision by role name (reviewing edit-window reset requests); it now asks
 *     the permission the route already requires. What is left is the notification fallback, listed with its reason.
 *
 * A MENTION OF A ROLE NAME is: `ROLE_NAMES.X` anywhere, and a string literal equal to a role name that is compared
 * (`===`, `!==`, `==`, `!=`) with something whose text says `role`, or that sits inside a `role: { ... }` object.
 * A constant DECLARED from role names (`const ADMIN_ROLES = [ROLE_NAMES.ADMIN, ...]`, `const ADMIN_ROLE = 'ADMIN'`)
 * is an alias: its declaration and every use of it, in any file, are mentions too.
 * The list is a count: a line that appears twice in a file is listed twice, so copying a listed check into another
 * operation fails the gate.
 * What the syntax tree cannot tell: a role name carried in a variable that was not declared from one (a parameter,
 * a value read from the database), or built at run time. The constants file itself is not scanned.
 */
const SRC = path.resolve(__dirname, '..');
const NAMES = new Set<string>(Object.values(ROLE_NAMES));

/** `file::trimmed line text`, once per line of the file that reads so. */
const A_FACT_ABOUT_THE_ROLE: string[] = [
  // ── The administrator is not restricted by teams: record scope, dispatching, and what only an administrator sees or does ──
  'auth/services/unit-scope.service.ts::if (roleName === ROLE_NAMES.ADMIN) return null;',
  'auth/guards/dispatch.guard.ts::return user?.canDispatch === true || user?.role === ROLE_NAMES.ADMIN;',
  "cases/governance/case-governance.service.ts::(user.canDispatch || user.role.name === 'ADMIN'),",
  "cases/governance/case-governance.service.ts::internal && (user.canDispatch || user.role.name === 'ADMIN'),",
  "cases/governance/case-governance.service.ts::if (!user.canDispatch && user.role.name !== 'ADMIN')",
  "cases/governance/case-governance.service.ts::if (!user.canDispatch && user.role.name !== 'ADMIN')",
  "cases/governance/case-governance.service.ts::if (actor.role.name === 'ADMIN') return null;",
  'cases/bulk/cases.bulk.service.ts::const isAdmin = input.actorRole === ROLE_NAMES.ADMIN;',
  'cases/cases.service.ts::const isAdmin = actorRole === ROLE_NAMES.ADMIN;',
  'incidents/incidents.service.ts::const isAdmin = actorRole === ROLE_NAMES.ADMIN;',
  "calendar-events/calendar-events.controller.ts::if (roleName === 'ADMIN') {",
  "calendar-events/calendar-events.service.ts::if (currentUser.role !== 'ADMIN') {",
  "calendar-events/calendar-events.service.ts::if (currentUser.role !== 'ADMIN') {",
  "calendar-events/calendar-events.service.ts::if (currentUser.role !== 'ADMIN' && !isLeader) {",
  "calendar-events/calendar-events.service.ts::if (currentUser.role === 'ADMIN') return;",
  'xlsx-imports/commit.service.ts::if (actor.role !== ROLE_NAMES.ADMIN) {',
  'xlsx-imports/xlsx-imports.service.ts::if (actor.role !== ROLE_NAMES.ADMIN) {',
  'xlsx-imports/xlsx-imports.service.ts::if (actor.role !== ROLE_NAMES.ADMIN && log.uploadedById !== actor.id) {',
  'xlsx-imports/xlsx-imports.service.ts::where: actor.role === ROLE_NAMES.ADMIN ? {} : { uploadedById: actor.id },',
  // Document numbers: an administrator sees and exports the log of everybody, anybody else their own.
  'document-numbers/document-numbers.controller.ts::const ADMIN_ROLES: string[] = [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN];',
  'document-numbers/document-numbers.controller.ts::if (log.userId !== user.id && !ADMIN_ROLES.includes(user.role)) {',
  "document-numbers/document-numbers.controller.ts::const scopedUserId = ADMIN_ROLES.includes(user?.role ?? '') ? userId : user?.id;",
  'document-numbers/document-numbers.controller.ts::if (!ADMIN_ROLES.includes(user.role)) {',
  // The engine of permissions by team itself: ADMIN is compiled to what the role holds, unrestricted.
  "authz/engine/compile.ts::export const ADMIN_ROLE = 'ADMIN';",
  'authz/engine/compile.ts::if (user.roleName === ADMIN_ROLE) {',
  'legacy-migration/legacy-migration.controller.ts::if (role !== ROLE_NAMES.ADMIN && role !== ROLE_NAMES.SUPER_ADMIN) {',
  'admin/bulk/bulk-import.controller.ts::const isAdmin = user.role === ROLE_NAMES.ADMIN;',
  'admin/bulk/bulk-import.service.ts::!(isAdmin && actor.role.name === ROLE_NAMES.ADMIN)',

  // ── Account and role administration: the ADMIN role itself is what is protected or what authorises a data-access grant ──
  'admin/admin.service.ts::if (role.name === ROLE_NAMES.ADMIN || nguoiSua?.roleId === roleId) {',
  // The administrator role must keep the role administration (the screen where enforcement is switched off).
  'admin/admin.service.ts::role.name === ROLE_NAMES.ADMIN',
  'admin/admin.service.ts::if (granterUser?.role?.name === ROLE_NAMES.ADMIN) isAuthorized = true;',
  'admin/admin.service.ts::const isAdmin = revokerUser?.role?.name === ROLE_NAMES.ADMIN;',

  // ── Reviewing edit-window reset requests: the administrator reviews everything; anybody else is asked through
  // `holdsPermission`, and the head-of-unit role survives only as its fallback while nothing is enforced ──
  "edit-window/edit-window.service.ts::if (user.role === ROLE_NAMES.ADMIN) return 'ALL';",
  "edit-window/edit-window.service.ts::return holdsPermission(user.id, REVIEW_PERMISSION, () => user.role === ROLE_NAMES.HEAD_UNIT) ? 'OWN_UNITS' : 'NONE';",

  // ── Deadline-rule approvers to notify: the role side, used only when `enforcement()?.holdersOf` answers nothing ──
  'deadline-rules/deadline-rules.service.ts::: { role: { name: { in: [ROLE_NAMES.DEADLINE_APPROVER, ROLE_NAMES.ADMIN] } } }),',

  // ── Who is NOTIFIED, not who may act. Administrators are left out of team notifications (they belong to no working
  // team); a case created with no team goes to the heads of unit BY ROLE: with no team there is no team permission
  // to ask, and the role is the only thing that says who answers for unassigned work ──
  'notifications/recipient-resolver.service.ts::role: { name: { not: ROLE_NAMES.ADMIN } },',
  'notifications/recipient-resolver.service.ts::role: { name: ROLE_NAMES.HEAD_UNIT },',
  'scheduler/deadline.scheduler.ts::role: { name: { not: ROLE_NAMES.ADMIN } },',

  // ── Not the system role at all: the standing of a person on ONE report (EDITOR / MANAGER / ADMIN), which
  // `reports.service` derives through `holdsPermission` ──
  "dynamic-reports/submission/submission.service.ts::if (actorRole === 'ADMIN') return pendingLevel;",
  "dynamic-reports/workflow/transitions.ts::if (c.actorRole !== 'MANAGER' && c.actorRole !== 'ADMIN') {",
  "dynamic-reports/workflow/transitions.ts::if (c.actorRole !== 'MANAGER' && c.actorRole !== 'ADMIN') {",
  "dynamic-reports/workflow/transitions.ts::if (c.actorRole !== 'MANAGER' && c.actorRole !== 'ADMIN') {",

  // ── The role is the SUBJECT: choosing which role to give a new account, sample rows of an import template ──
  'admin/bulk/bulk-import.service.ts::roles.find((r) => r.name === ROLE_NAMES.INVESTIGATOR)?.id ?? roles[0]?.id;',
  // Switching permissions by team on and off is for administrators: an active account whose role is the
  // administrator role, read from the rows and locked there.
  'authz/admin/authz-mode.service.ts::WHERE u."id" IN (${Prisma.join(ids)}) AND u."isActive" = true AND r."name" = ${ROLE_NAMES.ADMIN}',
  // Starter templates are built from what the officer role holds: the role is read, nobody is judged by it.
  'authz/admin/authz-admin.service.ts::where: { name: ROLE_NAMES.OFFICER },',
  "admin/bulk/bulk-import.controller.ts::role: 'OFFICER',",
  "admin/bulk/bulk-import.controller.ts::role: 'OFFICER',",

  // ── Command-line migration tools run by an operator (no request, no person being judged): they look up an
  // administrator account to own imported rows, or map a legacy role to a role id ──
  "legacy-migration/cli/backfill-ma-ho-so.ts::where: { role: { name: 'ADMIN' } },",
  "legacy-migration/cli/import.ts::const admin = await prisma.user.findFirst({ where: { role: { name: 'ADMIN' } }, select: { id: true } });",
  "legacy-migration/cli/seed-org.ts::roleId: roleName === 'ADMIN' ? adminRoleId : officerRoleId,",

  // ── Test support compiled with the source ──
  "cases/governance/case-ordinary-test.fixture.ts::return {id,isActive:true,canDispatch:true,role:{name:'ADMIN',permissions:['read','write','edit','restore'].map(action=>({permission:{subject:'Case',action,conditions:null}}))}};",
  'test-fixtures/test-fixtures.service.ts::where: { name: ROLE_NAMES.OFFICER },',
  "test-utils/controller-test-helpers.ts::user: { id: 'user-001', email: 'test@pc02.local', role: 'OFFICER' },",
  "test-utils/controller-test-helpers.ts::role: 'OFFICER',",
];

interface Mention {
  line: number;
  text: string;
  why: string;
}

const literalText = (node: ts.Node): string | null =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : null;

const EQUALITY = [
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
];

/** `x as const`, `(x)`, `x satisfies T`: the expression inside. */
function unwrap(node: ts.Expression): ts.Expression {
  let inner = node;
  while (ts.isParenthesizedExpression(inner) || ts.isAsExpression(inner) || ts.isSatisfiesExpression(inner) || ts.isNonNullExpression(inner)) {
    inner = inner.expression;
  }
  return inner;
}

const isRoleNamesAccess = (node: ts.Node): boolean =>
  (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
  ts.isIdentifier(node.expression) && node.expression.text === 'ROLE_NAMES';

/** The declared name when `const X = ...` is made of role names: one, or a list of them. */
function aliasDeclared(node: ts.Node): ts.Identifier | null {
  if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name) || !node.initializer) return null;
  const named = /role/i.test(node.name.text);
  const isName = (value: ts.Expression): boolean => {
    const inner = unwrap(value);
    if (isRoleNamesAccess(inner)) return true;
    // A bare literal is a role name only when the constant says it is about roles (`ADMIN_ROLE = 'ADMIN'`).
    const literal = literalText(inner);
    return named && literal !== null && NAMES.has(literal);
  };
  const initializer = unwrap(node.initializer);
  if (isName(initializer)) return node.name;
  if (ts.isArrayLiteralExpression(initializer) && initializer.elements.length > 0 && initializer.elements.every(isName)) return node.name;
  return null;
}

/** The constants one source file declares from role names. */
export function aliasesOf(fileName: string, text: string): string[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const names: string[] = [];
  const visit = (node: ts.Node): void => {
    const alias = aliasDeclared(node);
    if (alias) names.push(alias.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

/** Every mention of a role name in one source file. `aliases`: the constants declared from role names anywhere. */
export function mentionsOf(fileName: string, text: string, aliases: readonly string[] = aliasesOf(fileName, text)): Mention[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const lines = text.split(/\r?\n/);
  const mentions: Mention[] = [];
  const add = (node: ts.Node, why: string) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
    mentions.push({ line: line + 1, text: lines[line].trim(), why });
  };
  /** Inside the value of a property written `role: ...`. */
  const underRole = (node: ts.Node): boolean => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isPropertyAssignment(parent) && (ts.isIdentifier(parent.name) || ts.isStringLiteral(parent.name)) && parent.name.text === 'role') return true;
    }
    return false;
  };
  /** A use of the name as a value: not `x.NAME`, not `{ NAME: ... }`, not an import or export clause. */
  const isReference = (node: ts.Identifier): boolean => {
    const parent = node.parent;
    if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
    if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
    if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent)) return false;
    return true;
  };
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && aliases.includes(node.text) && isReference(node)) {
      const declared = ts.isVariableDeclaration(node.parent) && node.parent.name === node;
      add(node, `${declared ? 'declares' : 'uses'} the role-name constant ${node.text}`);
    }
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'ROLE_NAMES') {
      add(node, `ROLE_NAMES.${node.name.text}`);
    } else if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'ROLE_NAMES') {
      add(node, 'ROLE_NAMES[...]');
    } else {
      const value = literalText(node);
      if (value !== null && NAMES.has(value)) {
        const parent = node.parent;
        if (ts.isBinaryExpression(parent) && EQUALITY.includes(parent.operatorToken.kind)) {
          const other = parent.left === node ? parent.right : parent.left;
          if (/role/i.test(other.getText(source))) add(node, `compares a role with '${value}'`);
        } else if (underRole(node)) {
          add(node, `'${value}' inside role: { ... }`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return mentions;
}

/** What the gate says: the mentions nobody vouched for, and the entries that vouch for nothing. */
export function judge(found: { file: string; mentions: Mention[] }[], listed: string[]): { offences: string[]; stale: string[] } {
  // How many LINES each entry may still vouch for: an entry listed once covers one line, not every copy of it.
  const left = new Map<string, number>();
  for (const entry of listed) left.set(entry, (left.get(entry) ?? 0) + 1);
  const offences: string[] = [];
  for (const { file, mentions } of found) {
    const lines = new Map<number, Mention[]>();
    for (const mention of mentions) lines.set(mention.line, [...(lines.get(mention.line) ?? []), mention]);
    for (const [line, onLine] of lines) {
      const entry = `${file}::${onLine[0].text}`;
      const remaining = left.get(entry) ?? 0;
      if (remaining > 0) left.set(entry, remaining - 1);
      else offences.push(`${file}:${line}  ${onLine.map((m) => m.why).join(', ')}  |  ${onLine[0].text}`);
    }
  }
  return { offences, stale: [...left].filter(([, count]) => count > 0).map(([entry]) => entry) };
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') && !e.name.endsWith('.d.ts') ? [p] : [];
  });
}

describe('GATE: nothing decides about a person from the name of their role, unless listed as a fact about the role', () => {
  const files = sourceFiles(SRC);
  const relative = (file: string) => path.relative(SRC, file).replace(/\\/g, '/');
  const texts = files
    .map((file) => ({ file: relative(file), path: file, text: fs.readFileSync(file, 'utf8') }))
    .filter((f) => f.file !== 'common/constants/role.constants.ts');
  const aliases = [...new Set(texts.flatMap((f) => aliasesOf(f.path, f.text)))];
  const found = texts.map((f) => ({ file: f.file, mentions: mentionsOf(f.path, f.text, aliases) }));
  const mentionsIn = (file: string) => found.find((f) => f.file === file)?.mentions ?? [];

  it('the scan visits the source and sees the mentions known to be there', () => {
    // A scan that visited nothing, or a detector that sees nothing, would be green for the wrong reason.
    expect(files.length).toBeGreaterThanOrEqual(300);
    expect(mentionsIn('auth/services/unit-scope.service.ts')).toEqual([expect.objectContaining({ why: 'ROLE_NAMES.ADMIN' })]);
    expect(mentionsIn('cases/governance/case-governance.service.ts')).toEqual(
      expect.arrayContaining([expect.objectContaining({ why: `compares a role with 'ADMIN'` })]),
    );
    expect(mentionsIn('notifications/recipient-resolver.service.ts').map((m) => m.why)).toEqual(['ROLE_NAMES.ADMIN', 'ROLE_NAMES.HEAD_UNIT']);
    // Constants declared from role names, and their uses.
    expect([...aliases].sort()).toEqual(['ADMIN_ROLE', 'ADMIN_ROLES']);
    expect(mentionsIn('authz/engine/compile.ts').map((m) => m.why)).toEqual([
      'declares the role-name constant ADMIN_ROLE',
      'uses the role-name constant ADMIN_ROLE',
    ]);
    expect(mentionsIn('document-numbers/document-numbers.controller.ts').filter((m) => m.why === 'uses the role-name constant ADMIN_ROLES')).toHaveLength(3);
  });

  it('every mention of a role name is listed as a fact about the role', () => {
    expect(judge(found, A_FACT_ABOUT_THE_ROLE).offences).toEqual([]);
  });

  it('every listed line still exists', () => {
    expect(judge(found, A_FACT_ABOUT_THE_ROLE).stale).toEqual([]);
  });

  it('reviewing edit-window reset requests no longer decides by the name of a role alone', () => {
    // The one business decision that was written against a role name: it asks the permission now, and the role
    // name survives only inside the fallback handed to `holdsPermission`.
    const text = fs.readFileSync(path.join(SRC, 'edit-window/edit-window.service.ts'), 'utf8');
    const headOfUnit = mentionsOf('edit-window.service.ts', text).filter((m) => m.why === 'ROLE_NAMES.HEAD_UNIT');
    expect(headOfUnit).toHaveLength(1);
    expect(headOfUnit[0].text).toContain('holdsPermission(');
  });

  const seen = (body: string) => mentionsOf('sample.ts', body).map((m) => m.why);

  it.each([
    [`if (user.role === ROLE_NAMES.ADMIN) return null;`, ['ROLE_NAMES.ADMIN']],
    [`const ADMIN_ROLES: string[] = [ROLE_NAMES.ADMIN, ROLE_NAMES.SUPER_ADMIN];`, ['declares the role-name constant ADMIN_ROLES', 'ROLE_NAMES.ADMIN', 'ROLE_NAMES.SUPER_ADMIN']],
    // A constant declared from role names: every use of it is a mention.
    [`const ADMIN_ROLES = [ROLE_NAMES.ADMIN] as const; if (!ADMIN_ROLES.includes(user.role)) throw new Error();`, ['declares the role-name constant ADMIN_ROLES', 'ROLE_NAMES.ADMIN', 'uses the role-name constant ADMIN_ROLES']],
    [`export const ADMIN_ROLE = 'ADMIN'; const admin = user.roleName === ADMIN_ROLE;`, ['declares the role-name constant ADMIN_ROLE', 'uses the role-name constant ADMIN_ROLE']],
    [`const chief = ROLE_NAMES.HEAD_UNIT; return who === chief;`, ['declares the role-name constant chief', 'ROLE_NAMES.HEAD_UNIT', 'uses the role-name constant chief']],
    [`const name = ROLE_NAMES['ADMIN'];`, ['declares the role-name constant name', 'ROLE_NAMES[...]']],
    [`if (actor.role.name === 'ADMIN') return null;`, [`compares a role with 'ADMIN'`]],
    [`if ('TRUONG_DON_VI' != roleName) throw new Error();`, [`compares a role with 'TRUONG_DON_VI'`]],
    [`if (!user.canDispatch && user.role.name !== 'ADMIN') throw new Error();`, [`compares a role with 'ADMIN'`]],
    [`const where = { isActive: true, role: { name: { not: 'ADMIN' } } };`, [`'ADMIN' inside role: { ... }`]],
    [`const where = { role: { name: { in: ['OFFICER', 'DEADLINE_APPROVER'] } } };`, [`'OFFICER' inside role: { ... }`, `'DEADLINE_APPROVER' inside role: { ... }`]],
  ])('sees: %s', (body, expected) => {
    expect(seen(body)).toEqual(expected);
  });

  it.each([
    // The same words where no role is in question.
    [`const kind = audience === 'ADMIN' ? 1 : 2;`],
    [`const labels = { ADMIN: 'Quản trị' };`],
    [`log('OFFICER');`],
    [`if (status === 'SYSTEM') return;`],
    // A constant that merely has the word; a property or a key that merely has the name.
    [`const AUDIENCE = 'ADMIN'; send(AUDIENCE);`],
    [`const x = config.ADMIN_ROLES; const y = { ADMIN_ROLES: 1 };`],
  ])('does not take for a role: %s', (body) => {
    expect(seen(body)).toEqual([]);
  });

  it('an unlisted mention is an offence; a listed one is not; an entry that vouches for nothing is stale', () => {
    const sample = [{ file: 'x/y.ts', mentions: mentionsOf('y.ts', `if (user.role === ROLE_NAMES.HEAD_UNIT) allow();`) }];
    expect(judge(sample, []).offences).toEqual([`x/y.ts:1  ROLE_NAMES.HEAD_UNIT  |  if (user.role === ROLE_NAMES.HEAD_UNIT) allow();`]);
    expect(judge(sample, ['x/y.ts::if (user.role === ROLE_NAMES.HEAD_UNIT) allow();'])).toEqual({ offences: [], stale: [] });
    expect(judge(sample, ['x/y.ts::if (user.role === ROLE_NAMES.HEAD_UNIT) allow();', 'x/gone.ts::return 1;']).stale).toEqual(['x/gone.ts::return 1;']);
  });

  it('an entry vouches for ONE line: the same check copied into another operation is an offence until listed again', () => {
    const check = `if (user.role !== ROLE_NAMES.ADMIN) throw new Error();`;
    const entry = `x/y.ts::${check}`;
    const twice = [{ file: 'x/y.ts', mentions: mentionsOf('y.ts', ['function a() {', check, '}', 'function b() {', check, '}'].join('\n')) }];
    expect(judge(twice, [entry]).offences).toEqual([`x/y.ts:5  ROLE_NAMES.ADMIN  |  ${check}`]);
    expect(judge(twice, [entry, entry])).toEqual({ offences: [], stale: [] });
    // And an entry listed more often than the line exists is stale.
    expect(judge(twice, [entry, entry, entry]).stale).toEqual([entry]);
  });

  it('a constant declared from role names in one file is seen where another file uses it', () => {
    const other = `import { ADMIN_ROLE } from './compile'; export const admin = (name: string) => name === ADMIN_ROLE;`;
    expect(mentionsOf('other.ts', other, ['ADMIN_ROLE']).map((m) => m.why)).toEqual(['uses the role-name constant ADMIN_ROLE']);
    expect(mentionsOf('other.ts', other)).toEqual([]);
  });
});
