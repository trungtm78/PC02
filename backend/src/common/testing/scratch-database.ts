import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { takeTurnOnSharedRow } from './shared-row-turn';

/** The scratch databases a database suite may write to. Anything else is refused before the first query. */
const SCRATCH_DATABASES = ['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'];

export interface ScratchDatabase {
  db: PrismaClient;
  /** A plain connection of the suite's own: advisory locks taken on it last until `close`. */
  pg: Client;
  close(): Promise<void>;
}

/** Opens the scratch database of `DYN_REPORTS_DATABASE_URL`, or throws when the URL is not a local scratch one. */
export async function openScratchDatabase(url: string): Promise<ScratchDatabase> {
  const target = new URL(url);
  if (target.hostname !== '127.0.0.1' || !SCRATCH_DATABASES.includes(target.pathname)) {
    throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
  }
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const pg = new Client({ connectionString: url });
  await pg.connect();
  return {
    db,
    pg,
    close: async () => {
      await pg.end();
      await db.$disconnect();
    },
  };
}

/** Later than any real rule: `DeadlineRulesService.getActive` takes the active version that starts last. */
const AFTER_EVERY_REAL_RULE = new Date('2999-01-01T00:00:00.000Z');

/**
 * Gives the suite active deadline rules with values it chose, without touching anybody else's rows.
 *
 * The active version of a rule key is one answer for the whole database, so the suite first takes its turn on it
 * (held until its `pg` connection closes). It then ADDS its own active versions, effective later than any other:
 * they win while they exist. `dropOwnDeadlineRules` deletes them, and the answer is what it was before.
 */
export async function ownActiveDeadlineRules<K extends string>(
  scratch: ScratchDatabase,
  tag: string,
  values: Record<K, number>,
): Promise<Record<K, { id: string; value: number }>> {
  await takeTurnOnSharedRow(scratch.pg, 'deadline-rules');
  const rules = {} as Record<K, { id: string; value: number }>;
  for (const ruleKey of Object.keys(values) as K[]) {
    const row = await scratch.db.deadlineRuleVersion.create({
      data: {
        ruleKey,
        value: values[ruleKey],
        label: `${tag} ${ruleKey}`,
        legalBasis: 'spec',
        documentType: 'Khác',
        documentNumber: tag,
        documentIssuer: 'Khác',
        reason: tag,
        status: 'active',
        effectiveFrom: AFTER_EVERY_REAL_RULE,
        proposedByType: 'SYSTEM',
      },
    });
    rules[ruleKey] = { id: row.id, value: row.value };
  }
  return rules;
}

/** Deletes the rule versions `ownActiveDeadlineRules` created. Records that point at them must be gone first. */
export async function dropOwnDeadlineRules(scratch: ScratchDatabase, tag: string): Promise<void> {
  await scratch.db.deadlineRuleVersion.deleteMany({ where: { reason: tag, documentNumber: tag } });
}
