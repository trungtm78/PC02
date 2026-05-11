#!/usr/bin/env node
/**
 * Generate shared enum constants for the React frontend by parsing
 * backend/prisma/schema.prisma with a regex.
 *
 * Why regex (not @prisma/internals): keeps the script dependency-free,
 * survives Prisma minor-version DMMF schema renames, and works on Render
 * deploys without ts-node.
 *
 * Output:
 *   frontend/src/shared/enums/generated.ts  — plain `as const` object literals
 *
 * The backend imports enum values directly from `@prisma/client` and does
 * NOT need a generated file (Prisma client already exposes them at runtime).
 *
 * Run: npm run gen:enums
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
const FRONTEND_OUT = path.resolve(
  __dirname,
  '..',
  '..',
  'frontend',
  'src',
  'shared',
  'enums',
  'generated.ts',
);

// Whitelist of enums to share with the frontend. Excludes infrastructure-only
// enums (AccessLevel) and rarely-displayed enums to keep the bundle small.
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
  'DeadlineRuleStatus',
];

function parseEnums(schemaSource) {
  // Match: enum Name { value1 value2 ... }
  const enumPattern = /enum\s+(\w+)\s*\{([\s\S]*?)\}/g;
  const result = {};
  let match;
  while ((match = enumPattern.exec(schemaSource)) !== null) {
    const [, name, body] = match;
    const values = [];
    for (const rawLine of body.split('\n')) {
      // Strip line comments
      const noComment = rawLine.replace(/\/\/.*/, '').trim();
      if (!noComment) continue;
      // Skip Prisma directives (@@map, @@index, etc.)
      if (noComment.startsWith('@@')) continue;
      // Match a single identifier — Prisma enum values are bare identifiers.
      // Allow both UPPER_CASE and lowercase (lowercase used by status-style enums
      // like DeadlineRuleStatus where Vietnamese labels are mapped via status-labels.ts).
      const identMatch = noComment.match(/^([A-Za-z][A-Za-z0-9_]*)$/);
      if (identMatch) {
        values.push(identMatch[1]);
      }
    }
    if (values.length > 0) result[name] = values;
  }
  return result;
}

function renderEnumConst(name, values) {
  const entries = values.map((v) => `  ${v}: '${v}',`).join('\n');
  return `export const ${name} = {\n${entries}\n} as const;\nexport type ${name} = (typeof ${name})[keyof typeof ${name}];\n`;
}

function main() {
  const schemaSource = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const allEnums = parseEnums(schemaSource);

  const missing = SHARED_ENUMS.filter((n) => !(n in allEnums));
  if (missing.length > 0) {
    throw new Error(
      `Whitelisted enums missing in schema.prisma: ${missing.join(', ')}`,
    );
  }

  const header = [
    '// ──────────────────────────────────────────────────────────────',
    '// AUTO-GENERATED — DO NOT EDIT.',
    '// Source: backend/prisma/schema.prisma',
    '// Run: cd backend && npm run gen:enums',
    '// ──────────────────────────────────────────────────────────────',
    '',
  ].join('\n');

  const body = SHARED_ENUMS.map((name) => renderEnumConst(name, allEnums[name])).join('\n');

  // Force LF line endings — Windows dev + Linux CI must agree on diffs
  const output = (header + '\n' + body).replace(/\r\n/g, '\n');

  fs.mkdirSync(path.dirname(FRONTEND_OUT), { recursive: true });
  fs.writeFileSync(FRONTEND_OUT, output, { encoding: 'utf8' });

  console.log(
    `Generated ${SHARED_ENUMS.length} enum(s) → ${path.relative(process.cwd(), FRONTEND_OUT)}`,
  );
}

main();
