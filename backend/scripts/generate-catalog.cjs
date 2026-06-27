#!/usr/bin/env node
/**
 * Sinh catalog FE từ backend/src/catalog/catalog.registry.ts (single source).
 *
 * Dùng ts-node để require registry .ts (file thuần data, không import Nest/Prisma)
 * → đọc CATALOG_REGISTRY trực tiếp, tránh parse regex mong manh.
 *
 * Output: frontend/src/shared/catalog/catalog.generated.ts
 *   - CATALOG_LEGAL: { [key]: {code,label}[] }  (chỉ nhóm legal)
 *   - CATALOG_DYNAMIC_KEYS: string[]
 *   - CATALOG_META: { [key]: { kind, multi, cascade? } }
 *
 * Run: npm run gen:catalog
 */
const fs = require('fs');
const path = require('path');

require('ts-node').register({
  transpileOnly: true,
  skipProject: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node', target: 'es2019' },
});

const REGISTRY_PATH = path.resolve(__dirname, '..', 'src', 'catalog', 'catalog.registry.ts');
const OUT_PATH = path.resolve(
  __dirname, '..', '..', 'frontend', 'src', 'shared', 'catalog', 'catalog.generated.ts',
);

const { CATALOG_REGISTRY } = require(REGISTRY_PATH);

const legal = {};
const dynamicKeys = [];
const meta = {};
for (const [key, e] of Object.entries(CATALOG_REGISTRY)) {
  meta[key] = { kind: e.kind, multi: !!e.multi, ...(e.cascade ? { cascade: e.cascade } : {}) };
  if (e.kind === 'legal') legal[key] = e.values;
  else dynamicKeys.push(key);
}

const banner = `// AUTO-GENERATED bởi backend/scripts/generate-catalog.cjs — KHÔNG sửa tay.\n// Nguồn: backend/src/catalog/catalog.registry.ts. Chạy lại: npm run gen:catalog\n`;
const body =
  `export type CatalogOption = { code: string; label: string };\n\n` +
  `export const CATALOG_LEGAL = ${JSON.stringify(legal, null, 2)} as const;\n\n` +
  `export const CATALOG_DYNAMIC_KEYS = ${JSON.stringify(dynamicKeys)} as const;\n\n` +
  `export const CATALOG_META = ${JSON.stringify(meta, null, 2)} as const;\n`;

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, banner + '\n' + body, 'utf8');
console.log(`[gen:catalog] wrote ${OUT_PATH} (${Object.keys(legal).length} legal, ${dynamicKeys.length} dynamic)`);
