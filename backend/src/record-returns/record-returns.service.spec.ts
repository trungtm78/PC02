import { NotFoundException } from '@nestjs/common';
import { Prisma, RecordReturnType } from '@prisma/client';
import { RecordReturnsService } from './record-returns.service';

/**
 * First argument of a mock call, typed loosely on purpose.
 *
 * `jest.fn(async () => …)` infers a zero-length argument tuple, so reading
 * `mock.calls[0][0]` stops type-checking — and the arguments are exactly what
 * these tests assert on. Adding a dummy parameter to every mock just to widen
 * the tuple trades a type error for an unused-variable one.
 */
function firstArg(mock: jest.Mock): any {
  return mock.mock.calls[0][0];
}

/**
 * C9. Returning a file to the unit that sent it is a procedural decision, so
 * the failure modes matter as much as the happy path: a batch must not lose
 * nineteen good returns because the twentieth failed, a record from another
 * unit must be reported rather than silently dropped, and the database's own
 * `num_nonnulls = 1` CHECK must reach the duty room as Vietnamese rather than
 * as `violates check constraint "record_returns_exactly_one_target"`.
 */

const DTO = {
  target: 'case' as const,
  ids: ['c-1', 'c-2'],
  returnType: RecordReturnType.KHONG_THUOC_THAM_QUYEN,
  reason: 'Vụ án thuộc thẩm quyền của cơ quan điều tra cấp huyện.',
  toUnit: 'Công an quận 1',
};

function makeService(over: Record<string, any> = {}) {
  const fn = (impl: () => any) => jest.fn(() => Promise.resolve(impl()));
  const prisma: any = {
    case: {
      findMany: fn(() => [{ id: 'c-1' }, { id: 'c-2' }]),
      findFirst: fn(() => ({ id: 'c-1' })),
    },
    incident: { findMany: fn(() => []), findFirst: fn(() => null) },
    petition: { findMany: fn(() => []), findFirst: fn(() => null) },
    recordReturn: {
      findFirst: fn(() => null),
      create: fn(() => ({ id: 'r-1' })),
      update: fn(() => ({ id: 'r-1' })),
      findMany: fn(() => []),
      count: fn(() => 0),
    },
    bulkOperation: {
      create: fn(() => ({ id: 'bulk-1' })),
      update: fn(() => ({})),
    },
    ...over,
  };
  const audit = { log: fn(() => undefined) };
  const svc = new RecordReturnsService(prisma, audit as any);
  return { svc, prisma, audit };
}

describe('createMany', () => {
  it('creates one return per record and audits each file', async () => {
    const { svc, prisma, audit } = makeService();

    const res = await svc.createMany(DTO, 'user-1', null);

    expect(res.succeeded.map((s) => s.id)).toEqual(['c-1', 'c-2']);
    expect(prisma.recordReturn.create).toHaveBeenCalledTimes(2);
    expect(audit.log.mock.calls.map((c: any[]) => c[0].subjectId)).toEqual([
      'c-1',
      'c-2',
    ]);
    expect(firstArg(audit.log as jest.Mock).action).toBe('RECORD_RETURNED');
  });

  it('reports out-of-scope records as skipped, not as an error', async () => {
    // They are not a failure — they are simply not this officer's to return,
    // and the caller needs to see which ones did not go.
    const { svc } = makeService({
      case: {
        findMany: jest.fn(() => Promise.resolve([{ id: 'c-1' }])),
        findFirst: jest.fn(),
      },
    });

    const res = await svc.createMany(DTO, 'user-1', null);

    expect(res.succeeded.map((s) => s.id)).toEqual(['c-1']);
    expect(res.skipped).toEqual([
      expect.objectContaining({ id: 'c-2', reason: 'NOT_FOUND' }),
    ]);
    expect(res.failed).toEqual([]);
  });

  it('skips a record that is already returned and not yet withdrawn', async () => {
    const { svc } = makeService({
      recordReturn: {
        findFirst: jest.fn(() => Promise.resolve({ id: 'existing' })),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });

    const res = await svc.createMany(DTO, 'user-1', null);

    expect(res.succeeded).toEqual([]);
    expect(res.skipped.map((s) => s.reason)).toEqual([
      'INELIGIBLE',
      'INELIGIBLE',
    ]);
  });

  it('keeps the successes when one record fails', async () => {
    let call = 0;
    const { svc } = makeService({
      recordReturn: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        create: jest.fn(async () => {
          call += 1;
          return call === 1
            ? Promise.resolve({ id: 'r-1' })
            : Promise.reject(new Error('boom'));
        }),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });

    const res = await svc.createMany(DTO, 'user-1', null);

    expect(res.succeeded.map((s) => s.id)).toEqual(['c-1']);
    expect(res.failed.map((f) => f.id)).toEqual(['c-2']);
  });

  it('turns the CHECK violation into Vietnamese, not driver text', async () => {
    // The constraint is what stops a return pointing at two files or none.
    // Postgres describes it accurately and uselessly; this is what the officer
    // in the duty room actually reads.
    const err = new Prisma.PrismaClientKnownRequestError('check constraint', {
      code: 'P2010',
      clientVersion: '7.0.0',
      meta: { code: '23514' },
    });
    const { svc } = makeService({
      recordReturn: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        create: jest.fn(async () => Promise.reject(err)),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });

    const res = await svc.createMany(DTO, 'user-1', null);

    expect(res.failed[0].error).toBe(
      'Bản ghi trả hồ sơ phải trỏ tới đúng một vụ án. Vui lòng chọn lại.',
    );
    expect(res.failed[0].error).not.toMatch(
      /constraint|violates|record_returns/,
    );
  });

  it('never leaks raw driver text for an unrecognised error', async () => {
    const { svc } = makeService({
      recordReturn: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        create: jest.fn(async () =>
          Promise.reject(new Error('ECONNRESET at pg socket')),
        ),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });

    const res = await svc.createMany(DTO, 'user-1', null);

    expect(res.failed[0].error).not.toMatch(/ECONNRESET|socket/);
    expect(res.failed[0].error).toMatch(/Không trả được vụ án/);
  });

  it('records the batch so the counts can be reconciled later', async () => {
    const { svc, prisma } = makeService();

    await svc.createMany(DTO, 'user-1', null);

    expect(firstArg(prisma.bulkOperation.create as jest.Mock).data.action).toBe(
      'BULK_RECORD_RETURN',
    );
    const done = firstArg(prisma.bulkOperation.update as jest.Mock).data;
    expect(done.succeededCount).toBe(2);
    expect(done.failedCount).toBe(0);
    expect(done.completedAt).toBeInstanceOf(Date);
  });

  it('writes to the column that matches the chosen target', async () => {
    const { svc, prisma } = makeService({
      petition: {
        findMany: jest.fn(() => Promise.resolve([{ id: 'p-1' }])),
        findFirst: jest.fn(),
      },
    });

    await svc.createMany(
      { ...DTO, target: 'petition', ids: ['p-1'] },
      'user-1',
      null,
    );

    const data = firstArg(prisma.recordReturn.create as jest.Mock).data;
    expect(data.petitionId).toBe('p-1');
    expect(data.caseId).toBeUndefined();
    expect(data.incidentId).toBeUndefined();
  });
});

describe('revert', () => {
  const LIVE = {
    id: 'r-1',
    caseId: 'c-1',
    incidentId: null,
    petitionId: null,
    returnType: RecordReturnType.KHONG_THUOC_THAM_QUYEN,
  };

  it('stamps the withdrawal instead of deleting the row', async () => {
    // Returning a file and then taking it back is something that has to be
    // explainable afterwards.
    const { svc, prisma } = makeService({
      recordReturn: {
        findFirst: jest.fn(() => Promise.resolve(LIVE)),
        update: jest.fn((a?: any) => Promise.resolve({ id: 'r-1', ...a.data })),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });

    await svc.revert(
      'r-1',
      { revertReason: 'Đơn vị bạn từ chối tiếp nhận lại.' },
      'user-2',
      null,
    );

    const data = firstArg(prisma.recordReturn.update as jest.Mock).data;
    expect(data.revertedById).toBe('user-2');
    expect(data.revertReason).toBe('Đơn vị bạn từ chối tiếp nhận lại.');
    expect(data.revertedAt).toBeInstanceOf(Date);
    expect(prisma.recordReturn.delete).toBeUndefined();
  });

  it('audits against the file the return pointed at', async () => {
    const { svc, audit } = makeService({
      recordReturn: {
        findFirst: jest.fn(() => Promise.resolve(LIVE)),
        update: jest.fn(() => Promise.resolve({ id: 'r-1' })),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });

    await svc.revert(
      'r-1',
      { revertReason: 'Đơn vị bạn từ chối tiếp nhận lại.' },
      'user-2',
      null,
    );

    expect(firstArg(audit.log as jest.Mock)).toMatchObject({
      action: 'RECORD_RETURN_REVERTED',
      subject: 'Case',
      subjectId: 'c-1',
    });
  });

  it('refuses an already-withdrawn return', async () => {
    const { svc } = makeService({
      recordReturn: {
        findFirst: jest.fn(() => Promise.resolve(null)),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    });

    await expect(
      svc.revert(
        'r-1',
        { revertReason: 'Đơn vị bạn từ chối tiếp nhận.' },
        'user-2',
        null,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuses when the file is outside the caller scope', async () => {
    const { svc } = makeService({
      recordReturn: {
        findFirst: jest.fn(() => Promise.resolve(LIVE)),
        update: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      case: {
        findMany: jest.fn(() => Promise.resolve([])),
        findFirst: jest.fn(() => Promise.resolve(null)),
      },
    });

    await expect(
      svc.revert(
        'r-1',
        { revertReason: 'Đơn vị bạn từ chối tiếp nhận.' },
        'user-2',
        null,
      ),
    ).rejects.toThrow(/ngoài phạm vi dữ liệu/);
  });
});

describe('list', () => {
  it('hides withdrawn returns unless asked', async () => {
    const { svc, prisma } = makeService();

    await svc.list({}, null);

    expect(
      firstArg(prisma.recordReturn.findMany as jest.Mock).where.revertedAt,
    ).toBeNull();
  });

  it('caps the page size', async () => {
    const { svc, prisma } = makeService();

    await svc.list({ limit: 9999 }, null);

    expect(firstArg(prisma.recordReturn.findMany as jest.Mock).take).toBe(100);
  });
});
