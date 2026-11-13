import * as fs from 'fs';
import * as path from 'path';

/**
 * Gate: every call of `buildScopeFilter(` and `assertParentInScope(` outside spec files must say which subject
 * ('Case' or 'Incident') its records are, as the last argument.
 *
 * Why: when permissions by team are enforced, a call WITHOUT a subject is held to both the Case scope and the
 * Incident scope. That is safe, but too strict, and nothing at the call site shows it. The check is structural
 * (it counts arguments), so it does not prove the subject is the RIGHT one: that stays a review matter.
 */

const SRC_ROOT = path.resolve(__dirname, '..', '..');
const SELF = 'common/utils/scope-filter.util.ts';

/** Number of arguments a call must pass for the subject (the last parameter) to be present. */
const REQUIRED_ARGS: Record<string, number> = {
  buildScopeFilter: 3,
  assertParentInScope: 4,
};

/**
 * Calls allowed to omit the subject, keyed by `relative/path.ts` + the trimmed text of the call's first line.
 * Empty: every call names its subject today. An entry needs a written reason why the subject cannot be told.
 */
const ALLOWED_WITHOUT_SUBJECT: ReadonlySet<string> = new Set<string>([]);

interface ScopeCall {
  name: string;
  /** 1-based line of the call's name. */
  line: number;
  /** Trimmed source text of that line. */
  firstLine: string;
  args: string[];
}

const OPEN = '([{';
const CLOSE = ')]}';

/**
 * Blank out comments (and keep string contents) so that a call mentioned in a comment is not counted and a bracket
 * or comma inside a comment cannot disturb the count. Newlines are kept: line numbers stay true.
 */
function stripComments(source: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (
        i < source.length &&
        !(source[i] === '*' && source[i + 1] === '/')
      ) {
        if (source[i] === '\n') out += '\n';
        i += 1;
      }
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Read the argument list that starts just after an opening parenthesis: top-level commas split it. */
function readArgs(code: string, start: number): string[] {
  const args: string[] = [];
  let depth = 1;
  let current = '';
  let quote: string | null = null;
  for (let i = start; i < code.length; i += 1) {
    const ch = code[i];
    if (quote) {
      current += ch;
      if (ch === '\\') {
        current += code[i + 1] ?? '';
        i += 1;
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if (OPEN.includes(ch)) depth += 1;
    else if (CLOSE.includes(ch)) {
      depth -= 1;
      if (depth === 0) break;
    } else if (ch === ',' && depth === 1) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  // A trailing comma leaves an empty last piece: it is not an argument.
  if (current.trim()) args.push(current.trim());
  return args;
}

/** Every call of the two helpers in a source text (declarations `function name(` are not calls). */
export function findScopeCalls(source: string): ScopeCall[] {
  const code = stripComments(source);
  const lines = source.split('\n');
  const calls: ScopeCall[] = [];
  const pattern =
    /(function\s+)?\b(buildScopeFilter|assertParentInScope)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    if (match[1]) continue;
    const line = code.slice(0, match.index).split('\n').length;
    calls.push({
      name: match[2],
      line,
      firstLine: (lines[line - 1] ?? '').trim(),
      args: readArgs(code, match.index + match[0].length),
    });
  }
  return calls;
}

/** The calls that do not pass a subject. */
export function callsWithoutSubject(source: string): ScopeCall[] {
  return findScopeCalls(source).filter(
    (call) => call.args.length < REQUIRED_ARGS[call.name],
  );
}

function listSourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listSourceFiles(full));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
      found.push(full);
  }
  return found;
}

describe('scope subject gate', () => {
  describe('the checker itself', () => {
    it('reports a buildScopeFilter call with two arguments', () => {
      const offenders = callsWithoutSubject(
        "const where = buildScopeFilter(scope, 'read');\n",
      );
      expect(offenders).toHaveLength(1);
      expect(offenders[0]).toMatchObject({ name: 'buildScopeFilter', line: 1 });
    });

    it('reports a call that relies on both defaults', () => {
      expect(callsWithoutSubject('x = buildScopeFilter(scope);')).toHaveLength(
        1,
      );
    });

    it('reports an assertParentInScope call with three arguments, on its own line', () => {
      const offenders = callsWithoutSubject(
        "const a = 1;\nassertParentInScope(record.case, scope, 'write');\n",
      );
      expect(offenders).toHaveLength(1);
      expect(offenders[0].line).toBe(2);
      expect(offenders[0].firstLine).toBe(
        "assertParentInScope(record.case, scope, 'write');",
      );
    });

    it('accepts a multi-line call with a nested object and the subject last', () => {
      const source = [
        'assertParentInScope(',
        '  { ...record, intakeStage: null, extra: [1, 2, fn(a, b)] },',
        '  await this.currentScope(tx, user),',
        "  'write',",
        "  'Case',",
        ');',
      ].join('\n');
      expect(findScopeCalls(source)[0].args).toHaveLength(4);
      expect(callsWithoutSubject(source)).toHaveLength(0);
    });

    it('does not let the commas of a nested object stand in for missing arguments', () => {
      const source = [
        'assertParentInScope(',
        '  { assignedTeamId: a, investigatorId: b, intakeStage: c },',
        '  scope,',
        "  'write',",
        ');',
      ].join('\n');
      expect(findScopeCalls(source)[0].args).toHaveLength(3);
      expect(callsWithoutSubject(source)).toHaveLength(1);
    });

    it('accepts a subject chosen at runtime', () => {
      expect(
        callsWithoutSubject(
          "assertParentInScope(r.case ?? r.incident, scope, 'read', r.case ? 'Case' : 'Incident');",
        ),
      ).toHaveLength(0);
    });

    it('ignores calls inside comments, and comment text inside a real call', () => {
      const source = [
        '// buildScopeFilter(scope) is how it used to be',
        '/* assertParentInScope(a, b)',
        '   buildScopeFilter(scope) */',
        'const w = buildScopeFilter(',
        '  scope, // the read scope, as before',
        "  'read',",
        "  'Incident',",
        ');',
      ].join('\n');
      const calls = findScopeCalls(source);
      expect(calls).toHaveLength(1);
      expect(calls[0].line).toBe(4);
      expect(callsWithoutSubject(source)).toHaveLength(0);
    });

    it('does not take the declaration of a helper for a call', () => {
      expect(
        findScopeCalls('export function buildScopeFilter(scope, op) {}'),
      ).toHaveLength(0);
    });
  });

  describe('backend/src', () => {
    const scanned = listSourceFiles(SRC_ROOT)
      .map((file) => ({
        file,
        relative: path.relative(SRC_ROOT, file).split(path.sep).join('/'),
      }))
      .filter(({ relative }) => relative !== SELF)
      .map(({ file, relative }) => ({
        relative,
        calls: findScopeCalls(fs.readFileSync(file, 'utf8')),
      }));
    const allCalls = scanned.flatMap(({ relative, calls }) =>
      calls.map((call) => ({ relative, call })),
    );
    const withoutSubject = allCalls.filter(
      ({ call }) => call.args.length < REQUIRED_ARGS[call.name],
    );
    const key = (relative: string, call: ScopeCall) =>
      `${relative}::${call.firstLine}`;

    it('finds the calls it is meant to guard (an empty scan cannot be green)', () => {
      expect(allCalls.length).toBeGreaterThanOrEqual(60);
      expect(
        allCalls.some(({ call }) => call.name === 'buildScopeFilter'),
      ).toBe(true);
      expect(
        allCalls.some(({ call }) => call.name === 'assertParentInScope'),
      ).toBe(true);
    });

    it('every call passes a subject (nothing is excused today)', () => {
      const offenders = withoutSubject
        .filter(
          ({ relative, call }) =>
            !ALLOWED_WITHOUT_SUBJECT.has(key(relative, call)),
        )
        .map(
          ({ relative, call }) =>
            `${relative}:${call.line}  ${call.name} has ${call.args.length} argument(s), needs ${REQUIRED_ARGS[call.name]}`,
        );
      expect(offenders).toEqual([]);
    });

    it('the allowlist holds no stale entry, and each entry excuses exactly one call', () => {
      const used = withoutSubject.map(({ relative, call }) =>
        key(relative, call),
      );
      for (const entry of ALLOWED_WITHOUT_SUBJECT) {
        expect({
          entry,
          calls: used.filter((k) => k === entry).length,
        }).toEqual({
          entry,
          calls: 1,
        });
      }
    });
  });
});
