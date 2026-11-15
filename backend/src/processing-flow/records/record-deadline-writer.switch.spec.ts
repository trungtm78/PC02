import { RecordDeadlineWriter, RECORDS_SWITCH } from './record-deadline-writer.service';
import { assertDeadlineNotManaged } from './deadline-managed.guard';

/**
 * While the records switch `processing_flow_records` is OFF the old ways of typing a deadline work again, although flows
 * may still exist in the database. The writer reads the switch OUTSIDE transactions (init and a tick) and answers from
 * what it read: it never asks the flag service from inside the transaction of a record.
 */
const MANAGED_FLOW = { confirmed: true, steps: [{ regulatoryDueAt: new Date('2026-12-31T16:59:59.999Z'), step: { legalVerifiedAt: new Date('2026-01-01') } }] };

function build(flags?: { isEnabled: jest.Mock }) {
  const procRecordFlow = { findUnique: jest.fn().mockResolvedValue(MANAGED_FLOW), findMany: jest.fn().mockResolvedValue([{ recordId: 'a' }]) };
  const db = { procRecordFlow, case: { findUnique: jest.fn().mockResolvedValue({ deadline: MANAGED_FLOW.steps[0].regulatoryDueAt }) } };
  const writer = new RecordDeadlineWriter(db as never, {} as never, flags as never);
  return { writer, db, procRecordFlow };
}

describe('RecordDeadlineWriter and the records switch', () => {
  it('OFF: isManaged is false without even reading the flow, managedRecordIds is empty, and the guard answers WRITE', async () => {
    const flags = { isEnabled: jest.fn().mockResolvedValue(false) };
    const { writer, db, procRecordFlow } = build(flags);
    await writer.onModuleInit();
    expect(flags.isEnabled).toHaveBeenCalledWith(RECORDS_SWITCH);
    await expect(writer.isManaged(db as never, 'CASE', 'c1')).resolves.toBe(false);
    await expect(writer.managedRecordIds('CASE')).resolves.toEqual([]);
    expect(procRecordFlow.findUnique).not.toHaveBeenCalled();
    expect(procRecordFlow.findMany).not.toHaveBeenCalled();
    await expect(assertDeadlineNotManaged(writer, db as never, 'CASE', 'c1', new Date('2027-02-01T00:00:00.000Z'))).resolves.toBe('WRITE');
  });

  it('ON: as before (a confirmed, verified flow with a deadline is managed; a different day is refused)', async () => {
    const flags = { isEnabled: jest.fn().mockResolvedValue(true) };
    const { writer, db } = build(flags);
    await writer.onModuleInit();
    await expect(writer.isManaged(db as never, 'CASE', 'c1')).resolves.toBe(true);
    await expect(writer.managedRecordIds('CASE')).resolves.toEqual(['a']);
    await expect(assertDeadlineNotManaged(writer, db as never, 'CASE', 'c1', new Date('2027-02-01T00:00:00.000Z'))).rejects.toMatchObject({ response: { code: 'DEADLINE_MANAGED_BY_FLOW' } });
  });

  it('the answer follows the switch only after it is read again, and never asks the flag service by itself', async () => {
    const flags = { isEnabled: jest.fn().mockResolvedValue(false) };
    const { writer, db } = build(flags);
    await writer.onModuleInit();
    flags.isEnabled.mockResolvedValue(true);
    const callsAfterInit = flags.isEnabled.mock.calls.length;
    await expect(writer.isManaged(db as never, 'CASE', 'c1')).resolves.toBe(false);
    expect(flags.isEnabled).toHaveBeenCalledTimes(callsAfterInit);
    await expect(writer.refreshSwitch()).resolves.toBe(true);
    await expect(writer.isManaged(db as never, 'CASE', 'c1')).resolves.toBe(true);
    flags.isEnabled.mockResolvedValue(false);
    await writer.tick();
    await expect(writer.isManaged(db as never, 'CASE', 'c1')).resolves.toBe(false);
  });

  it('a failed read keeps what was known; a failed read at start leaves the switch ON', async () => {
    const flags = { isEnabled: jest.fn().mockRejectedValue(new Error('db down')) };
    const { writer, db } = build(flags);
    await expect(writer.onModuleInit()).resolves.toBeUndefined();
    await expect(writer.tick()).resolves.toBeUndefined();
    await expect(writer.isManaged(db as never, 'CASE', 'c1')).resolves.toBe(true);
  });

  it('without a flag service the switch counts as ON (specs that build the writer with two arguments)', async () => {
    const { writer, db } = build(undefined);
    await writer.onModuleInit();
    await expect(writer.isManaged(db as never, 'CASE', 'c1')).resolves.toBe(true);
    await expect(writer.refreshSwitch()).resolves.toBe(true);
  });
});
