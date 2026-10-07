import { CasesService } from './cases.service';

describe('CG-QD01 ordinary Case overdue shares the civil predicate', () => {
  it('list/count/export factory uses start of the current HCM day and retains authorized scope', async () => {
    const service = Object.create(CasesService.prototype) as CasesService;
    const fieldSchema = { assertQueryReadable: jest.fn(async () => undefined), policyAwareSearchWhere: jest.fn(async () => null), readableNativeWhere: jest.fn(async () => ({ id: 'native-ready-case' })) };
    Object.defineProperties(service,{
      fieldSchema: { value: fieldSchema },
      visibilityWhere: { value: jest.fn(async () => ({ id: 'authorized-case' })) },
      timKiem: { value: { kyApDung: () => ({ ky: 'TAT_CA', truong: 'NGAY_TIEP_NHAN' }), dieuKien: jest.fn(async () => []) } },
      settings: { value: { getKyThongKe: jest.fn(async () => ({ ky: 'TAT_CA', truong: 'NGAY_TIEP_NHAN' })) } },
      prisma: { value: {} },
    });
    const factory = service as unknown as { dungWhereDanhSach: (query: object, scope: null, options: object) => Promise<{ where: { deadline: object; AND: object[] } }> };
    const { where } = await factory.dungWhereDanhSach({ overdue: true },null,{ actorId: 'actor', now: new Date('2026-10-06T05:00:00Z') });
    expect(where.deadline).toEqual({ lt: new Date('2026-10-05T17:00:00Z') });
    expect(JSON.stringify(where)).toContain('authorized-case');
    expect(fieldSchema.readableNativeWhere).toHaveBeenCalledWith(expect.anything(),{ actorId: 'actor' },['deadline','status'],expect.anything());
    expect(JSON.stringify(where)).toContain('native-ready-case');
  });
});
