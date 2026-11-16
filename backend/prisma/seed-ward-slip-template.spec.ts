import * as fs from 'fs';
import * as path from 'path';
import { seedWardSlipTemplate, WARD_SLIP_SEED, wardSlipVariables } from './seed-document-templates';
import { timThuMucMau } from './duong-dan-mau';

/**
 * The request slip template ships with the deploy and is seeded by the deploy's template step: its file is where the
 * seed looks (also from `dist/`), every placeholder is a field of HO_SO_PHAN_CONG, and the CLI entry runs it.
 */
describe('seed of the request slip template (HO_SO_PHAN_CONG / PHIEU_YEU_CAU)', () => {
  const file = path.join(timThuMucMau(__dirname, 'ward-docx'), 'PHIEU_YEU_CAU.docx');

  it('the file is in the seed assets, found from the sources and from the build', () => {
    expect(fs.existsSync(file)).toBe(true);
    const fromDist = path.join(timThuMucMau(path.resolve(__dirname, '..', 'dist', 'prisma'), 'ward-docx'), 'PHIEU_YEU_CAU.docx');
    expect(fs.existsSync(fromDist)).toBe(true);
  });

  it('every placeholder is a catalogue field, filled automatically; the slip\'s fields are all there', () => {
    const vars = wardSlipVariables(fs.readFileSync(file));
    expect(vars.every((v) => v.source === 'auto' && v.field === v.name)).toBe(true);
    expect(vars.map((v) => v.name).sort()).toEqual(
      ['doiTuong', 'dieuTraVien', 'dongLyDoTraVe', 'loaiViec', 'ngayPhatHanh', 'ngayPhatHien', 'ngayTrinh', 'noiXayRa', 'soVanBan', 'tenCanBoThamDinh', 'tenChiHuyDoi', 'tenDonVi', 'tenLanhDaoPhong', 'toiDanh', 'yeuCau'].sort(),
    );
  });

  it('active at once, not numbered by the platform, on the PHIEU_YEU_CAU series', async () => {
    const create = jest.fn();
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin' }) },
      documentTemplate: { findFirst: jest.fn().mockResolvedValue(null), create, update: jest.fn() },
    };
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await expect(seedWardSlipTemplate(prisma as never)).resolves.toEqual({ created: 1, updated: 0, skipped: 0 });
    expect(create.mock.calls[0][0].data).toMatchObject({
      code: 'PHIEU_YEU_CAU',
      entityType: 'HO_SO_PHAN_CONG',
      status: 'active',
      needsNumber: false,
      numberSeriesId: 'PHIEU_YEU_CAU',
    });
    // An administrator's edit is kept on the next deploy.
    prisma.documentTemplate.findFirst.mockResolvedValue({ id: 't1' });
    await expect(seedWardSlipTemplate(prisma as never)).resolves.toEqual({ created: 0, updated: 0, skipped: 1 });
    expect(prisma.documentTemplate.update).not.toHaveBeenCalled();
  });

  it('the CLI entry of the deploy step runs it', () => {
    const cli = fs.readFileSync(path.join(__dirname, 'seed-document-templates.ts'), 'utf8');
    expect(cli.slice(cli.indexOf('require.main === module'))).toContain('seedWardSlipTemplate(prisma)');
    expect(WARD_SLIP_SEED.entityType).toBe('HO_SO_PHAN_CONG');
  });
});
