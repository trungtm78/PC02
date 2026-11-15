/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
import { ConflictException } from '@nestjs/common';
import { PetitionsService } from './petitions.service';
import { DEADLINE_MANAGED_BY_FLOW } from '../processing-flow/records/deadline-managed.guard';

/**
 * A record whose flow keeps its deadline takes it from a step: the edit form and the assignment must not write the
 * column. Built by hand with stubs (no database).
 */
const STORED = new Date('2026-12-31T00:00:00.000Z');
const PETITION = { id: 'p-1', deletedAt: null, status: 'MOI_TIEP_NHAN', assignedTeamId: 't1', assignedToId: null, enteredById: 'u1', deadline: STORED, loaiThongTin: null, petitionType: null, huongXuLy: null, metadata: null };

function build(managed: boolean | 'none') {
  const prisma: any = {
    petition: {
      findFirst: jest.fn().mockResolvedValue(PETITION),
      findUnique: jest.fn().mockResolvedValue(PETITION),
      update: jest.fn().mockResolvedValue(PETITION),
    },
    team: { findFirst: jest.fn().mockResolvedValue({ id: 't2' }), findUnique: jest.fn().mockResolvedValue(null) },
    userTeam: { findFirst: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
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
  const service = new PetitionsService(prisma, audit, {} as never, {} as never, {} as never, { emit: jest.fn() } as never, {} as never, {} as never, {} as never, undefined, undefined, writer);
  jest.spyOn(service as any, 'findDuplicateCandidates').mockResolvedValue([]);
  return { service, prisma, isManaged };
}

describe('PetitionsService: the deadline of a record whose flow keeps it', () => {
  it('update: a changed deadline of a managed record is refused with DEADLINE_MANAGED_BY_FLOW and nothing is written', async () => {
    const { service, prisma } = build(true);
    const attempt = service.update('p-1', { deadline: '2027-02-01T00:00:00.000Z' } as never, 'actor');
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toMatchObject({ response: { code: DEADLINE_MANAGED_BY_FLOW } });
    expect(prisma.petition.update).not.toHaveBeenCalled();
  });

  it('update: clearing the deadline of a managed record is refused too', async () => {
    const { service } = build(true);
    await expect(service.update('p-1', { deadline: null } as never, 'actor')).rejects.toMatchObject({ response: { code: DEADLINE_MANAGED_BY_FLOW } });
  });

  it('update: the same deadline sent back with another edit still saves for a managed record', async () => {
    const { service, prisma } = build(true);
    await service.update('p-1', { notes: 'a note', deadline: STORED.toISOString() } as never, 'actor');
    expect(prisma.petition.update).toHaveBeenCalledTimes(1);
  });

  it('update: a record that is not managed keeps the old behaviour (the deadline is written)', async () => {
    const { service, prisma } = build(false);
    await service.update('p-1', { deadline: '2027-02-01T00:00:00.000Z' } as never, 'actor');
    expect(prisma.petition.update.mock.calls[0][0].data.deadline).toEqual(new Date('2027-02-01T00:00:00.000Z'));
  });

  it('update: with no writer injected nothing is asked and the deadline is written', async () => {
    const { service, prisma } = build('none');
    await service.update('p-1', { deadline: '2027-02-01T00:00:00.000Z' } as never, 'actor');
    expect(prisma.petition.update.mock.calls[0][0].data.deadline).toEqual(new Date('2027-02-01T00:00:00.000Z'));
  });

  it('assignPetition: a deadline that differs is refused for a managed record; an assignment without one goes through', async () => {
    const { service, prisma } = build(true);
    await expect(service.assignPetition('p-1', { assignedTeamId: 't2', assignedToId: 'u2', deadline: '2027-02-01T00:00:00.000Z' } as never, 'actor')).rejects.toMatchObject({
      response: { code: DEADLINE_MANAGED_BY_FLOW },
    });
    expect(prisma.petition.update).not.toHaveBeenCalled();
    await service.assignPetition('p-1', { assignedTeamId: 't2', assignedToId: 'u2' } as never, 'actor');
    expect(prisma.petition.update).toHaveBeenCalledTimes(1);
  });
});
