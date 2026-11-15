import { ConflictException } from '@nestjs/common';
import { civilDayOf } from '../engine/civil-day';
import type { RecordKind } from '../gateway/record-snapshot';
import type { RecordDeadlineWriter } from './record-deadline-writer.service';

/** The code of the refusal; the old screens show the message, the new ones translate the code. */
export const DEADLINE_MANAGED_BY_FLOW = 'DEADLINE_MANAGED_BY_FLOW';

/** The old screens do not translate codes, so the message is the text the person reads. */
export const DEADLINE_MANAGED_BY_FLOW_MESSAGE =
  'Hạn của hồ sơ này do quy trình xử lý quản lý, không sửa tay được. Muốn đổi hãy gia hạn bước tương ứng trong tab Phân công xử lý.';

type Db = Parameters<RecordDeadlineWriter['isManaged']>[0];

/**
 * What the caller does with the deadline of its update:
 *   - `WRITE`: the record keeps its own deadline (or the request does not touch it): write it as before;
 *   - `SKIP`: the flow keeps it and the request only sent back what the screen showed: LEAVE THE FIELD OUT of the data
 *     of the update, so that an old form never writes a managed deadline, not even with the same value.
 */
export type DeadlineDecision = 'WRITE' | 'SKIP';

/** Both empty, or both on the same civil day in Vietnam (a form shows a date, not an instant). */
const sameCivilDay = (a: Date | null, b: Date | null): boolean => (a === null || b === null ? a === b : civilDayOf(a) === civilDayOf(b));

/**
 * The deadline stored NOW, read from the client the update will use (inside the same transaction when there is one).
 * The caller's own snapshot of the record may be older than a flow extension that committed since.
 */
async function storedDeadline(db: Db, kind: RecordKind, recordId: string): Promise<Date | null> {
  const select = { deadline: true } as const;
  const where = { id: recordId };
  const row =
    kind === 'PETITION'
      ? await db.petition.findUnique({ where, select })
      : kind === 'INCIDENT'
        ? await db.incident.findUnique({ where, select })
        : await db.case.findUnique({ where, select });
  return row?.deadline ?? null;
}

/**
 * Refuses an old way of typing a deadline (an edit form, an assignment, a legal action) on a record whose flow keeps
 * the deadline (`RecordDeadlineWriter.isManaged`), and says what to do with the field otherwise.
 *
 * `next === undefined` means the request does not touch the deadline. Without a writer (the switch of the flows is
 * off, or a spec that builds the service by hand) and for a record that is not managed the answer is `WRITE`: the
 * behaviour of the old code. For a managed record the request is judged against the deadline stored RIGHT NOW: the
 * same civil day is `SKIP` (a form that shows 2026-12-31 sends back midnight, the flow keeps 23:59:59.999), a different
 * day is refused with a 409.
 */
export async function assertDeadlineNotManaged(
  writer: RecordDeadlineWriter | undefined,
  db: Db,
  kind: RecordKind,
  recordId: string,
  next: Date | null | undefined,
): Promise<DeadlineDecision> {
  if (next === undefined || !writer) return 'WRITE';
  if (!(await writer.isManaged(db, kind, recordId))) return 'WRITE';
  if (sameCivilDay(next, await storedDeadline(db, kind, recordId))) return 'SKIP';
  throw new ConflictException({ code: DEADLINE_MANAGED_BY_FLOW, message: DEADLINE_MANAGED_BY_FLOW_MESSAGE });
}

/** The extension of a deadline (always a change): refused for a managed record, where the step is extended instead. */
export async function assertExtensionNotManaged(writer: RecordDeadlineWriter | undefined, db: Db, kind: RecordKind, recordId: string): Promise<void> {
  if (!writer) return;
  if (await writer.isManaged(db, kind, recordId)) {
    throw new ConflictException({ code: DEADLINE_MANAGED_BY_FLOW, message: DEADLINE_MANAGED_BY_FLOW_MESSAGE });
  }
}
