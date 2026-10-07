import { canonicalJson, mutationHash } from './case-governance.contract';
describe('CG-R05 canonical business digest', () => {
  it('sorts keys recursively and preserves arrays/null/zero/false without undefined object keys', () => {
    expect(
      canonicalJson({
        z: undefined,
        b: [null, false, 0, { b: 2, a: 1 }],
        a: '',
      }),
    ).toBe('{"a":"","b":[null,false,0,{"a":1,"b":2}]}');
  });
  it('isolates actor, case and operation while excluding retry transport versions', () => {
    const x = {
      caseId: 'c1',
      operation: 'send',
      payload: { b: 2, a: 1 },
      expectedUpdatedAt: 'old',
    };
    const hash = mutationHash(x, 'a1');
    expect(
      mutationHash(
        { ...x, expectedUpdatedAt: 'new', payload: { a: 1, b: 2 } },
        'a1',
      ),
    ).toBe(hash);
    expect(mutationHash({ ...x, caseId: 'c2' }, 'a1')).not.toBe(hash);
    expect(mutationHash({ ...x, operation: 'accept' }, 'a1')).not.toBe(hash);
    expect(mutationHash(x, 'a2')).not.toBe(hash);
  });
  it.each([
    NaN,
    Infinity,
    new Date(),
    new Map(),
    [undefined],
    { f: () => 1 },
    JSON.parse('{"__proto__":{}}'),
    { constructor: 'x' },
    { prototype: 2 },
  ])('rejects unsupported input %p', (value) => {
    expect(() => canonicalJson(value)).toThrow();
  });
  it('rejects cycles and getters without executing code', () => {
    const cycle: any = {};
    cycle.self = cycle;
    expect(() => canonicalJson(cycle)).toThrow();
    let called = false;
    const getter = Object.defineProperty({}, 'x', {
      enumerable: true,
      get() {
        called = true;
        return 1;
      },
    });
    expect(() => canonicalJson(getter)).toThrow();
    expect(called).toBe(false);
  });
});
