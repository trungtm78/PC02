import { NotFoundException } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * D9. `BulkOperation` rows have been written for a long time and never read:
 * every bulk export, assign or return left one, and the only way to look was
 * psql. When a batch of two hundred files runs half way, this is the only place
 * that can say what the batch contained.
 */
function makeService(over: Record<string, any> = {}) {
  const prisma: any = {
    bulkOperation: {
      findMany: jest.fn(() => Promise.resolve([])),
      count: jest.fn(() => Promise.resolve(0)),
      findUnique: jest.fn(() => Promise.resolve(null)),
    },
    ...over,
  };
  // Qua constructor thật, không `Object.create` + chọc field: chọc field bằng
  // `as any` tắt kiểm kiểu ở đúng chỗ cần nhất — đổi tên `prisma` trong service
  // thì spec vẫn biên dịch và vẫn xanh, chỉ tiêm vào một field không còn nữa.
  const svc = new AuditService(prisma as never);
  return { svc, prisma };
}

describe('listBulkOperations', () => {
  it('returns newest first', async () => {
    const { svc, prisma } = makeService();

    await svc.listBulkOperations({});

    expect(prisma.bulkOperation.findMany.mock.calls[0][0].orderBy).toEqual({
      startedAt: 'desc',
    });
  });

  it('caps the page so a caller cannot ask for everything', async () => {
    const { svc, prisma } = makeService();

    await svc.listBulkOperations({ limit: 100000 });

    expect(prisma.bulkOperation.findMany.mock.calls[0][0].take).toBe(100);
  });

  it('filters by resource, action and actor when asked', async () => {
    const { svc, prisma } = makeService();

    await svc.listBulkOperations({
      resource: 'Case',
      action: 'BULK_EXPORT',
      actorId: 'u-1',
    });

    expect(prisma.bulkOperation.findMany.mock.calls[0][0].where).toEqual({
      resource: 'Case',
      action: 'BULK_EXPORT',
      actorId: 'u-1',
    });
  });

  it('does not filter on absent parameters', async () => {
    // An empty string arriving from a query string must not become
    // `resource: ''`, which matches nothing and looks like "no batches ran".
    const { svc, prisma } = makeService();

    await svc.listBulkOperations({ resource: '', action: undefined });

    expect(prisma.bulkOperation.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe('getBulkOperationById', () => {
  it('includes the per-record audit rows', async () => {
    // The count on the batch row says twenty succeeded; only these rows say
    // WHICH twenty — which is the question actually asked after a partial run.
    const { svc, prisma } = makeService({
      bulkOperation: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(() =>
          Promise.resolve({ id: 'b-1', auditItems: [] }),
        ),
      },
    });

    await svc.getBulkOperationById('b-1');

    const include = prisma.bulkOperation.findUnique.mock.calls[0][0].include;
    expect(include.auditItems).toBeDefined();
    expect(include.auditItems.orderBy).toEqual({ createdAt: 'asc' });
  });

  it('bounds the per-record rows', async () => {
    // A 200-file batch is allowed; an unbounded include is how one request
    // becomes a slow query nobody expected.
    const { svc, prisma } = makeService({
      bulkOperation: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(() =>
          Promise.resolve({ id: 'b-1', auditItems: [] }),
        ),
      },
    });

    await svc.getBulkOperationById('b-1');

    expect(
      prisma.bulkOperation.findUnique.mock.calls[0][0].include.auditItems.take,
    ).toBe(500);
  });

  it('404s on an unknown id rather than returning null', async () => {
    const { svc } = makeService();

    await expect(svc.getBulkOperationById('nope')).rejects.toThrow(
      NotFoundException,
    );
  });
});
