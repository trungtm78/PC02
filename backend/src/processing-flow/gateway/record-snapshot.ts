import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { laGioPhutHopLe } from '../../common/utils/thoi-gian-vn.util';
import { RECORD_KINDS, type CONDITION_KEYS } from '../contract/processing-codes';

/** The three kinds of record a processing flow can be attached to: the list of the shared contract. */
export { RECORD_KINDS };
export type RecordKind = (typeof RECORD_KINDS)[number];
export type ConditionKey = (typeof CONDITION_KEYS)[number];

/**
 * The dates of a record that a deadline can be counted from. `MINUTES_RECEIVED` (the date on the hand-over minutes)
 * exists for a case only. Each is an anchor kind of the shared contract (`contract/processing-codes.ts`), which has
 * one more that is not a date of the record: the completion of the previous step.
 */
export const ANCHOR_KEYS = ['RECEIVED', 'PROPOSED', 'ASSIGNED_TO_UNIT', 'ACCEPTED', 'PROSECUTED', 'MINUTES_RECEIVED'] as const;
export type AnchorKey = (typeof ANCHOR_KEYS)[number];

export interface Anchor {
  /** `null`: the record does not carry this date (or its kind has no column for it). */
  at: Date | null;
  /** `false`: only the calendar day is known; the time of day of `at` means nothing. */
  hasTime: boolean;
}

/**
 * The anchors that can carry a time of day, per record kind: what the adapters fill with `dayWithVietnamTime`. Every
 * other date of a record is a calendar day, on which a duration in hours means nothing. Kept true by
 * `anchors-with-time.spec.ts`, which feeds each adapter a fully filled row.
 */
export const ANCHORS_WITH_TIME: Readonly<Record<RecordKind, readonly AnchorKey[]>> = Object.freeze({
  PETITION: Object.freeze(['RECEIVED'] as const),
  INCIDENT: Object.freeze([] as const),
  CASE: Object.freeze([] as const),
});

/** One record of any kind, reduced to what a processing flow reads. Nothing here is written back. */
export interface RecordSnapshot {
  kind: RecordKind;
  id: string;
  /** The number people see: a petition's `stt`, an incident's `code`, a case's `caseCode`. */
  code: string | null;
  /** "Loại thông tin" exactly as stored (free text; not normalised here). */
  informationType: string | null;
  assignedTeamId: string | null;
  /** The person working the record: the investigator of a case or an incident, the assignee of a petition. */
  ownerUserId: string | null;
  status: string;
  isFinished: boolean;
  isSuspended: boolean;
  deadline: Date | null;
  anchors: Record<AnchorKey, Anchor>;
  /**
   * Facts of the record that pick another duration for a step (`CRIME_GRAVITY` of a case). A fact the record does not
   * carry is absent.
   */
  conditions: Partial<Record<ConditionKey, string>>;
}

/** Who asks to read a record: what the request carries about its user. */
export interface GatewayUser {
  id: string;
  /** The role name, as on the request (`ADMIN` is unrestricted when permissions by team are not enforced). */
  role: string;
  canDispatch?: boolean;
}

/** The client a read runs on: the service itself, or the transaction of the caller. */
export type Reader = PrismaService | Prisma.TransactionClient;

/** What each kind must answer. Read-only: an adapter never writes. */
export interface RecordAdapter {
  readonly kind: RecordKind;
  /** The record that is not deleted, or `null`. */
  load(id: string, tx?: Reader): Promise<RecordSnapshot | null>;
  /** Whether the record's own detail route would show this record to this person. */
  canRead(id: string, user: GatewayUser): Promise<boolean>;
  /**
   * Writes the `deadline` column of the record, and nothing else. The ONE write the gateway does, made only by
   * `RecordDeadlineWriter` for a record whose flow keeps its deadline.
   */
  writeDeadline(id: string, at: Date, tx: Prisma.TransactionClient): Promise<void>;
}

/** A date column that holds a calendar day. */
export function dayAnchor(at: Date | null | undefined): Anchor {
  return { at: at ?? null, hasTime: false };
}

/** A column that does not exist for a kind. */
export const NO_ANCHOR: Anchor = Object.freeze({ at: null, hasTime: false });

const UTC_PLUS_7 = '+07:00';

/**
 * A calendar day plus the time of day an officer declared, as "HH:mm" in Vietnam time (a petition's `receivedDate`
 * and `gioTiepNhan`). The day is stored at 00:00 UTC, so its UTC date IS the declared day. Without a valid time the
 * anchor is the day alone.
 */
export function dayWithVietnamTime(day: Date | null | undefined, time: string | null | undefined): Anchor {
  if (!day) return NO_ANCHOR;
  if (!laGioPhutHopLe(time)) return dayAnchor(day);
  const at = new Date(`${day.toISOString().slice(0, 10)}T${time}:00${UTC_PLUS_7}`);
  return Number.isNaN(at.getTime()) ? dayAnchor(day) : { at, hasTime: true };
}
