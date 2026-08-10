import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EditWindowService } from './edit-window.service';

/**
 * D3. The detail screen had no way to know whether a record was still editable,
 * so the officer found out by pressing Save and being refused.
 *
 * The team check is the load-bearing part. Without it this endpoint is a way to
 * read another unit's `createdAt`: guess an id, read `hoursElapsed`, subtract.
 * It is the same check `createResetRequest` already makes.
 */
function makeService(over: Record<string, unknown> = {}) {
  const prisma: any = {
    userTeam: {
      findMany: jest.fn(() => Promise.resolve([{ teamId: 'team-a' }])),
    },
    case: {
      findUnique: jest.fn(() =>
        Promise.resolve({
          createdAt: new Date(Date.now() - 10 * 3_600_000),
          assignedTeamId: 'team-a',
          assignedTeam: { wardId: 'ward-1', editWindowHours: 168 },
        }),
      ),
    },
    incident: { findUnique: jest.fn() },
    petition: { findUnique: jest.fn() },
    editWindowResetRequest: { findFirst: jest.fn(() => Promise.resolve(null)) },
    // `getEditWindow` looks the team up for a per-team override before falling
    // back to the global setting.
    team: {
      findUnique: jest.fn(() => Promise.resolve({ editWindowHours: 168 })),
    },
    ...over,
  };
  const svc = Object.create(EditWindowService.prototype) as EditWindowService;
  (svc as any).prisma = prisma;
  (svc as any).settings = {
    getNumericValue: jest.fn(() => Promise.resolve(168)),
  };
  (svc as any).getSubjectAssignedTeamId = jest.fn(() =>
    Promise.resolve('team-a'),
  );
  return { svc, prisma };
}

describe('getStatus', () => {
  it('reports how long is left while the window is open', async () => {
    const { svc } = makeService();

    const res = await svc.getStatus('u-1', 'Case', 'c-1');

    expect(res.locked).toBe(false);
    expect(res.windowHours).toBe(168);
    expect(res.hoursRemaining).toBeGreaterThan(0);
  });

  it('reports locked once the window has passed', async () => {
    const { svc } = makeService({
      case: {
        findUnique: jest.fn(() =>
          Promise.resolve({
            createdAt: new Date(Date.now() - 400 * 3_600_000),
            assignedTeamId: 'team-a',
            assignedTeam: { wardId: 'ward-1', editWindowHours: 168 },
          }),
        ),
      },
    });

    const res = await svc.getStatus('u-1', 'Case', 'c-1');

    expect(res.locked).toBe(true);
    expect(res.hoursRemaining).toBe(0);
  });

  it('refuses a record belonging to another team', async () => {
    // Without this the endpoint leaks another unit's createdAt: guess an id,
    // read hoursElapsed, subtract.
    const { svc } = makeService({
      userTeam: {
        findMany: jest.fn(() => Promise.resolve([{ teamId: 'team-b' }])),
      },
    });

    await expect(svc.getStatus('u-1', 'Case', 'c-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('404s when the record does not exist or is unassigned', async () => {
    const { svc } = makeService();
    (svc as any).getSubjectAssignedTeamId = jest.fn(() =>
      Promise.resolve(null),
    );

    await expect(svc.getStatus('u-1', 'Case', 'nope')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('reports an existing pending request so the user does not ask twice', async () => {
    const { svc } = makeService({
      editWindowResetRequest: {
        findFirst: jest.fn(() =>
          Promise.resolve({ id: 'req-1', createdAt: new Date() }),
        ),
      },
    });

    const res = await svc.getStatus('u-1', 'Case', 'c-1');

    expect(res.pendingRequest).toMatchObject({ id: 'req-1' });
  });

  it("only counts this user's own pending request", async () => {
    // A colleague's pending request must not hide the button from someone who
    // has not asked yet.
    const { svc, prisma } = makeService();

    await svc.getStatus('u-1', 'Case', 'c-1');

    expect(
      prisma.editWindowResetRequest.findFirst.mock.calls[0][0].where,
    ).toMatchObject({
      requestedById: 'u-1',
      status: 'PENDING',
    });
  });
});
