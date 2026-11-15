import { RecordDeadlineWriter } from './record-deadline-writer.service';

/**
 * `managedRecordIds` asks for the SAME thing `isManaged` does, in one query for a whole kind. The behaviour on real rows
 * is covered on PostgreSQL (record-deadline-writer.database.spec.ts); this only pins the shape of the question and the
 * mapping of the answer, with a stub.
 */
describe('RecordDeadlineWriter.managedRecordIds', () => {
  it('asks for the confirmed flows of the kind that have a deadline-setting step with verified legal figures and a deadline, and returns the record ids', async () => {
    const findMany = jest.fn().mockResolvedValue([{ recordId: 'a' }, { recordId: 'b' }]);
    const writer = new RecordDeadlineWriter({ procRecordFlow: { findMany } } as never, {} as never);
    await expect(writer.managedRecordIds('INCIDENT')).resolves.toEqual(['a', 'b']);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        recordKind: 'INCIDENT',
        confirmed: true,
        steps: { some: { regulatoryDueAt: { not: null }, step: { setsRecordDeadline: true, legalVerifiedAt: { not: null } } } },
      },
      select: { recordId: true },
    });
  });

  it('returns an empty list when no record is managed', async () => {
    const writer = new RecordDeadlineWriter({ procRecordFlow: { findMany: jest.fn().mockResolvedValue([]) } } as never, {} as never);
    await expect(writer.managedRecordIds('CASE')).resolves.toEqual([]);
  });
});
