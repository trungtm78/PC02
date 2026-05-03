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

const SCHEMA_PATH = path.resolve(
  __dirname,
  '..',
  'prisma',
  'schema.prisma',
);
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

// Mirror generator whitelist — keep in sync with scripts/generate-shared-enums.cjs
const SHARED_ENUMS = [
  'CaseStatus',
  'IncidentStatus',
  'PetitionStatus',
  'SubjectType',
  'SubjectStatus',
  'ProposalStatus',
  'GuidanceStatus',
  'ExchangeStatus',
  'DelegationStatus',
  'ConclusionStatus',
  'AccessLevel',
  'ReportTdcStatus',
  'ReportTdcType',
  'TienDoKhacPhuc',
  'LyDoKhongKhoiTo',
  'LyDoTamDinhChiVuAn',
  'KetQuaPhucHoiVuAn',
  'LyDoTamDinhChiVuViec',
  'KetQuaPhucHoiVuViec',
  'LoaiDon',
  'LoaiNguonTin',
  'CapDoToiPham',
  'NotificationType',
  'DocumentType',
];

function parseEnumsFromSchema(source: string): Record<string, string[]> {
  const enumPattern = /enum\s+(\w+)\s*\{([\s\S]*?)\}/g;
  const result: Record<string, string[]> = {};
  let match: RegExpExecArray | null;
  while ((match = enumPattern.exec(source)) !== null) {
    const [, name, body] = match;
    const values: string[] = [];
    for (const rawLine of body.split('\n')) {
      const noComment = rawLine.replace(/\/\/.*/, '').trim();
      if (!noComment || noComment.startsWith('@@')) continue;
      const identMatch = noComment.match(/^([A-Z][A-Z0-9_]*)$/);
      if (identMatch) values.push(identMatch[1]);
    }
    if (values.length > 0) result[name] = values;
  }
  return result;
}

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
      const valueMatch = trimmed.match(/^([A-Z][A-Z0-9_]*):\s*['"]([^'"]+)['"],?$/);
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
    expect(Object.keys(schemaEnums).length).toBeGreaterThanOrEqual(SHARED_ENUMS.length);
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
