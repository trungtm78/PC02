import type { PrismaService } from '../prisma/prisma.service';

/** Anything that can run raw queries: the client itself, or a transaction. */
export interface RawDb {
  $queryRaw: PrismaService['$queryRaw'];
  $queryRawUnsafe: PrismaService['$queryRawUnsafe'];
}

export interface TeamReference {
  table: string;
  column: string;
}

/** Quote an identifier taken from the database catalogue. Values are never interpolated, only identifiers. */
export const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Every table and column that holds a foreign key to `teams`, read from the database catalogue instead of a list kept
 * by hand: a relation added later (a permission table, a report table) is covered the day it is created, by delete and
 * by merge alike.
 */
export async function listTeamReferences(db: RawDb): Promise<TeamReference[]> {
  const rows = await db.$queryRaw<{ table_name: string; column_name: string }[]>`
    SELECT c.conrelid::regclass::text AS table_name, a.attname AS column_name
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND c.confrelid = 'teams'::regclass
    ORDER BY 1, 2`;
  // `regclass::text` quotes a name only when it has to; normalise to the bare name.
  return rows.map((r) => ({ table: r.table_name.replace(/^"|"$/g, '').replace(/""/g, '"'), column: r.column_name }));
}

/**
 * References that are the team's OWN SETTINGS, not somebody's data: they go with the team when it is deleted (the
 * foreign key cascades) and stay with it when it is merged. A team that only has these is still an empty team.
 */
export const TEAM_OWN_SETTINGS: ReadonlySet<string> = new Set(['team_permission_configs.teamId']);
export const isTeamOwnSetting = (ref: TeamReference): boolean => TEAM_OWN_SETTINGS.has(`${ref.table}.${ref.column}`);
