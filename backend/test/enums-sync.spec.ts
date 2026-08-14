/**
 * Sync guard: the frontend's generated enum file MUST match the Prisma schema.
 *
 * Strategy: re-parse `schema.prisma` ourselves with the same regex the
 * generator uses, then assert every shared enum's values are present (in order)
 * in `frontend/src/shared/enums/generated.ts`. Drift here = generator is stale
 * = build failure on next deploy. CI catches it before merge.
 */

import * as fs from 'fs';
import * as path from 'path';

const SCHEMA_PATH = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
const FRONTEND_GENERATED = path.resolve(
  __dirname,
  '..',
  '..',
  'frontend',
  'src',
  'shared',
  'enums',
  'generated.ts',
);

// Imported, not copied. A hand-mirrored copy drifted once already: DocumentType
// stayed in this list after migration 20260627000001 turned it into a dynamic
// catalog, and nothing caught it because jest never picked this file up
// (rootDir was "src"). Sharing the generator's list makes that impossible.

import {
  SHARED_ENUMS,
  parseEnums as parseEnumsFromSchema,
} from '../scripts/generate-shared-enums.cjs';

function parseEnumsFromGenerated(source: string): Record<string, string[]> {
  // Match: export const Name = { K: 'V', ... } as const;
  const pattern = /export const (\w+) = \{([\s\S]*?)\} as const;/g;
  const result: Record<string, string[]> = {};
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const [, name, body] = match;
    const values: string[] = [];
    for (const rawLine of body.split('\n')) {
      const trimmed = rawLine.trim();
      // Both cases: the generator emits UPPER_CASE for most enums but keeps
      // lowercase for status-style ones (DeadlineRuleStatus). An UPPER-only
      // pattern parsed those as empty and reported them as missing.
      const valueMatch = trimmed.match(
        /^([A-Za-z][A-Za-z0-9_]*):\s*['"]([^'"]+)['"],?$/,
      );
      if (valueMatch) {
        const [, key, value] = valueMatch;
        if (key !== value) {
          throw new Error(
            `${name}.${key} = '${value}' — key and value must match in generated.ts`,
          );
        }
        values.push(value);
      }
    }
    if (values.length > 0) result[name] = values;
  }
  return result;
}

describe('Shared enums sync — frontend generated.ts ↔ schema.prisma', () => {
  let schemaEnums: Record<string, string[]>;
  let generatedEnums: Record<string, string[]>;

  beforeAll(() => {
    schemaEnums = parseEnumsFromSchema(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    generatedEnums = parseEnumsFromGenerated(
      fs.readFileSync(FRONTEND_GENERATED, 'utf8'),
    );
  });

  it('parses schema.prisma without throwing', () => {
    expect(Object.keys(schemaEnums).length).toBeGreaterThanOrEqual(
      SHARED_ENUMS.length,
    );
  });

  it('frontend generated.ts has every whitelisted enum', () => {
    for (const enumName of SHARED_ENUMS) {
      expect(generatedEnums[enumName]).toBeDefined();
    }
  });

  describe.each(SHARED_ENUMS)('%s', (enumName) => {
    it('values match schema.prisma exactly (same set, same order)', () => {
      const schemaValues = schemaEnums[enumName];
      const generatedValues = generatedEnums[enumName];
      expect(schemaValues).toBeDefined();
      expect(generatedValues).toBeDefined();
      expect(generatedValues).toEqual(schemaValues);
    });
  });

  it('generated.ts has the AUTO-GENERATED header', () => {
    const content = fs.readFileSync(FRONTEND_GENERATED, 'utf8');
    expect(content).toMatch(/AUTO-GENERATED — DO NOT EDIT/);
  });

  it('generated.ts uses LF line endings (not CRLF)', () => {
    const content = fs.readFileSync(FRONTEND_GENERATED, 'utf8');
    expect(content.includes('\r\n')).toBe(false);
  });
});
