import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from 'pg';

const MARKER = '-- TRIGGER-SECTION';
/** One installer at a time, whatever the migration (pg_advisory_lock). */
const INSTALL_LOCK = 7226002;

/**
 * Installs the triggers of a migration into a scratch database, for database specs.
 *
 * The CI scratch schema is built with `prisma db push`, which creates tables but no triggers, so a spec that needs
 * them applies the part of the migration after its `-- TRIGGER-SECTION` marker.
 *
 * Doing that blindly from every spec is harmful when specs run in parallel workers against one database: DROP /
 * CREATE TRIGGER takes an exclusive lock on tables other specs are writing to, and they deadlock. So the triggers
 * are installed ONCE per content: a fingerprint of the SQL is kept as the comment of `markerFunction` (a function
 * that section creates); when it matches, nothing is executed at all.
 */
export async function installTriggerSection(pg: Client, migration: string, markerFunction: string): Promise<void> {
  const sql = readFileSync(join(__dirname, '../../../prisma/migrations', migration, 'migration.sql'), 'utf8');
  const at = sql.indexOf(MARKER);
  if (at < 0) throw new Error(`${migration} lost its TRIGGER-SECTION marker`);
  const section = sql.slice(at);
  const fingerprint = `trigger-section:${createHash('sha256').update(section).digest('hex').slice(0, 32)}`;

  await pg.query('SELECT pg_advisory_lock($1)', [INSTALL_LOCK]);
  try {
    const installed = await pg.query<{ comment: string | null }>(
      `SELECT obj_description(p.oid, 'pg_proc') AS comment
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE p.proname = $1 AND n.nspname = current_schema()`,
      [markerFunction],
    );
    if (installed.rows[0]?.comment === fingerprint) return;
    await pg.query(section);
    // The name comes from the spec itself, never from input; it is quoted as an identifier all the same.
    await pg.query(`COMMENT ON FUNCTION "${markerFunction.replace(/"/g, '""')}"() IS '${fingerprint}'`);
  } finally {
    await pg.query('SELECT pg_advisory_unlock($1)', [INSTALL_LOCK]);
  }
}
