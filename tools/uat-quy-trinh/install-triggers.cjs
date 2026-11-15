/**
 * `prisma db push` creates tables but no triggers. The application needs some of them (the permission snapshot is
 * re-read only when the trigger `authz_bump` logs a change), so this installs the part after `-- TRIGGER-SECTION` of
 * the migrations that have one, the way `backend/src/common/testing/install-trigger-section.ts` does for the database
 * specs. LOCAL databases only.
 *
 *   E2E_DB=postgresql://postgres:postgres@127.0.0.1:5433/pc02_uat_quy_trinh node tools/uat-quy-trinh/install-triggers.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const BACKEND = path.join(__dirname, '../../backend');
const DB_URL = process.env.E2E_DB;
const MARKER = '-- TRIGGER-SECTION';
const host = (() => { try { return new URL(DB_URL).hostname; } catch { return ''; } })();
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
  console.error('REFUSED: set E2E_DB to a local database.');
  process.exit(2);
}
const { Client } = require(path.join(BACKEND, 'node_modules/pg'));

(async () => {
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();
  const root = path.join(BACKEND, 'prisma/migrations');
  let failed = 0;
  for (const name of fs.readdirSync(root).sort()) {
    const file = path.join(root, name, 'migration.sql');
    if (!fs.existsSync(file)) continue;
    const sql = fs.readFileSync(file, 'utf8');
    const at = sql.indexOf(MARKER);
    if (at < 0) continue;
    try {
      await pg.query(sql.slice(at));
      console.log(`installed  ${name}`);
    } catch (err) {
      failed += 1;
      console.log(`FAILED     ${name}: ${String(err.message).slice(0, 200)}`);
    }
  }
  await pg.end();
  process.exit(failed ? 1 : 0);
})();
