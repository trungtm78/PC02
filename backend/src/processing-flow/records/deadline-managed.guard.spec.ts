import { ConflictException } from '@nestjs/common';
import { assertDeadlineNotManaged, assertExtensionNotManaged, DEADLINE_MANAGED_BY_FLOW } from './deadline-managed.guard';
import type { RecordDeadlineWriter } from './record-deadline-writer.service';

const writer = (managed: boolean) => {
  const isManaged = jest.fn().mockResolvedValue(managed);
  return { writer: { isManaged } as unknown as RecordDeadlineWriter, isManaged };
};
const DB = {} as never;
const STORED = new Date('2026-12-31T00:00:00.000Z');

describe('assertDeadlineNotManaged', () => {
  it('refuses a changed deadline of a managed record with the code DEADLINE_MANAGED_BY_FLOW', async () => {
    const { writer: w } = writer(true);
    const attempt = assertDeadlineNotManaged(w, DB, 'CASE', 'c1', new Date('2027-01-31T00:00:00.000Z'), STORED);
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toMatchObject({ response: { code: DEADLINE_MANAGED_BY_FLOW } });
  });

  it('refuses clearing the deadline of a managed record', async () => {
    const { writer: w } = writer(true);
    await expect(assertDeadlineNotManaged(w, DB, 'PETITION', 'p1', null, STORED)).rejects.toBeInstanceOf(ConflictException);
  });

  it('passes an unchanged deadline without even asking the writer (a form sends the old value back with other edits)', async () => {
    const { writer: w, isManaged } = writer(true);
    await expect(assertDeadlineNotManaged(w, DB, 'INCIDENT', 'i1', new Date(STORED), STORED)).resolves.toBeUndefined();
    await expect(assertDeadlineNotManaged(w, DB, 'INCIDENT', 'i1', null, null)).resolves.toBeUndefined();
    expect(isManaged).not.toHaveBeenCalled();
  });

  it('passes a request that does not touch the deadline', async () => {
    const { writer: w, isManaged } = writer(true);
    await expect(assertDeadlineNotManaged(w, DB, 'CASE', 'c1', undefined, STORED)).resolves.toBeUndefined();
    expect(isManaged).not.toHaveBeenCalled();
  });

  it('leaves a record that is not managed alone', async () => {
    const { writer: w, isManaged } = writer(false);
    await expect(assertDeadlineNotManaged(w, DB, 'CASE', 'c1', new Date('2027-01-31T00:00:00.000Z'), STORED)).resolves.toBeUndefined();
    expect(isManaged).toHaveBeenCalledWith(DB, 'CASE', 'c1');
  });

  it('does nothing when no writer is injected (switch off, or a service built by hand)', async () => {
    await expect(assertDeadlineNotManaged(undefined, DB, 'CASE', 'c1', new Date('2027-01-31T00:00:00.000Z'), STORED)).resolves.toBeUndefined();
  });
});

describe('assertExtensionNotManaged', () => {
  it('refuses the extension of a managed record, lets any other pass, and does nothing without a writer', async () => {
    await expect(assertExtensionNotManaged(writer(true).writer, DB, 'INCIDENT', 'i1')).rejects.toMatchObject({ response: { code: DEADLINE_MANAGED_BY_FLOW } });
    await expect(assertExtensionNotManaged(writer(false).writer, DB, 'INCIDENT', 'i1')).resolves.toBeUndefined();
    await expect(assertExtensionNotManaged(undefined, DB, 'INCIDENT', 'i1')).resolves.toBeUndefined();
  });
});
