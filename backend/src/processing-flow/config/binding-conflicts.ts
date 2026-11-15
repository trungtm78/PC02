import type { Prisma } from '@prisma/client';
import { LOAI_DANH_MUC_LOAI_THONG_TIN, khoaLoaiThongTin } from '../../common/utils/khoa-loai-thong-tin.util';
import { PROCESSING_ERROR, RECORD_KINDS } from '../contract/processing-codes';
import type { RecordKind } from '../gateway/record-snapshot';

/**
 * The advisory lock every writer of the flows of one record kind takes (the second number is the position of the kind
 * in `RECORD_KINDS`). The two-number form has a key space of its own.
 *
 * It lives here, and not in the service, because whoever changes what an information type MEANS (renaming a catalogue
 * entry) has to take the same lock as whoever binds it: the two decisions are one decision.
 */
export const FLOW_KIND_LOCK = 7_226_010;

export type BindingTx = Prisma.TransactionClient;

export async function lockFlowKind(tx: BindingTx, recordKind: RecordKind): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${FLOW_KIND_LOCK}::int, ${RECORD_KINDS.indexOf(recordKind)}::int)`;
}

export interface BindingConflict {
  directoryId?: string;
  deadlineGroup?: string;
  flowId: string;
  flowName: string;
}

/**
 * The types and groups of `types` / `groups` that a flow in use OTHER THAN `flowId` already holds, for one record kind.
 *
 * A type is the same type when it is the same catalogue entry, when its key is the key another flow bound (the name
 * the entry had when it was bound), or when its key is the key another flow's entry has NOW: a text that merges to
 * one key must reach one flow, whichever way the entries were named and renamed.
 *
 * `types[].typeKey` is the key to compare for each entry: the key it was bound with, else its current key.
 * `currentKeys[directoryId]` is the key of the entry's name today (looked up here when not given).
 */
export async function findBindingConflicts(
  tx: BindingTx,
  recordKind: RecordKind,
  flowId: string | null,
  types: ReadonlyArray<{ directoryId: string; typeKey: string | null }>,
  groups: readonly string[],
): Promise<BindingConflict[]> {
  if (types.length === 0 && groups.length === 0) return [];

  // Today's key of every entry asked for: a rename after binding moves it, and the holder may be matched by it.
  const wanted = await tx.directory.findMany({
    where: { id: { in: types.map((type) => type.directoryId) }, type: LOAI_DANH_MUC_LOAI_THONG_TIN },
    select: { id: true, name: true },
  });
  const nowKeyOf = new Map(wanted.map((entry) => [entry.id, khoaLoaiThongTin(entry.name) || null]));
  const keysOfType = (type: { directoryId: string; typeKey: string | null }): string[] => {
    const keys = [type.typeKey, nowKeyOf.get(type.directoryId) ?? null].filter((key): key is string => key !== null && key !== '');
    return [...new Set(keys)];
  };

  // Every binding of the kind held by another flow in use: a few dozen rows at most. Whether an entry another flow
  // holds reads like one of ours depends on its name TODAY, which only code can merge to a key, so the comparison is
  // made here rather than in a query.
  const others = await tx.procFlowBinding.findMany({
    where: { recordKind, ...(flowId === null ? {} : { flowId: { not: flowId } }), flow: { status: 'ACTIVE' } },
    select: { directoryId: true, typeKey: true, deadlineGroup: true, directory: { select: { name: true } }, flow: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const holdsKey = (other: (typeof others)[number], keys: readonly string[]): boolean => {
    if (other.directoryId === null) return false;
    const heldKeys = [other.typeKey, khoaLoaiThongTin(other.directory?.name) || null].filter((key): key is string => key !== null && key !== '');
    return heldKeys.some((key) => keys.includes(key));
  };

  const conflicts: BindingConflict[] = [];
  for (const type of types) {
    const holder = others.find((other) => other.directoryId === type.directoryId || holdsKey(other, keysOfType(type)));
    if (holder) conflicts.push({ directoryId: type.directoryId, flowId: holder.flow.id, flowName: holder.flow.name });
  }
  for (const group of groups) {
    const holder = others.find((other) => other.deadlineGroup === group);
    if (holder) conflicts.push({ deadlineGroup: group, flowId: holder.flow.id, flowName: holder.flow.name });
  }
  return conflicts;
}

/**
 * What renaming a catalogue entry may do to the flows: its NEW name must not make it read like an entry another flow
 * holds. Called by the catalogue, in its transaction, after `lockFlowKind` for every record kind the entry is bound
 * for. Refuses with the same code and details as binding it would (`TYPE_ALREADY_BOUND`).
 */
export async function assertRenameKeepsBindingsApart(tx: BindingTx, directoryId: string, newName: string): Promise<BindingConflictRefusal | null> {
  const mine = await tx.procFlowBinding.findMany({
    where: { directoryId, flow: { status: 'ACTIVE' } },
    select: { recordKind: true, flowId: true },
  });
  for (const { recordKind, flowId } of mine) {
    // The entry as it WOULD be named: its stored key stays what it was, its current key becomes the new name's.
    const conflicts = await findBindingConflictsForName(tx, recordKind, flowId, directoryId, newName);
    if (conflicts.length > 0) return { code: PROCESSING_ERROR.TYPE_ALREADY_BOUND, details: conflicts };
  }
  return null;
}

export interface BindingConflictRefusal {
  code: typeof PROCESSING_ERROR.TYPE_ALREADY_BOUND;
  details: BindingConflict[];
}

async function findBindingConflictsForName(tx: BindingTx, recordKind: RecordKind, flowId: string, directoryId: string, newName: string): Promise<BindingConflict[]> {
  const newKey = khoaLoaiThongTin(newName) || null;
  if (newKey === null) return [];
  const others = await tx.procFlowBinding.findMany({
    where: { recordKind, flowId: { not: flowId }, flow: { status: 'ACTIVE' }, directoryId: { not: null } },
    select: { directoryId: true, typeKey: true, directory: { select: { name: true } }, flow: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const holder = others.find((other) => {
    if (other.directoryId === directoryId) return true;
    const heldKeys = [other.typeKey, khoaLoaiThongTin(other.directory?.name) || null].filter((key): key is string => key !== null && key !== '');
    return heldKeys.includes(newKey);
  });
  return holder ? [{ directoryId, flowId: holder.flow.id, flowName: holder.flow.name }] : [];
}
