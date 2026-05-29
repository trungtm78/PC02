import { runBulk } from './run-bulk';

describe('runBulk utility', () => {
  // Mock Prisma — $transaction(cb) gọi cb với mock tx và trả về kết quả.
  // Pattern này khớp với audit.service.spec.ts (mockPrisma.$executeRaw jest.fn).
  const makeMockPrisma = () => ({
    $transaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) => cb({})),
  });

  it('accumulates 3 succeeded items when executeOne resolves for all', async () => {
    const prisma = makeMockPrisma();
    const executeOne = jest.fn(async (id: string) => ({ id, processed: true }));

    const result = await runBulk({
      ids: ['a', 'b', 'c'],
      prisma: prisma as any,
      executeOne,
    });

    expect(result.succeeded).toHaveLength(3);
    expect(result.succeeded.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(result.skipped).toHaveLength(0);
    expect(result.failed).toHaveLength(0);
    expect(executeOne).toHaveBeenCalledTimes(3);
  });

  it('continues past a failing item and reports it in failed[] (per-item tx isolation)', async () => {
    const prisma = makeMockPrisma();
    const executeOne = jest.fn(async (id: string) => {
      if (id === 'b') throw new Error('forced fail');
      return { id };
    });

    const result = await runBulk({
      ids: ['a', 'b', 'c'],
      prisma: prisma as any,
      executeOne,
    });

    // CORE INVARIANT: item B failure không được rollback item A hay block item C.
    // Đây là partial-success model em viết runBulk để đảm bảo.
    expect(result.succeeded.map((r) => r.id)).toEqual(['a', 'c']);
    expect(result.failed).toEqual([{ id: 'b', error: 'forced fail' }]);
    expect(executeOne).toHaveBeenCalledTimes(3);
  });

  it('starts a separate $transaction for each item (per-item tx required by Postgres abort semantics)', async () => {
    const prisma = makeMockPrisma();
    const executeOne = jest.fn(async (id: string) => ({ id }));

    await runBulk({
      ids: ['a', 'b', 'c'],
      prisma: prisma as any,
      executeOne,
    });

    // Lý do test này tồn tại: plan eng review E-C5 — Postgres abort tx ở statement
    // đầu lỗi, nên KHÔNG được gom cả batch vào 1 $transaction. Test guard regression
    // nếu future refactor bỏ per-item tx.
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('preflight skips items before executeOne runs', async () => {
    const prisma = makeMockPrisma();
    const executeOne = jest.fn(async (id: string) => ({ id }));

    const result = await runBulk({
      ids: ['a', 'b', 'c'],
      prisma: prisma as any,
      executeOne,
      preflight: async (ids) => ({
        validIds: ids.filter((id) => id !== 'b'),
        skipped: [{ id: 'b', reason: 'INELIGIBLE', message: 'business rule X' }],
      }),
    });

    expect(result.succeeded.map((r) => r.id)).toEqual(['a', 'c']);
    expect(result.skipped).toEqual([
      { id: 'b', reason: 'INELIGIBLE', message: 'business rule X' },
    ]);
    // executeOne KHÔNG được gọi cho id 'b' — quan trọng vì preflight check
    // (scope filter, business rule) phải chạy TRƯỚC tx, tiết kiệm DB round-trip.
    expect(executeOne).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('returns empty result for empty ids[] without calling prisma', async () => {
    const prisma = makeMockPrisma();
    const executeOne = jest.fn();

    const result = await runBulk({
      ids: [],
      prisma: prisma as any,
      executeOne,
    });

    expect(result).toEqual({ succeeded: [], skipped: [], failed: [] });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(executeOne).not.toHaveBeenCalled();
  });

  it('returns empty result when preflight skips ALL ids (executeOne + $transaction never called)', async () => {
    const prisma = makeMockPrisma();
    const executeOne = jest.fn();

    const result = await runBulk({
      ids: ['a', 'b'],
      prisma: prisma as any,
      executeOne,
      preflight: async (ids) => ({
        validIds: [],
        skipped: ids.map((id) => ({ id, reason: 'PERMISSION' as const })),
      }),
    });

    // Codex P2 review (B1): regression test cho edge case "preflight skip all".
    // Đảm bảo loop không chạy + skipped accumulator chứa đủ N items + executeOne KHÔNG bị call.
    expect(result.succeeded).toHaveLength(0);
    expect(result.skipped).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(executeOne).not.toHaveBeenCalled();
  });

  it('handles non-Error throws (string, object) without crashing', async () => {
    const prisma = makeMockPrisma();
    const executeOne = jest.fn(async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      if (id === 'a') throw 'string error';
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      if (id === 'b') throw { code: 42 };
      return { id };
    });

    const result = await runBulk({
      ids: ['a', 'b', 'c'],
      prisma: prisma as any,
      executeOne,
    });

    expect(result.succeeded.map((r) => r.id)).toEqual(['c']);
    expect(result.failed).toHaveLength(2);
    // Đảm bảo không crash vì `e.message` undefined trên non-Error throw.
    // Plan eng review E-H9 — error message phải sanitize, không leak object internals.
    expect(typeof result.failed[0].error).toBe('string');
    expect(typeof result.failed[1].error).toBe('string');
  });
});
