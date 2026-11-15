import { ConflictException } from '@nestjs/common';
import type { RecordKind } from '../gateway/record-snapshot';
import type { RecordDeadlineWriter } from './record-deadline-writer.service';

/** The code of the refusal; the old screens show the message, the new ones translate the code. */
export const DEADLINE_MANAGED_BY_FLOW = 'DEADLINE_MANAGED_BY_FLOW';

/** The old screens do not translate codes, so the message is the text the person reads. */
export const DEADLINE_MANAGED_BY_FLOW_MESSAGE =
  'Hạn của hồ sơ này do quy trình xử lý quản lý, không sửa tay được. Muốn đổi hãy gia hạn bước tương ứng trong tab Phân công xử lý.';

type Db = Parameters<RecordDeadlineWriter['isManaged']>[0];

const sameInstant = (a: Date | null, b: Date | null): boolean => (a === null || b === null ? a === b : a.getTime() === b.getTime());

/**
 * Refuses an old way of typing a deadline (an edit form, an assignment, a legal action) on a record whose flow keeps
 * the deadline (`RecordDeadlineWriter.isManaged`).
 *
 * `next === undefined` means the request does not touch the deadline. A request that sends the value the record already
 * has also passes: a form that sends back the old deadline with other edits must still save. Without a writer (the
 * switch of the flows is off, or a spec that builds the service by hand) nothing is checked, so the behaviour is the
 * one of the old code.
 */
export async function assertDeadlineNotManaged(
  writer: RecordDeadlineWriter | undefined,
  db: Db,
  kind: RecordKind,
  recordId: string,
  next: Date | null | undefined,
  stored: Date | null,
): Promise<void> {
  if (next === undefined || !writer) return;
  if (sameInstant(next, stored ?? null)) return;
  if (await writer.isManaged(db, kind, recordId)) {
    throw new ConflictException({ code: DEADLINE_MANAGED_BY_FLOW, message: DEADLINE_MANAGED_BY_FLOW_MESSAGE });
  }
}

/** The extension of a deadline (always a change): refused for a managed record, where the step is extended instead. */
export async function assertExtensionNotManaged(writer: RecordDeadlineWriter | undefined, db: Db, kind: RecordKind, recordId: string): Promise<void> {
  if (!writer) return;
  if (await writer.isManaged(db, kind, recordId)) {
    throw new ConflictException({ code: DEADLINE_MANAGED_BY_FLOW, message: DEADLINE_MANAGED_BY_FLOW_MESSAGE });
  }
}
