import { ConflictException } from '@nestjs/common';
import { assertDeadlineNotManaged, assertExtensionNotManaged, DEADLINE_MANAGED_BY_FLOW } from './deadline-managed.guard';
import type { RecordDeadlineWriter } from './record-deadline-writer.service';

const writer = (managed: boolean) => {
  const isManaged = jest.fn().mockResolvedValue(managed);
  return { writer: { isManaged } as unknown as RecordDeadlineWriter, isManaged };
};

/** A client whose three record tables answer `findUnique` with the deadline stored right now. */
const dbWith = (stored: Date | null) => {
  const findUnique = jest.fn().mockResolvedValue({ deadline: stored });
  return { db: { petition: { findUnique }, incident: { findUnique }, case: { findUnique } } as never, findUnique };
};

// 23:59:59.999 on 31/12/2026 in Vietnam: what a flow keeps for a deadline "by the end of the day".
const MANAGED = new Date('2026-12-31T16:59:59.999Z');
// What a date-only form sends back for that same day: midnight UTC, 07:00 on 31/12 in Vietnam.
const FORM_SAME_DAY = new Date('2026-12-31T00:00:00.000Z');

describe('assertDeadlineNotManaged', () => {
  it('refuses a different civil day for a managed record with the code DEADLINE_MANAGED_BY_FLOW', async () => {
    const { writer: w } = writer(true);
    const { db } = dbWith(MANAGED);
    const attempt = assertDeadlineNotManaged(w, db, 'CASE', 'c1', new Date('2027-01-31T00:00:00.000Z'));
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toMatchObject({ response: { code: DEADLINE_MANAGED_BY_FLOW } });
  });

  it('refuses clearing the deadline of a managed record', async () => {
    const { writer: w } = writer(true);
    const { db } = dbWith(MANAGED);
    await expect(assertDeadlineNotManaged(w, db, 'PETITION', 'p1', null)).rejects.toBeInstanceOf(ConflictException);
  });

  it('the same civil day with a different instant is SKIP (the screen shows a date, the flow keeps the end of the day)', async () => {
    const { writer: w } = writer(true);
    const { db } = dbWith(MANAGED);
    await expect(assertDeadlineNotManaged(w, db, 'INCIDENT', 'i1', FORM_SAME_DAY)).resolves.toBe('SKIP');
  });

  it('the day before or after the stored one in Vietnam is a different day (the boundary is local midnight)', async () => {
    const { writer: w } = writer(true);
    const { db } = dbWith(MANAGED);
    await expect(assertDeadlineNotManaged(w, db, 'CASE', 'c1', new Date('2026-12-31T17:00:00.000Z'))).rejects.toBeInstanceOf(ConflictException);
    await expect(assertDeadlineNotManaged(w, db, 'CASE', 'c1', new Date('2026-12-30T16:59:59.999Z'))).rejects.toBeInstanceOf(ConflictException);
  });

  it('no deadline on both sides is SKIP', async () => {
    const { writer: w } = writer(true);
    const { db } = dbWith(null);
    await expect(assertDeadlineNotManaged(w, db, 'CASE', 'c1', null)).resolves.toBe('SKIP');
  });

  it('is judged against the deadline stored NOW, read through the given client, not against the caller\'s older snapshot', async () => {
    const { writer: w } = writer(true);
    // The caller read 31/12 earlier; a flow extension has moved the deadline to 15/01 since.
    const { db, findUnique } = dbWith(new Date('2027-01-15T16:59:59.999Z'));
    await expect(assertDeadlineNotManaged(w, db, 'CASE', 'c1', FORM_SAME_DAY)).rejects.toMatchObject({ response: { code: DEADLINE_MANAGED_BY_FLOW } });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'c1' }, select: { deadline: true } });
  });

  it('reads the table of the right kind', async () => {
    const { writer: w } = writer(true);
    const calls: string[] = [];
    const table = (name: string) => ({ findUnique: jest.fn(() => (calls.push(name), Promise.resolve({ deadline: MANAGED }))) });
    const db = { petition: table('petition'), incident: table('incident'), case: table('case') } as never;
    await assertDeadlineNotManaged(w, db, 'PETITION', 'x', FORM_SAME_DAY);
    await assertDeadlineNotManaged(w, db, 'INCIDENT', 'x', FORM_SAME_DAY);
    await assertDeadlineNotManaged(w, db, 'CASE', 'x', FORM_SAME_DAY);
    expect(calls).toEqual(['petition', 'incident', 'case']);
  });

  it('a request that does not touch the deadline is WRITE without asking anything', async () => {
    const { writer: w, isManaged } = writer(true);
    const { db, findUnique } = dbWith(MANAGED);
    await expect(assertDeadlineNotManaged(w, db, 'CASE', 'c1', undefined)).resolves.toBe('WRITE');
    expect(isManaged).not.toHaveBeenCalled();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('a record that is not managed is WRITE and its deadline is not even read', async () => {
    const { writer: w, isManaged } = writer(false);
    const { db, findUnique } = dbWith(MANAGED);
    await expect(assertDeadlineNotManaged(w, db, 'CASE', 'c1', new Date('2027-01-31T00:00:00.000Z'))).resolves.toBe('WRITE');
    expect(isManaged).toHaveBeenCalledWith(db, 'CASE', 'c1');
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('no writer injected (switch off, or a service built by hand) is WRITE', async () => {
    const { db } = dbWith(MANAGED);
    await expect(assertDeadlineNotManaged(undefined, db, 'CASE', 'c1', new Date('2027-01-31T00:00:00.000Z'))).resolves.toBe('WRITE');
  });
});

describe('assertExtensionNotManaged', () => {
  it('refuses the extension of a managed record, lets any other pass, and does nothing without a writer', async () => {
    const db = {} as never;
    await expect(assertExtensionNotManaged(writer(true).writer, db, 'INCIDENT', 'i1')).rejects.toMatchObject({ response: { code: DEADLINE_MANAGED_BY_FLOW } });
    await expect(assertExtensionNotManaged(writer(false).writer, db, 'INCIDENT', 'i1')).resolves.toBeUndefined();
    await expect(assertExtensionNotManaged(undefined, db, 'INCIDENT', 'i1')).resolves.toBeUndefined();
  });
});
