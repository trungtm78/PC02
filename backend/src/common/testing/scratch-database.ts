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
    rules[ruleKey] = await activeRule(scratch, tag, ruleKey, values[ruleKey], AFTER_EVERY_REAL_RULE);
  }
  return rules;
}

async function activeRule(scratch: ScratchDatabase, tag: string, ruleKey: string, value: number, effectiveFrom: Date) {
  const row = await scratch.db.deadlineRuleVersion.create({
    data: {
      ruleKey,
      value,
      label: `${tag} ${ruleKey}`,
      legalBasis: 'spec',
      documentType: 'Khác',
      documentNumber: tag,
      documentIssuer: 'Khác',
      reason: tag,
      status: 'active',
      effectiveFrom,
      proposedByType: 'SYSTEM',
    },
  });
  return { id: row.id, value: row.value };
}

/**
 * The rule changes while records exist: one more active version of the suite's own, effective later than the one
 * `ownActiveDeadlineRules` made, so it is the answer from now on. Call only after `ownActiveDeadlineRules` (the turn
 * is already held). `replaced.undo()` deletes it again; records that point at it must be gone first.
 */
export async function replaceOwnDeadlineRule(
  scratch: ScratchDatabase,
  tag: string,
  ruleKey: string,
  value: number,
): Promise<{ id: string; value: number; undo(): Promise<void> }> {
  const laterStill = new Date(AFTER_EVERY_REAL_RULE.getTime() + 86_400_000);
  const rule = await activeRule(scratch, tag, ruleKey, value, laterStill);
  return { ...rule, undo: async () => void (await scratch.db.deadlineRuleVersion.delete({ where: { id: rule.id } })) };
}

/** Deletes the rule versions `ownActiveDeadlineRules` created. Records that point at them must be gone first. */
export async function dropOwnDeadlineRules(scratch: ScratchDatabase, tag: string): Promise<void> {
  await scratch.db.deadlineRuleVersion.deleteMany({ where: { reason: tag, documentNumber: tag } });
}

export interface EnsuredPermissions {
  /** `action:subject` -> id of the permission row. */
  ids: Record<string, string>;
  /** Deletes the rows this call created, and only while nothing refers to them. Rows that were there stay. */
  dropCreated(): Promise<void>;
}

/**
 * The permission rows a suite needs (`permissions` is one table for the whole database, unique by action and
 * subject). Rows that exist are used as they are; missing ones are created and REMEMBERED, so that the suite takes
 * back exactly what it added. Call `dropCreated` after the roles and templates of the suite are gone: a row that
 * something still refers to (another suite picked it up meanwhile) is left in place.
 */
export async function ensurePermissions(scratch: ScratchDatabase, keys: readonly string[]): Promise<EnsuredPermissions> {
  const ids: Record<string, string> = {};
  const created: string[] = [];
  for (const key of keys) {
    const at = key.indexOf(':');
    const where = { action_subject: { action: key.slice(0, at), subject: key.slice(at + 1) } };
    const existing = await scratch.db.permission.findUnique({ where, select: { id: true } });
    if (existing) {
      ids[key] = existing.id;
      continue;
    }
    try {
      const row = await scratch.db.permission.create({ data: where.action_subject, select: { id: true } });
      ids[key] = row.id;
      created.push(row.id);
    } catch (error) {
      // Another suite created the same row between the look and the insert: then it is theirs, not ours.
      if ((error as { code?: string }).code !== 'P2002') throw error;
      ids[key] = (await scratch.db.permission.findUniqueOrThrow({ where, select: { id: true } })).id;
    }
  }
  return {
    ids,
    dropCreated: async () => {
      if (created.length === 0) return;
      await scratch.db.permission.deleteMany({
        where: {
          id: { in: created },
          roles: { none: {} },
          templateEntries: { none: {} },
          teamOverrides: { none: {} },
          userOverrides: { none: {} },
        },
      });
    },
  };
}
