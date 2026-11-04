import { z } from 'zod';
import { findProviderUnsafeParts } from './provider-safe-schema';

const toJson = (schema: z.ZodType) =>
  z.toJSONSchema(schema) as Record<string, unknown>;

describe('findProviderUnsafeParts (schema subset every provider accepts)', () => {
  it('accepts plain objects, arrays, enums, nullable fields and integers', () => {
    const schema = z.strictObject({
      name: z.string(),
      kind: z.enum(['A', 'B']),
      amount: z.number().int().nullable(),
      tags: z.array(z.string()),
      nested: z.strictObject({ ok: z.boolean() }),
    });
    expect(findProviderUnsafeParts(toJson(schema))).toEqual([]);
  });

  it('rejects an optional property: strict structured output needs every property required', () => {
    const schema = z.strictObject({ a: z.string(), b: z.string().optional() });
    expect(findProviderUnsafeParts(toJson(schema))).toEqual([
      '#: property "b" is not required',
    ]);
  });

  it('rejects an object that allows unknown keys', () => {
    const schema = z.looseObject({ a: z.string() });
    expect(findProviderUnsafeParts(toJson(schema)).join('\n')).toContain(
      'additionalProperties',
    );
  });

  it('rejects unions other than "value or null"', () => {
    const schema = z.strictObject({
      v: z.union([
        z.strictObject({ a: z.string() }),
        z.strictObject({ b: z.string() }),
      ]),
    });
    expect(findProviderUnsafeParts(toJson(schema)).join('\n')).toContain(
      'anyOf',
    );
  });

  it('rejects keywords some providers refuse: pattern, format, $ref, recursion', () => {
    const withPattern = z.strictObject({ s: z.string().regex(/^[A-Z]+$/) });
    expect(findProviderUnsafeParts(toJson(withPattern)).join('\n')).toContain(
      'pattern',
    );

    const withFormat = z.strictObject({ s: z.string().email() });
    expect(findProviderUnsafeParts(toJson(withFormat)).join('\n')).toMatch(
      /format|pattern/,
    );

    type Tree = { children: Tree[] };
    const tree: z.ZodType<Tree> = z.strictObject({
      children: z.lazy(() => z.array(tree)),
    });
    expect(findProviderUnsafeParts(toJson(tree)).join('\n')).toContain('$ref');
  });

  it('reports the path of the offending part', () => {
    const schema = z.strictObject({
      deep: z.strictObject({ s: z.string().regex(/x/) }),
    });
    expect(findProviderUnsafeParts(toJson(schema))[0]).toContain(
      '#/properties/deep/properties/s',
    );
  });
});
