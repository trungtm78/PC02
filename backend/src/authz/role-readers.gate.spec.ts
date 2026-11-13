import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * GATE: nothing decides what a PERSON may do by reading the permissions of their role on its own.
 *
 * Once permissions by team are enforced a person holds what their teams give, not what the role holds. Code that
 * checks a permission itself asks `holdsPermission(userId, key, () => <the role check>)`, or reads
 * `enforcement()?.keysOf(userId)` first and falls back to the role only when that answers nothing (`enforcement.ts`).
 * A new service that reads the role directly would keep answering from the role while the route guard, `/auth/me`
 * and every other service answer from the teams.
 *
 * The gate reads the code the way the compiler does. A READ OF A ROLE'S PERMISSIONS is:
 *   - `x.rolePermission` (the join table on a Prisma client or transaction), also `x?.rolePermission`, `x['rolePermission']`;
 *   - `role.permissions` / `x.role.permissions` / `x.role?.permissions` (the relation on a loaded role);
 *   - `role: { include | select: { permissions ... } }` and `x.role.findMany({ include | select: { permissions ... } })`
 *     (loading the relation);
 *   - `role: { permissions: { some ... } }` (filtering people by what their role holds).
 * A read is GUARDED, and passes, when it is
 *   - inside the arguments of a `holdsPermission(...)` call, or
 *   - on the role side of a value that came from `enforcement()?.keysOf(...)`: the right of `keysOf(...) ?? ...`,
 *     the `:` branch of `held ? ... : ...`, the `else` of `if (held)`, or after an `if (held) return/throw` in the
 *     same block, where `held` was declared as `enforcement()?.keysOf(...)` in the file.
 * Every other read must be listed below, line by line, with why it is not a decision about a person. A listed line
 * that no longer exists, or that has become guarded, fails the gate: the list cannot rot.
 *
 * What the syntax tree cannot tell: whether a LOADED role (an `include`) is later judged somewhere this gate does not
 * look (passed to another function, destructured). The loads are therefore listed too, each naming where its result
 * is judged. `held` is matched by name within the file, not by scope.
 */
const SRC = path.resolve(__dirname, '..');

/** `file::trimmed line text`. Every entry must vouch for at least one unguarded read. */
const NOT_A_DECISION_ABOUT_A_PERSON = [
  // ── The role fallback of the three places that already ask the enforcement first ──
  // The route guard: `rolePermissions(roleId)` is called only when `enforcement()?.keysOf` answered nothing
  // (asserted in enforce-wiring.spec.ts); the read sits in a helper, so the gate cannot see the guard around it.
  'auth/guards/permissions.guard.ts::const rolePerms = await this.prisma.rolePermission.findMany({',
  // `/auth/me`: loads the role with the profile; the list returned is `enforcement()?.keysOf(...) ?? role` (guarded).
  'auth/auth.service.ts::role: { include: { permissions: { include: { permission: true } } } },',
  // Case governance loads the actor once; `permission()` judges it after `if (held) return` (guarded).
  'cases/governance/case-governance.service.ts::role: { include: { permissions: { include: { permission: true } } } },',

  // ── Loads whose result is judged inside `holdsPermission` a few lines below ──
  // (1) splitCase: the actor in the shape `CaseGovernanceService.currentScope` takes; no permission is judged from it.
  // (2) assertSourceScope: judged by the guarded `user.role.permissions.some(` under `holdsPermission`.
  'cases/governance/legal-workflow.service.ts::role: { include: { permissions: { include: { permission: true } } } },',
  // getJob: judged by the guarded `actor.role.permissions.some(` under `holdsPermission`; `role.name` is read too.
  'admin/bulk/bulk-import.service.ts::role: { include: { permissions: { include: { permission: true } } } },',

  // ── Roles in the abstract: no person is being judged ──
  // The permission sets of the ROLES a change touches (the actor's, the target's, the next role, the edited role):
  // they tell whether the change concerns business authority and what a role switch would give. What the ACTOR may
  // do is asked through `holdsPermission` further down in the same function.
  'admin/case-authority.guard.ts::const rows = await tx.rolePermission.findMany({',
  // Role administration: listing roles with their permissions for the "roles and permissions" screen.
  'admin/admin.service.ts::permissions: { include: { permission: true } },',
  // Role administration: the (action, subject) pairs of one role, for the matrix on that screen.
  'admin/admin.service.ts::return role.permissions',
  // Starter templates: the permissions of the officer ROLE are copied into templates; no person is judged.
  'authz/admin/authz-admin.service.ts::select: { permissions: { select: { permission: { select: { action: true, subject: true } } } } },',
  'authz/admin/authz-admin.service.ts::const docs = starterTemplates(role.permissions.map((p) => pair(p.permission)));',
  // Role administration: replacing a role's permissions (read the old set for the audit diff, delete, insert).
  'admin/admin.service.ts::const truoc = await tx.rolePermission.findMany({',
  'admin/admin.service.ts::await tx.rolePermission.deleteMany({',
  'admin/admin.service.ts::await tx.rolePermission.createMany({',
  // The snapshot loader of permissions by team: role permissions are an INPUT of the engine that computes what
  // each person holds (the very thing `keysOf` answers from).
  'authz/authz.service.ts::select: { id: true, name: true, permissions: { select: { permission: { select: { action: true, subject: true, conditions: true } } } } },',
  'authz/authz.service.ts::rolePermissions: role?.permissions ?? [],',
  // Test support compiled with the source: fills in a `rolePermission` delegate on a fake transaction.
  'admin/test-authority-fixture.ts::rolePermission: db.rolePermission?.findMany ? db.rolePermission : { ...db.rolePermission, findMany: jest.fn().mockResolvedValue([]) },',

  // `userHoldingPermission`: the role side of "a user who holds this permission" for filters over many people; it is
  // used only when nothing is enforced (the enforced side lists the holders by id).
  'authz/enforcement.ts::return { role: { permissions: { some: { permission: { action, subject } } } } };',
];

interface Read {
  line: number;
  /** The trimmed text of that line: what an allowlist entry quotes. */
  text: string;
  why: string;
  /** Inside `holdsPermission(...)` or on the role side of `enforcement()?.keysOf(...)`. */
  guarded: boolean;
}

/** `(x)`, `x!`, `x as T`: the expression inside. */
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

const nameOf = (name: ts.PropertyName | undefined): string | null =>
  name && (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) ? name.text : null;

/** The property `key` of an object literal, when it is written `key: ...`. */
function property(object: ts.Expression | undefined, key: string): ts.PropertyAssignment | undefined {
  if (!object) return undefined;
  const literal = unwrap(object);
  if (!ts.isObjectLiteralExpression(literal)) return undefined;
  return literal.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && nameOf(p.name) === key);
}

/** `enforcement()?.keysOf(...)`. */
function isKeysOfCall(node: ts.Node): boolean {
  // Any of the questions that say what a person holds.
  const HELD = ['keysOf', 'unconditionalKeysOf'];
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression) || !HELD.includes(node.expression.name.text)) return false;
  const owner = unwrap(node.expression.expression);
  return ts.isCallExpression(owner) && ts.isIdentifier(owner.expression) && owner.expression.text === 'enforcement';
}

/** A statement after which the rest of the block does not run: `return`, `throw`, or a block ending in one. */
function leaves(statement: ts.Statement): boolean {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) return true;
  return ts.isBlock(statement) && statement.statements.length > 0 && leaves(statement.statements[statement.statements.length - 1]);
}

/** Every read of a role's permissions in one source file. */
export function readsOf(fileName: string, text: string): Read[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const lines = text.split(/\r?\n/);
  const reads: Read[] = [];

  /**
   * `const held = enforcement()?.keysOf(...)`: the name, and the function it was declared in. A variable of the same
   * name in ANOTHER function (a parameter, an unrelated flag) says nothing about what the person holds.
   */
  const heldDeclarations: { name: string; scope: ts.Node }[] = [];
  const functionOf = (node: ts.Node): ts.Node => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isFunctionLike(parent) || ts.isSourceFile(parent)) return parent;
    }
    return source;
  };
  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && isKeysOfCall(unwrap(node.initializer))) {
      heldDeclarations.push({ name: node.name.text, scope: functionOf(node) });
    }
    ts.forEachChild(node, collect);
  };
  collect(source);
  /** `held` (declared in this function or one enclosing it), or the call itself: what the person holds. */
  const isHeld = (node: ts.Expression): boolean => {
    const inner = unwrap(node);
    if (isKeysOfCall(inner)) return true;
    if (!ts.isIdentifier(inner)) return false;
    const enclosing = new Set<ts.Node>();
    for (let parent: ts.Node | undefined = inner; parent; parent = parent.parent) {
      if (ts.isFunctionLike(parent) || ts.isSourceFile(parent)) enclosing.add(parent);
    }
    return heldDeclarations.some((d) => d.name === inner.text && enclosing.has(d.scope));
  };
  const within = (node: ts.Node, container: ts.Node | undefined): boolean =>
    !!container && node.getStart(source) >= container.getStart(source) && node.getEnd() <= container.getEnd();

  const guarded = (node: ts.Node): boolean => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === 'holdsPermission') {
        if (parent.arguments.some((argument) => within(node, argument))) return true;
      }
      if (ts.isConditionalExpression(parent) && isHeld(parent.condition) && within(node, parent.whenFalse)) return true;
      if (
        ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
        isHeld(parent.left) && within(node, parent.right)
      ) {
        return true;
      }
      if (ts.isIfStatement(parent) && isHeld(parent.expression) && within(node, parent.elseStatement)) return true;
      if (ts.isBlock(parent) || ts.isSourceFile(parent)) {
        for (const statement of parent.statements) {
          if (statement.getEnd() > node.getStart(source)) break;
          if (ts.isIfStatement(statement) && isHeld(statement.expression) && !statement.elseStatement && leaves(statement.thenStatement)) return true;
        }
      }
    }
    return false;
  };
  const add = (node: ts.Node, why: string) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
    reads.push({ line: line + 1, text: lines[line].trim(), why, guarded: guarded(node) });
  };
  /** `role` or `x.role` / `x?.role`. */
  const isRole = (node: ts.Expression): boolean => {
    const inner = unwrap(node);
    return (ts.isIdentifier(inner) && inner.text === 'role') || (ts.isPropertyAccessExpression(inner) && inner.name.text === 'role');
  };
  /** `{ include | select: { permissions: ... } }`: the `permissions` property. */
  const loadedPermissions = (args: ts.Expression | undefined): ts.PropertyAssignment | undefined =>
    property(property(args, 'include')?.initializer, 'permissions') ?? property(property(args, 'select')?.initializer, 'permissions');

  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'rolePermission') {
      add(node.name, 'reads .rolePermission');
    } else if (ts.isElementAccessExpression(node)) {
      const key = unwrap(node.argumentExpression);
      if ((ts.isStringLiteral(key) || ts.isNoSubstitutionTemplateLiteral(key)) && key.text === 'rolePermission') {
        add(node.argumentExpression, `reads ['rolePermission']`);
      }
    } else if (ts.isPropertyAccessExpression(node) && node.name.text === 'permissions' && isRole(node.expression)) {
      add(node.name, 'reads role.permissions');
    } else if (ts.isPropertyAssignment(node) && nameOf(node.name) === 'role') {
      // `role: { include: { permissions } }` in a query on a person; `role: { permissions: { some } }` in a filter.
      const loaded = loadedPermissions(node.initializer);
      if (loaded) add(loaded, 'loads role.permissions');
      // A relation filter has `some` / `every` / `none`; an object that is merely BUILT with these keys has a list.
      const filtered = property(node.initializer, 'permissions');
      if (filtered && ['some', 'every', 'none'].some((key) => property(filtered.initializer, key))) {
        add(filtered, 'filters people on role.permissions');
      }
    } else if (
      ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      ts.isPropertyAccessExpression(unwrap(node.expression.expression)) &&
      (unwrap(node.expression.expression) as ts.PropertyAccessExpression).name.text === 'role'
    ) {
      // `prisma.role.findMany({ include: { permissions } })`: the role model itself.
      const loaded = loadedPermissions(node.arguments[0]);
      if (loaded) add(loaded, 'loads role.permissions');
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return reads;
}

/** What the gate says: the unguarded reads nobody vouched for, and the entries that vouch for nothing. */
export function judge(found: { file: string; reads: Read[] }[], listed: string[]): { offences: string[]; stale: string[] } {
  const used = new Set<string>();
  const offences: string[] = [];
  for (const { file, reads } of found) {
    for (const read of reads) {
      if (read.guarded) continue;
      const entry = `${file}::${read.text}`;
      if (listed.includes(entry)) used.add(entry);
      else offences.push(`${file}:${read.line}  ${read.why}  |  ${read.text}`);
    }
  }
  return { offences, stale: listed.filter((entry) => !used.has(entry)) };
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') && !e.name.endsWith('.d.ts') ? [p] : [];
  });
}

describe('GATE: nothing decides about a person from the permissions of their role alone', () => {
  const files = sourceFiles(SRC);
  const relative = (file: string) => path.relative(SRC, file).replace(/\\/g, '/');
  const found = files.map((file) => ({ file: relative(file), reads: readsOf(file, fs.readFileSync(file, 'utf8')) }));
  const readsIn = (file: string) => found.find((f) => f.file === file)?.reads ?? [];

  it('the scan visits the source, and sees both guarded and unguarded reads where they are known to be', () => {
    // A scan that visited nothing, or a detector that sees nothing, would be green for the wrong reason.
    expect(files.length).toBeGreaterThanOrEqual(300);
    // The route guard's helper: an unguarded `.rolePermission` read (listed).
    expect(readsIn('auth/guards/permissions.guard.ts')).toEqual([expect.objectContaining({ why: 'reads .rolePermission', guarded: false })]);
    // Case governance: the load is unguarded (listed), the judgement after `if (held) return` is guarded.
    expect(readsIn('cases/governance/case-governance.service.ts')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ why: 'loads role.permissions', guarded: false }),
        expect.objectContaining({ why: 'reads role.permissions', guarded: true }),
      ]),
    );
    // A service that decides through `holdsPermission`: every read of it is guarded.
    const ocr = readsIn('ocr-import/ocr-send-policy.ts');
    expect(ocr.length).toBeGreaterThan(0);
    expect(ocr.every((read) => read.guarded)).toBe(true);
    // The profile: `enforcement()?.keysOf(...) ?? role`.
    expect(readsIn('auth/auth.service.ts')).toEqual(expect.arrayContaining([expect.objectContaining({ why: 'reads role.permissions', guarded: true })]));
  });

  it('every read of a role\'s permissions is guarded by the enforcement, or listed as not a decision about a person', () => {
    expect(judge(found, NOT_A_DECISION_ABOUT_A_PERSON).offences).toEqual([]);
  });

  it('every listed line still exists and is still unguarded', () => {
    expect(judge(found, NOT_A_DECISION_ABOUT_A_PERSON).stale).toEqual([]);
    expect(new Set(NOT_A_DECISION_ABOUT_A_PERSON).size).toBe(NOT_A_DECISION_ABOUT_A_PERSON.length);
  });

  const seen = (body: string) => readsOf('sample.ts', body).map((r) => `${r.why}${r.guarded ? ' (guarded)' : ''}`);

  it.each([
    [`const n = await this.prisma.rolePermission.count({ where: { roleId } });`, ['reads .rolePermission']],
    [`const row = await tx.rolePermission.findFirst({ where: { roleId } });`, ['reads .rolePermission']],
    [`const rows = await client?.rolePermission.findMany();`, ['reads .rolePermission']],
    [`const rows = await (tx as Tx).rolePermission.findMany();`, ['reads .rolePermission']],
    [`const rows = await tx['rolePermission'].findMany();`, [`reads ['rolePermission']`]],
    [`const ok = user.role.permissions.some((p) => p.permission.action === 'read');`, ['reads role.permissions']],
    [`const ok = user.role?.permissions.length;`, ['reads role.permissions']],
    [`const ok = user!.role!.permissions;`, ['reads role.permissions']],
    [`const pairs = role.permissions.map((p) => p.permission);`, ['reads role.permissions']],
    [`const u = await tx.user.findUnique({ where: { id }, include: { role: { include: { permissions: { include: { permission: true } } } } } });`, ['loads role.permissions']],
    [`const u = await tx.user.findUnique({ where: { id }, select: { role: { select: { permissions: true } } } });`, ['loads role.permissions']],
    [`const roles = await this.prisma.role.findMany({ include: { permissions: true } });`, ['loads role.permissions']],
    [`const roles = await tx.role.findMany({ select: { id: true, permissions: { select: { permission: true } } } });`, ['loads role.permissions']],
    [`const where = { isActive: true, role: { permissions: { some: { permission: { action: 'read' } } } } };`, ['filters people on role.permissions']],
  ])('sees: %s', (body, expected) => {
    expect(seen(body)).toEqual(expected);
  });

  it.each([
    // Inside the arguments of holdsPermission.
    [`const ok = await holdsPermission(userId, 'admin:X', async () => Boolean(await tx.rolePermission.findFirst({ where: { roleId } })));`, ['reads .rolePermission (guarded)']],
    [`if (!holdsPermission(id, 'read:User', () => actor.role.permissions.some(isRead))) throw new Error();`, ['reads role.permissions (guarded)']],
    // On the role side of what the enforcement answered.
    [`const held = enforcement()?.keysOf(id); const ok = held ? held.includes('a:B') : Boolean(await db.rolePermission.findFirst({}));`, ['reads .rolePermission (guarded)']],
    [`const held = enforcement()?.keysOf(id); if (held) return held.includes(key); return user.role.permissions.some(match);`, ['reads role.permissions (guarded)']],
    [`const held = enforcement()?.keysOf(id); if (held) { log(); return { a: true }; } const rows = await db.rolePermission.findMany({});`, ['reads .rolePermission (guarded)']],
    [`const held = enforcement()?.keysOf(id); let ok; if (held) { ok = held.includes(key); } else { ok = (await db.rolePermission.count({})) > 0; }`, ['reads .rolePermission (guarded)']],
    [`const keys = enforcement()?.keysOf(user.id) ?? user.role.permissions.map(pair);`, ['reads role.permissions (guarded)']],
  ])('accepts as guarded: %s', (body, expected) => {
    expect(seen(body)).toEqual(expected);
  });

  it.each([
    // The role is read BEFORE the enforcement is asked, or on its own side of the branch.
    [`const rows = await db.rolePermission.findMany({}); const held = enforcement()?.keysOf(id); if (held) return 1;`],
    [`const held = enforcement()?.keysOf(id); const ok = held ? Boolean(await db.rolePermission.findFirst({})) : false;`],
    [`const held = enforcement()?.keysOf(id); if (held) { await db.rolePermission.findMany({}); }`],
    // An `if (held)` that does not leave the block guards nothing after it.
    [`const held = enforcement()?.keysOf(id); if (held) { log(); } const rows = await db.rolePermission.findMany({});`],
    // A name that merely looks like it: not declared from `enforcement()?.keysOf`.
    [`const held = cache.get(id); if (held) return 1; const rows = await db.rolePermission.findMany({});`],
    [`const held = other()?.keysOf(id); const ok = held ? true : Boolean(await db.rolePermission.findFirst({}));`],
    // Next to a holdsPermission call, not inside it; and a different function of a similar name.
    [`const a = holdsPermission(id, 'a:B', () => true); const rows = await db.rolePermission.findMany({});`],
    [`const ok = await holdsPermissions(id, async () => Boolean(await db.rolePermission.findFirst({})));`],
    [`const ok = await this.holdsPermission(id, async () => Boolean(await db.rolePermission.findFirst({})));`],
    // A guard in ANOTHER function does not reach this one.
    [`function a() { const held = enforcement()?.keysOf(id); if (held) return 1; return 2; } function b() { return db.rolePermission.findMany({}); }`],
  ])('does NOT accept as guarded: %s', (body) => {
    const reads = readsOf('sample.ts', body);
    expect(reads).toHaveLength(1);
    expect(reads[0].guarded).toBe(false);
  });

  it('is not fooled by a type, a comment, a string, building an object, or another object\'s permissions', () => {
    expect(
      seen(`
        // tx.rolePermission.findMany and user.role.permissions
        /* role: { include: { permissions: true } } */
        const text = "this.prisma.rolePermission.count() and role.permissions";
        type Actor = Prisma.UserGetPayload<{ include: { role: { include: { permissions: { include: { permission: true } } } } } }>;
        interface Input { rolePermission: string; role: { permissions: string[] } }
        const fake = { rolePermission: { findMany: jest.fn() } };
        const built = { id, isActive: true, role: { name: 'ADMIN', permissions: ['read'].map((action) => ({ permission: { action } })) } };
        const rolePermission = 1;
        const dtoPairs = dto.permissions.map(key);
        const mine = profile.permissions.includes('read:Case');
        const u = await tx.user.findUnique({ where: { id }, include: { role: true } });
        const roleName = user.role.name;
        const p = await tx.permission.findMany({ orderBy: { subject: 'asc' } });
        const r = await tx.role.findMany({ include: { _count: { select: { users: true } } } });
      `),
    ).toEqual([]);
  });

  it('reports the line and its text, the way an entry quotes it', () => {
    expect(readsOf('sample.ts', `\n\n    return tx.rolePermission.count();   `)).toEqual([
      { line: 3, text: 'return tx.rolePermission.count();', why: 'reads .rolePermission', guarded: false },
    ]);
    // A load is reported on the line of its \`permissions\`, also when the query spans lines.
    expect(readsOf('sample.ts', `tx.user.findUnique({\n  include: {\n    role: {\n      include: { permissions: true },\n    },\n  },\n});`)).toEqual([
      { line: 4, text: 'include: { permissions: true },', why: 'loads role.permissions', guarded: false },
    ]);
  });

  describe('judging', () => {
    const sample = [
      {
        file: 'a/service.ts',
        reads: [
          { line: 7, text: 'return tx.rolePermission.count();', why: 'reads .rolePermission', guarded: false },
          { line: 9, text: 'held ? 1 : tx.rolePermission.count();', why: 'reads .rolePermission', guarded: true },
        ],
      },
    ];

    it('an unguarded read nobody vouched for is an offence with its file and line; a guarded one is not', () => {
      expect(judge(sample, [])).toEqual({
        offences: ['a/service.ts:7  reads .rolePermission  |  return tx.rolePermission.count();'],
        stale: [],
      });
    });

    it('a listed line passes; the same text in another file does not', () => {
      expect(judge(sample, ['a/service.ts::return tx.rolePermission.count();'])).toEqual({ offences: [], stale: [] });
      const elsewhere = judge(sample, ['b/service.ts::return tx.rolePermission.count();']);
      expect(elsewhere.offences).toHaveLength(1);
      expect(elsewhere.stale).toEqual(['b/service.ts::return tx.rolePermission.count();']);
    });

    it('an entry that matches no line, or only a guarded one, is stale', () => {
      expect(judge(sample, ['a/service.ts::return tx.rolePermission.count();', 'a/service.ts::gone();', 'a/service.ts::held ? 1 : tx.rolePermission.count();']).stale).toEqual([
        'a/service.ts::gone();',
        'a/service.ts::held ? 1 : tx.rolePermission.count();',
      ]);
    });
  });

  describe('a variable is "what the person holds" only where it was declared so', () => {
    const guardedFlags = (body: string) => readsOf('sample.ts', body).map((r) => r.guarded);

    it('the same name in ANOTHER function (a parameter, an unrelated flag) guards nothing', () => {
      expect(
        guardedFlags(`
          function a(id: string) {
            const held = enforcement()?.keysOf(id);
            return held;
          }
          function b(user: any, held = false) {
            if (held) return false;
            return user.role.permissions.some(match);
          }
        `),
      ).toEqual([false]);
    });

    it('declared in the same function, or in one that encloses the read, it does', () => {
      expect(
        guardedFlags(`
          function a(user: any) {
            const held = enforcement()?.unconditionalKeysOf(user.id);
            if (held) return held.includes('x');
            return user.role.permissions.some(match);
          }
          function b(user: any) {
            const held = enforcement()?.keysOf(user.id);
            const check = () => (held ? held.includes('x') : user.role.permissions.some(match));
            return check();
          }
        `),
      ).toEqual([true, true]);
    });
  });
});
