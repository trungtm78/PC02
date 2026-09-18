import {
  buCanBoNhapVuViec,
  CAU_BU,
  CAU_DEM,
  chayCli,
  taoPrisma,
  type PrismaBu,
} from './bu-can-bo-nhap-vu-viec';

/** Prisma giả ở RANH GIỚI CSDL: một câu đếm, một câu mẫu, một câu ghi. */
function gia(thieu: number, ghi = thieu) {
  const daGhi: string[] = [];
  const prisma: PrismaBu = {
    $queryRawUnsafe: <T>(sql: string) =>
      Promise.resolve(
        (sql.startsWith('SELECT count')
          ? [{ thieu }]
          : [{ ma: '2026-11732', taiKhoan: 'cb1', hoTen: 'Nguyễn An' }]) as T,
      ),
    $executeRawUnsafe: (sql: string) => {
      daGhi.push(sql);
      return Promise.resolve(ghi);
    },
    $transaction: (fn) => fn(prisma),
  };
  return { prisma, daGhi };
}

const im = () => undefined;

describe('buCanBoNhapVuViec', () => {
  it('chạy thử: đếm và in mẫu, KHÔNG ghi', async () => {
    const dong: string[] = [];
    const { prisma, daGhi } = gia(4601);
    const kq = await buCanBoNhapVuViec(prisma, false, (d) => dong.push(d));
    expect(kq).toEqual({ thieu: 4601, daBu: 0 });
    expect(daGhi).toEqual([]);
    expect(dong.join('\n')).toContain('2026-11732 → cb1 (Nguyễn An)');
  });

  it('ghi thật: một câu ghi trong giao dịch, trả số đã bù', async () => {
    const { prisma, daGhi } = gia(4601);
    expect(await buCanBoNhapVuViec(prisma, true, im)).toEqual({
      thieu: 4601,
      daBu: 4601,
    });
    expect(daGhi).toEqual([CAU_BU]);
  });

  it('không còn gì thiếu → không ghi (chạy lại ra 0)', async () => {
    const { prisma, daGhi } = gia(0);
    expect(await buCanBoNhapVuViec(prisma, true, im)).toEqual({
      thieu: 0,
      daBu: 0,
    });
    expect(daGhi).toEqual([]);
  });

  it('ghi khác số đã đếm → ném lỗi (giao dịch huỷ), không báo thành công', async () => {
    const { prisma } = gia(4601, 4600);
    await expect(buCanBoNhapVuViec(prisma, true, im)).rejects.toThrow(
      'đếm 4601 mà ghi 4600',
    );
  });

  it('dòng lệnh: không có --apply thì chỉ đọc; kết nối luôn được đóng, kể cả khi lỗi', async () => {
    const dong1 = gia(10);
    const dong = Object.assign(dong1.prisma, { $disconnect: jest.fn() });
    expect(await chayCli(['node', 'cli'], dong, im)).toEqual({
      thieu: 10,
      daBu: 0,
    });
    expect(dong1.daGhi).toEqual([]);
    expect(dong.$disconnect).toHaveBeenCalledTimes(1);

    const loi = Object.assign(gia(10, 9).prisma, { $disconnect: jest.fn() });
    await expect(chayCli(['node', 'cli', '--apply'], loi, im)).rejects.toThrow(
      'đếm 10 mà ghi 9',
    );
    expect(loi.$disconnect).toHaveBeenCalledTimes(1);
  });

  it('tạo client theo địa chỉ CSDL mà không mở kết nối', async () => {
    const p = taoPrisma('postgresql://u:p@127.0.0.1:1/khong_co');
    expect(typeof p.$queryRawUnsafe).toBe('function');
    await p.$disconnect();
  });

  it('câu SQL chỉ lấp ô TRỐNG bằng người tạo đã có, bỏ hồ sơ đã xoá, đếm và ghi CÙNG tập', () => {
    const dieuKien =
      'WHERE "canBoNhapId" IS NULL AND "createdById" IS NOT NULL AND "deletedAt" IS NULL';
    expect(CAU_DEM).toContain(dieuKien);
    expect(CAU_BU).toContain(dieuKien);
    expect(CAU_BU).toContain('SET "canBoNhapId" = "createdById"');
    // Không động `updatedAt` — sửa di trú, không phải cán bộ sửa.
    expect(CAU_BU).not.toContain('updatedAt');
  });
});
