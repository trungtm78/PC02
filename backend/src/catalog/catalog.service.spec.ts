import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const makePrisma = (rows: any[] = []) => ({ directory: { findMany: jest.fn().mockResolvedValue(rows) } });

  it('options() legal trả values từ registry (không query DB)', async () => {
    const prisma = makePrisma();
    const svc = new CatalogService(prisma as any);
    const opts = await svc.options('LY_DO_KHONG_KHOI_TO');
    expect(opts[0]).toEqual({ code: 'KHONG_CO_SU_VIEC', label: 'Không có sự việc phạm tội (khoản 1a)' });
    expect(opts).toHaveLength(7);
    expect(prisma.directory.findMany).not.toHaveBeenCalled();
  });

  it('options() dynamic query Directory theo type', async () => {
    const prisma = makePrisma([{ code: 'VAN_BAN', name: 'Văn bản' }]);
    const svc = new CatalogService(prisma as any);
    const opts = await svc.options('DOCUMENT_TYPE');
    expect(prisma.directory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: 'DOCUMENT_TYPE', isActive: true } }),
    );
    expect(opts).toEqual([{ code: 'VAN_BAN', label: 'Văn bản' }]);
  });

  it('isValid() true/false theo danh mục', async () => {
    const svc = new CatalogService(makePrisma() as any);
    expect(await svc.isValid('LY_DO_KHONG_KHOI_TO', 'HET_THOI_HIEU')).toBe(true);
    expect(await svc.isValid('LY_DO_KHONG_KHOI_TO', 'BAY')).toBe(false);
  });

  it('labelOf() trả nhãn, fallback code khi không thấy', async () => {
    const svc = new CatalogService(makePrisma() as any);
    expect(await svc.labelOf('LY_DO_KHONG_KHOI_TO', 'NGUOI_PHAM_TOI_CHET')).toBe('Người phạm tội đã chết (khoản 1d)');
    expect(await svc.labelOf('LY_DO_KHONG_KHOI_TO', 'XXX')).toBe('XXX');
  });
});
