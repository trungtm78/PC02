import { ForbiddenException } from '@nestjs/common';
import { CasesService } from './cases.service';

/**
 * The order of the case list by alert tells two things about each case: its deadline, and whether it is still at work
 * (a finished or suspended case has no alert and sorts last). A reader who may not sort by `status` must not get it.
 */
describe('the case list ordered by alert asks for both fields it reveals', () => {
  const build = (refused: string[]) => {
    const service = Object.create(CasesService.prototype) as CasesService;
    const assertQueryReadable = jest.fn(async (_db: unknown, _ctx: unknown, query: { sortBy?: string }) => {
      if (query.sortBy && refused.includes(query.sortBy)) throw new ForbiddenException();
    });
    const orderBy = jest.fn(() => [{ id: 'asc' }]);
    Object.defineProperties(service, {
      fieldSchema: { value: { assertQueryReadable } },
      listAlerts: { value: { orderBy } },
      prisma: { value: {} },
    });
    const order = (service as unknown as { thuTuTheoCanhBao: (sortOrder: 'asc' | 'desc', actorId: string | undefined) => Promise<unknown> }).thuTuTheoCanhBao.bind(service);
    return { order, assertQueryReadable, orderBy };
  };

  it('a reader of both fields gets the order', async () => {
    const { order, assertQueryReadable } = build([]);
    await expect(order('asc', 'reader')).resolves.toEqual([{ id: 'asc' }]);
    expect(assertQueryReadable.mock.calls.map((call) => call[2].sortBy).sort()).toEqual(['deadline', 'status']);
  });

  it.each(['deadline', 'status'])('a reader who may not sort by %s is refused and no order is built', async (field) => {
    const { order, orderBy } = build([field]);
    await expect(order('asc', 'reader')).rejects.toBeInstanceOf(ForbiddenException);
    expect(orderBy).not.toHaveBeenCalled();
  });
});
