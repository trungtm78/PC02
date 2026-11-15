/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
import { ConflictException } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { DEADLINE_MANAGED_BY_FLOW } from '../processing-flow/records/deadline-managed.guard';

/**
 * A record whose flow keeps its deadline takes it from a step: the edit form, the assignment and the old "gia han"
 * route must not write the column. Built by hand with stubs (no database): the tests of the old behaviour are in
 * incidents.service.spec.ts, which builds the service without a writer.
 */
// 23:59:59.999 on 31/12/2026 in Vietnam, kept by the flow.
const STORED = new Date('2026-12-31T16:59:59.999Z');
const SAME_DAY_FROM_FORM = '2026-12-31T00:00:00.000Z';
const INCIDENT = { id: 'inc-1', deletedAt: null, status: 'TIEP_NHAN', intakeStage: null, assignedTeamId: null, investigatorId: null, soLanGiaHan: 0, deadline: STORED, updatedAt: new Date('2026-01-01') };

function build(managed: boolean | 'none') {
  const prisma: any = {
    incident: {
      findFirst: jest.fn().mockResolvedValue(INCIDENT),
      findUnique: jest.fn().mockResolvedValue(INCIDENT),
      update: jest.fn().mockResolvedValue({ ...INCIDENT }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ firstName: 'A', lastName: 'B' }) },
  };
  const audit: any = {
    log: jest.fn().mockResolvedValue(undefined),
    wrapUpdate: jest.fn(async (o: any) => {
      await o.fetchFn();
      return o.updateFn();
    }),
  };
  const isManaged = jest.fn().mockResolvedValue(managed === true);
  const writer = managed === 'none' ? undefined : ({ isManaged } as never);
  const deadlineRules: any = {
    getActive: jest.fn().mockResolvedValue({ id: 'rule', value: 60 }),
    getActiveValue: jest.fn().mockResolvedValue(2),
  };
  const service = new IncidentsService(prisma, audit, {} as never, deadlineRules, {} as never, { emit: jest.fn() } as never, {} as never, {} as never, undefined, undefined, writer);
  jest.spyOn(service as any, 'findDuplicateCandidates').mockResolvedValue([]);
  return { service, prisma, isManaged };
}
const written = (prisma: any) => prisma.incident.update.mock.calls[0][0].data;

describe('IncidentsService: the deadline of a record whose flow keeps it', () => {
  it('update: a different day for a managed record is refused with DEADLINE_MANAGED_BY_FLOW and nothing is written', async () => {
    const { service, prisma } = build(true);
    const attempt = service.update('inc-1', { deadline: '2027-02-01T00:00:00.000Z' } as never, 'actor');
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toMatchObject({ response: { code: DEADLINE_MANAGED_BY_FLOW } });
    expect(prisma.incident.update).not.toHaveBeenCalled();
  });

  it('update: the same civil day with a different instant saves the other edits and leaves the deadline OUT of the data', async () => {
    const { service, prisma } = build(true);
    await service.update('inc-1', { name: 'Renamed', deadline: SAME_DAY_FROM_FORM } as never, 'actor');
    expect(prisma.incident.update).toHaveBeenCalledTimes(1);
    expect(written(prisma).name).toBe('Renamed');
    expect(written(prisma)).not.toHaveProperty('deadline');
  });

  it('update: judged against the deadline stored now, not the snapshot read earlier (a flow extension in between)', async () => {
    const { service, prisma } = build(true);
    // The snapshot (findFirst) still says 31/12; the guard reads 15/01 fresh.
    prisma.incident.findUnique.mockResolvedValueOnce({ deadline: new Date('2027-01-15T16:59:59.999Z') });
    await expect(service.update('inc-1', { deadline: SAME_DAY_FROM_FORM } as never, 'actor')).rejects.toMatchObject({ response: { code: DEADLINE_MANAGED_BY_FLOW } });
    expect(prisma.incident.update).not.toHaveBeenCalled();
  });

  it('update: a record that is not managed keeps the old behaviour (the deadline is written)', async () => {
    const { service, prisma } = build(false);
    await service.update('inc-1', { deadline: '2027-02-01T00:00:00.000Z' } as never, 'actor');
    expect(written(prisma).deadline).toEqual(new Date('2027-02-01T00:00:00.000Z'));
  });

  it('update: with no writer injected nothing is asked and the deadline is written', async () => {
    const { service, prisma } = build('none');
    await service.update('inc-1', { deadline: '2027-02-01T00:00:00.000Z' } as never, 'actor');
    expect(written(prisma).deadline).toEqual(new Date('2027-02-01T00:00:00.000Z'));
  });

  it('extendDeadline: refused for a managed record (it is extended on its step), nothing is written', async () => {
    const { service, prisma } = build(true);
    await expect(service.extendDeadline('inc-1', 'actor')).rejects.toMatchObject({ response: { code: DEADLINE_MANAGED_BY_FLOW } });
    expect(prisma.incident.updateMany).not.toHaveBeenCalled();
  });

  it('extendDeadline: a record that is not managed is extended as before', async () => {
    const { service, prisma } = build(false);
    await service.extendDeadline('inc-1', 'actor');
    expect(prisma.incident.updateMany).toHaveBeenCalledTimes(1);
  });

  it('assignInvestigator: a different day is refused for a managed record; the same day or none leaves the deadline out of the data', async () => {
    const { service, prisma } = build(true);
    await expect(service.assignInvestigator('inc-1', { deadline: '2027-02-01T00:00:00.000Z' } as never, 'actor')).rejects.toMatchObject({
      response: { code: DEADLINE_MANAGED_BY_FLOW },
    });
    expect(prisma.incident.update).not.toHaveBeenCalled();
    await service.assignInvestigator('inc-1', { deadline: SAME_DAY_FROM_FORM } as never, 'actor');
    expect(written(prisma)).not.toHaveProperty('deadline');
    prisma.incident.update.mockClear();
    await service.assignInvestigator('inc-1', {} as never, 'actor');
    expect(written(prisma)).not.toHaveProperty('deadline');
  });

  it('assignInvestigator: a record that is not managed still gets the deadline of the request', async () => {
    const { service, prisma } = build(false);
    await service.assignInvestigator('inc-1', { deadline: '2027-02-01T00:00:00.000Z' } as never, 'actor');
    expect(written(prisma).deadline).toEqual(new Date('2027-02-01T00:00:00.000Z'));
  });
});
