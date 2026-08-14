import { Prisma } from '@prisma/client';

/** The Prisma methods this helper needs; keeps callers testable without a DB. */
export interface TransactionalPrisma {
  $transaction<R>(fn: (tx: Prisma.TransactionClient) => Promise<R>): Promise<R>;
}

/** Tables a child record can hang off. Values are real table names. */
export const PARENT_TABLE = {
  case: 'cases',
  incident: 'incidents',
  petition: 'petitions',
} as const;

export type ParentKind = keyof typeof PARENT_TABLE;

/**
 * Run `fn` with the parent row locked for the duration.
 *
 * ND-19: the create paths loaded the parent, checked it was alive and in scope,
 * and then inserted the child in a separate statement. Between the two, the
 * parent can be soft-deleted — and the child lands on a deleted file, where
 * nothing lists it and nothing cascades to it. The window is small and the
 * result is a record that exists in the table and nowhere in the product.
 *
 * `SELECT ... FOR UPDATE` holds the parent until the transaction commits, so a
 * concurrent delete waits and then sees the child, rather than racing past it.
 * The pattern is lifted from `evidences.service.ts` (ADR-0016), which needed it
 * first; this is the same thing with the table as a parameter so the other
 * child services do not each grow their own copy.
 *
 * The lock is taken on the parent, not the child, deliberately: the invariant
 * being protected is "a child never outlives its parent's deletion", and the
 * child does not exist yet at lock time.
 */
export async function withParentLock<T>(
  prisma: TransactionalPrisma,
  kind: ParentKind,
  parentId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const table = PARENT_TABLE[kind];
  return prisma.$transaction(async (tx) => {
    // The table name comes from the frozen map above, never from a caller
    // string, so this cannot be turned into an injection point. The id stays a
    // bound parameter.
    await tx.$queryRawUnsafe(
      `SELECT id FROM "${table}" WHERE id = $1 FOR UPDATE`,
      parentId,
    );
    return fn(tx);
  });
}
