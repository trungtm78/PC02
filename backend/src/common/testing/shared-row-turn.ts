import type { Client } from 'pg';

/** One advisory key per row that several database suites write (pg_advisory_lock, session level). */
const SHARED_ROWS = {
  /** `system_settings.QUYEN_THEO_TO_CHE_DO`: the mode of permissions by team. One row for the whole database. */
  'authz-mode': 7226003,
  /**
   * `deadline_rule_versions` with status `active`: the rule every record created meanwhile takes its deadline from.
   * A suite that adds its own active version changes the answer of `DeadlineRulesService.getActive` for everybody.
   */
  'deadline-rules': 7226004,
  /** `system_settings.CANH_BAO_SAP_HAN`: how many days ahead the daily deadline reminder warns. One row. */
  'deadline-warning-days': 7226005,
  /**
   * `roles` named `ADMIN` and what that role holds: being an administrator goes by the NAME of the role, and a name
   * exists once. A suite that needs an administrator creates the role when the database has none, or gives it
   * permissions, and takes both back.
   */
  'admin-role': 7226006,
  /**
   * `proc_flows`: among the flows in use, a record kind has ONE default flow, and an information type belongs to one
   * flow. A suite that creates default flows or binds types takes the slot every other such suite would need.
   */
  'processing-flows': 7226007,
} as const;

/**
 * Lets a database suite have a row that EVERY suite shares to itself, until its connection closes.
 *
 * Scratch data is normally kept apart by a per-suite tag. A row that exists once for the whole database cannot be:
 * two suites that set it, when run in parallel workers, read each other's value in the middle of a test. Each such
 * suite calls this in `beforeAll` on its own `pg` client; the others wait their turn, and the lock goes away when the
 * suite ends its client in `afterAll` (also when the suite crashes). Under `--runInBand` (CI) nobody ever waits.
 */
export async function takeTurnOnSharedRow(pg: Client, row: keyof typeof SHARED_ROWS): Promise<void> {
  await pg.query('SELECT pg_advisory_lock($1)', [SHARED_ROWS[row]]);
}
