import { ConflictException, NotFoundException } from '@nestjs/common';
import { TeamLifecycleService } from './team-lifecycle.service';

type Status = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

function build(current: Status | null) {
  const prisma = {
    team: {
      findUnique: jest.fn().mockResolvedValue(
        current === null ? null : { id: 't1', name: 'Team 1', status: current },
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 't1', name: 'Team 1', ...data }),
      ),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new TeamLifecycleService(prisma as never, audit as never);
  return { service, prisma, audit };
}

describe('TeamLifecycleService', () => {
  describe('allowed transitions', () => {
    it.each([
      ['ACTIVE', 'INACTIVE', 'TEAM_DEACTIVATED'],
      ['ACTIVE', 'ARCHIVED', 'TEAM_ARCHIVED'],
      ['INACTIVE', 'ACTIVE', 'TEAM_ACTIVATED'],
      ['INACTIVE', 'ARCHIVED', 'TEAM_ARCHIVED'],
      ['ARCHIVED', 'ACTIVE', 'TEAM_RESTORED'],
    ] as const)('%s -> %s is written and audited as %s', async (from, to, action) => {
      const { service, prisma, audit } = build(from);

      await service.setStatus('t1', to, 'actor1');

      expect(prisma.team.update).toHaveBeenCalledTimes(1);
      expect(prisma.team.update.mock.calls[0][0].data.status).toBe(to);
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'actor1',
          action,
          subject: 'Team',
          subjectId: 't1',
          metadata: expect.objectContaining({ from, to }),
        }),
      );
    });

    it('archiving stamps who and when; leaving the archive clears both', async () => {
      const archive = build('ACTIVE');
      await archive.service.setStatus('t1', 'ARCHIVED', 'actor1');
      const archived = archive.prisma.team.update.mock.calls[0][0].data;
      expect(archived.archivedById).toBe('actor1');
      expect(archived.archivedAt).toBeInstanceOf(Date);

      const restore = build('ARCHIVED');
      await restore.service.setStatus('t1', 'ACTIVE', 'actor1');
      const restored = restore.prisma.team.update.mock.calls[0][0].data;
      expect(restored.archivedById).toBeNull();
      expect(restored.archivedAt).toBeNull();
    });

    it('never writes isActive itself: the database keeps it in step with the status', async () => {
      const { service, prisma } = build('ACTIVE');
      await service.setStatus('t1', 'INACTIVE', 'actor1');
      expect(prisma.team.update.mock.calls[0][0].data).not.toHaveProperty('isActive');
    });
  });

  describe('rejected requests', () => {
    it('an archived team cannot be paused: it must be restored first', async () => {
      const { service, prisma } = build('ARCHIVED');
      await expect(service.setStatus('t1', 'INACTIVE', 'actor1')).rejects.toMatchObject({
        response: { code: 'TEAM_INVALID_TRANSITION' },
      });
      expect(prisma.team.update).not.toHaveBeenCalled();
    });

    it('rejects with a 409 carrying a machine code, not a sentence', async () => {
      const { service } = build('ARCHIVED');
      await expect(service.setStatus('t1', 'INACTIVE', 'actor1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('asking for the state it already has changes nothing and writes no audit row', async () => {
      const { service, prisma, audit } = build('INACTIVE');
      const result = await service.setStatus('t1', 'INACTIVE', 'actor1');
      expect(result).toMatchObject({ id: 't1', status: 'INACTIVE' });
      expect(prisma.team.update).not.toHaveBeenCalled();
      expect(audit.log).not.toHaveBeenCalled();
    });

    it('an unknown team is a 404', async () => {
      const { service } = build(null);
      await expect(service.setStatus('missing', 'INACTIVE', 'actor1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects a status that is not one of the three', async () => {
      const { service } = build('ACTIVE');
      await expect(service.setStatus('t1', 'DELETED' as never, 'actor1')).rejects.toMatchObject({
        response: { code: 'TEAM_STATUS_UNKNOWN' },
      });
    });
  });
});
