import * as fs from 'fs';
import * as path from 'path';

/**
 * GATE: a ward assignment request is read through ONE rule, `wardReadable` / `wardReadConditions` of `ward-locks.ts`.
 *
 * The shared desk at PC02 (`intake:WardAssignment`) reads only the requests it entered that were never submitted. The
 * general helpers (`recordReadable`, `scopeConditions(…, 'read', 'WardAssignment')`) know nothing of that: one route
 * of the module that asks them directly shows a submitted request (its code, its summary, the reviewer's reasons) to
 * whoever sits at the desk next. So nothing in the module asks them but the rule itself.
 */
const DIR = __dirname;
const RULE = 'ward-locks.ts';

/** The direct reads of one source text: what the gate refuses outside the rule's own file. */
export function directReadsIn(text: string): string[] {
  const found: string[] = [];
  if (/\brecordReadable\s*\(/.test(text)) found.push('recordReadable(');
  for (const call of text.matchAll(/\bscopeConditions\s*\(([^)]*)\)/g)) {
    if (/['"]read['"]/.test(call[1]) && /['"]WardAssignment['"]/.test(call[1])) found.push(`scopeConditions(${call[1].trim()})`);
  }
  for (const call of text.matchAll(/\brecordInScope\s*\(([^;]*?)\)/g)) {
    if (/['"]read['"]/.test(call[1]) && /['"]WardAssignment['"]/.test(call[1])) found.push(`recordInScope(${call[1].trim()})`);
  }
  // Telling people about a request: `readersOf` alone asks the general read reach, the notifier's `readers` adds the rule.
  const told = [...text.matchAll(/\breadersOf\s*\(/g)].length;
  const ruled = [...text.matchAll(/readersOf\(people, 'WardAssignment', reachOf\(row\)\)\.filter\(/g)].length;
  if (told > ruled) found.push(`readersOf( x${told - ruled} without the rule`);
  return found;
}

const sources = fs.readdirSync(DIR).filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'));

describe('GATE: ward requests are read through the one rule of ward-locks.ts', () => {
  it('the detector sees a direct read, and does not take the rule for one (or it would prove nothing)', () => {
    expect(directReadsIn(`if (!recordReadable('WardAssignment', row, scope)) throw 1;`)).toEqual(['recordReadable(']);
    expect(directReadsIn(`const reach = scopeConditions(scope, 'read', 'WardAssignment');`)).toHaveLength(1);
    expect(directReadsIn(`recordInScope(reach, scope, 'read', 'WardAssignment');`)).toHaveLength(1);
    expect(directReadsIn(`return readersOf(people, 'WardAssignment', reachOf(row));`)).toHaveLength(1);
    // Changing and reviewing are other questions; another subject's reach is not this module's rule.
    expect(directReadsIn(`recordInScope(reach, scope, 'write', 'WardAssignment'); scopeConditions(scope, 'read', 'Petition');`)).toEqual([]);
    expect(directReadsIn(`if (!wardReadable(row, scope)) throw 1; const reach = wardReadConditions(scope);`)).toEqual([]);
  });

  it('the module has sources to read, and the rule is among them', () => {
    expect(sources.length).toBeGreaterThan(10);
    expect(sources).toContain(RULE);
    const rule = fs.readFileSync(path.join(DIR, RULE), 'utf-8');
    expect(rule).toContain('export function wardReadable');
    expect(rule).toContain('export function wardReadConditions');
  });

  it.each(sources.filter((name) => name !== RULE))('%s reads no request around the rule', (name) => {
    expect(directReadsIn(fs.readFileSync(path.join(DIR, name), 'utf-8'))).toEqual([]);
  });
});
