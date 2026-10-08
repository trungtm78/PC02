import { ForbiddenException } from '@nestjs/common';
import { ConclusionsService } from './conclusions.service';

describe('CG14 Conclusion HTTP identity and parent ACL closure', () => {
  function fixture() {
    const record = { id: 'child', caseId: 'restricted', case: { id: 'restricted' } };
    const prisma = { conclusion: { findMany: jest.fn(async () => [record]), count: jest.fn(async () => 1), findFirst: jest.fn(async () => record) } };
    const childAccess = { scope: jest.fn(async () => null), entity: jest.fn(async () => undefined), listWhere: jest.fn(async () => ({ id: 'current-visible-case' })), read: jest.fn(async () => { throw new ForbiddenException('Current sensitive permission required'); }), serialize: jest.fn(async (_id: string, row: unknown) => row) };
    const service = Object.assign(Object.create(ConclusionsService.prototype) as object, { prisma, childAccess }) as unknown as ConclusionsService;
    return { prisma, childAccess, service };
  }
  it('list/count share current parent view authorization before pagination', async () => {
    const { prisma, service } = fixture();
    await Reflect.apply(service.getList, service, [{}, null, 'actor']);
    expect(prisma.conclusion.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ case: { id: 'current-visible-case' } }) }));
    expect(prisma.conclusion.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ case: { id: 'current-visible-case' } }) }));
  });
  it('null cached scope cannot bypass current restricted-parent authority', async () => {
    const { service } = fixture();
    await expect(Reflect.apply(service.getById, service, ['child', null, 'actor'])).rejects.toBeInstanceOf(ForbiddenException);
  });
});
