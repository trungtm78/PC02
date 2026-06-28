/**
 * Test DynamicExportService.getExportReadiness (PR2): theo cờ `required`, auto rỗng = thiếu,
 * manual-required luôn thiếu, savable=false (dynamic = manualValues override).
 */
import { DynamicExportService } from './dynamic-export.service';

function makeService(templates: unknown[]) {
  const prisma = { documentTemplate: { findMany: jest.fn().mockResolvedValue(templates) } } as never;
  return new DynamicExportService(prisma, {} as never, {} as never);
}

describe('DynamicExportService.getExportReadiness', () => {
  it('VU_AN: auto-required rỗng → thiếu; auto có giá trị → ok; manual-required → luôn thiếu; required:false → bỏ qua', async () => {
    const templates = [{
      id: 't1', code: 'QD', variables: [
        { name: 'tenVuAn', source: 'auto', label: 'Tên vụ án', required: true },
        { name: 'toiDanh', source: 'auto', label: 'Tội danh', required: true },
        { name: 'dieuLuat', source: 'manual', label: 'Điều luật', required: true },
        { name: 'soVuAn', source: 'auto', label: 'Mã', required: false },
      ],
    }];
    const svc = makeService(templates);
    const { items } = await svc.getExportReadiness('VU_AN', { name: 'Vụ A', crime: '', updatedAt: 'X' });
    expect(items).toHaveLength(1);
    const fields = items[0].missing.map((x) => x.field);
    expect(fields).toContain('toiDanh');   // auto rỗng (crime='')
    expect(fields).toContain('dieuLuat');  // manual → luôn
    expect(fields).not.toContain('tenVuAn'); // auto có giá trị
    expect(fields).not.toContain('soVuAn');  // required:false
    expect(items[0].ready).toBe(false);
    expect(items[0].missing.every((x) => x.savable === false)).toBe(true);
  });

  it('đủ required → ready, missing rỗng', async () => {
    const templates = [{ id: 't1', code: 'QD', variables: [{ name: 'tenVuAn', source: 'auto', label: 'Tên', required: true }] }];
    const { items } = await makeService(templates).getExportReadiness('VU_AN', { name: 'Vụ A' });
    expect(items[0].ready).toBe(true);
    expect(items[0].missing).toEqual([]);
  });

  it('VU_VIEC: trả updatedAt cho FE', async () => {
    const templates = [{ id: 't1', code: 'TB', variables: [] }];
    const r = await makeService(templates).getExportReadiness('VU_VIEC', { code: 'VV-1', updatedAt: 'T' });
    expect(r.updatedAt).toBe('T');
    expect(r.items[0].ready).toBe(true);
  });
});
