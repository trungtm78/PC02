import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * GATE: every record-scope check says which subject its records are.
 *
 * `buildScopeFilter` and `assertParentInScope` serve cases AND incidents with one predicate. Once permissions by team
 * are enforced, a call that does not name its subject is held to both scopes at once: safe, but it would hide records
 * a person is entitled to. This gate keeps a new call from forgetting, and it reads the code the way the compiler
 * does (an alias of the import, a generic argument, an explicit `undefined`, the helper handed to another name: none
 * of these gets past it).
 */
const HELPERS: Record<string, number> = {
  // name -> index of the subject argument
  buildScopeFilter: 2,
  assertParentInScope: 3,
};
const SRC = path.resolve(__dirname, '../..');
const SELF = path.resolve(__dirname, 'scope-filter.util.ts');

interface Offence {
  line: number;
  why: string;
}

/** Offences of one source file; `calls` counts the well-formed calls found (so an empty scan cannot be green). */
export function checkSource(fileName: string, text: string): { offences: Offence[]; calls: number } {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  const offences: Offence[] = [];
  let calls = 0;
  /** Local name -> helper it is bound to (an import may rename it). */
  const bound = new Map<string, string>();
  const lineOf = (node: ts.Node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause?.namedBindings) continue;
    const bindings = statement.importClause.namedBindings;
    if (!ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      const original = (element.propertyName ?? element.name).text;
      if (original in HELPERS) bound.set(element.name.text, original);
    }
  }
  if (bound.size === 0) return { offences, calls };

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isIdentifier(node) && bound.has(node.text)) {
      const helper = bound.get(node.text) as string;
      const parent = node.parent;
      // A property that merely has the same name (`x.buildScopeFilter`, `{ buildScopeFilter: 1 }`) is not the helper.
      const isOtherName =
        (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
        (ts.isPropertyAssignment(parent) && parent.name === node) ||
        (ts.isMethodDeclaration(parent) && parent.name === node);
      if (!isOtherName) {
        if (ts.isCallExpression(parent) && parent.expression === node) {
          const subject = parent.arguments[HELPERS[helper]];
          if (!subject) {
            offences.push({ line: lineOf(parent), why: `${helper} is called without a subject (${parent.arguments.length} argument(s))` });
          } else if (ts.isIdentifier(subject) && subject.text === 'undefined') {
            offences.push({ line: lineOf(parent), why: `${helper} is called with \`undefined\` as its subject` });
          } else if (parent.arguments.some((a) => ts.isSpreadElement(a))) {
            offences.push({ line: lineOf(parent), why: `${helper} is called with spread arguments: the subject cannot be seen` });
          } else calls += 1;
        } else {
          // Handed on under another name, stored, re-exported: every later call would escape this gate.
          offences.push({ line: lineOf(node), why: `${helper} is used other than by calling it directly` });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { offences, calls };
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts') && !e.name.endsWith('.d.ts') && p !== SELF ? [p] : [];
  });
}

describe('GATE: every record-scope check names its subject', () => {
  it('no call in the source forgets it', () => {
    let calls = 0;
    const offences: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      if (!/buildScopeFilter|assertParentInScope/.test(text)) continue;
      const result = checkSource(file, text);
      calls += result.calls;
      for (const o of result.offences) offences.push(`${path.relative(SRC, file).replace(/\\/g, '/')}:${o.line}  ${o.why}`);
    }
    expect(offences).toEqual([]);
    // A scan that found nothing would be green for the wrong reason.
    expect(calls).toBeGreaterThanOrEqual(60);
  });

  const check = (body: string, imports = `import { buildScopeFilter, assertParentInScope } from './scope-filter.util';`) =>
    checkSource('sample.ts', `${imports}\n${body}`);

  it('accepts calls that name their subject, whatever their layout', () => {
    const { offences, calls } = check(`
      buildScopeFilter(scope, 'read', 'Case');
      assertParentInScope(parent, scope, 'write', record.case ? 'Case' : 'Incident');
      buildScopeFilter(
        getScope<string, number>({ a: 1, b: [1, 2] }),
        'assign',
        subject,
      );
    `);
    expect(offences).toEqual([]);
    expect(calls).toBe(3);
  });

  it.each([
    [`buildScopeFilter(scope);`, 'without a subject (1 argument(s))'],
    [`buildScopeFilter(scope, 'read');`, 'without a subject (2 argument(s))'],
    [`assertParentInScope(parent, scope, 'write');`, 'without a subject (3 argument(s))'],
    // A comma inside a generic or an object is not an argument.
    [`buildScopeFilter(getScope<string, number>(), 'read');`, 'without a subject (2 argument(s))'],
    [`buildScopeFilter({ a: 1, b: 2 }, 'read');`, 'without a subject (2 argument(s))'],
    [`buildScopeFilter(scope, 'read', undefined);`, '`undefined` as its subject'],
    [`buildScopeFilter(...args);`, 'without a subject'],
    [`buildScopeFilter(scope, 'read', ...rest);`, 'spread arguments'],
    [`const f = buildScopeFilter; f(scope);`, 'used other than by calling it directly'],
    [`export { assertParentInScope };`, 'used other than by calling it directly'],
    [`run(buildScopeFilter);`, 'used other than by calling it directly'],
  ])('refuses: %s', (body, why) => {
    const { offences } = check(body);
    expect(offences).toHaveLength(1);
    expect(offences[0].why).toContain(why);
  });

  it('follows an import under another name', () => {
    const renamed = `import { buildScopeFilter as filter } from './scope-filter.util';`;
    expect(check(`filter(scope);`, renamed).offences[0].why).toContain('buildScopeFilter is called without a subject');
    expect(check(`filter(scope, 'read', 'Incident');`, renamed)).toEqual({ offences: [], calls: 1 });
  });

  it('is not fooled by comments, strings, or another thing with the same name', () => {
    const { offences, calls } = check(`
      // buildScopeFilter(scope)
      /* assertParentInScope(parent, scope) */
      const text = "buildScopeFilter(scope)";
      service.buildScopeFilter(scope);
      const o = { assertParentInScope: 1 };
    `);
    expect(offences).toEqual([]);
    expect(calls).toBe(0);
  });

  it('a file that does not import the helpers is not its business', () => {
    expect(checkSource('x.ts', `function buildScopeFilter(a: number) { return a; }\nbuildScopeFilter(1);`)).toEqual({ offences: [], calls: 0 });
  });

  it('reports the line of the call', () => {
    expect(check(`\n\nbuildScopeFilter(scope);`).offences[0].line).toBe(4);
  });
});
