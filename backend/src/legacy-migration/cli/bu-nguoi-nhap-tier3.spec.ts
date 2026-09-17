import {
  BANG_TIER3,
  buNguoiNhapTier3,
  cauBu,
  cauDem,
  type PrismaBu,
} from './bu-nguoi-nhap-tier3';

/** Prisma giả ở RANH GIỚI CSDL: đếm theo bảng, ghi trả số dòng theo bảng. */
function gia(
  dem: Record<string, { thieu: number; buDuoc: number }>,
  ghi: Record<string, number> = {},
) {
  const daGhi: string[] = [];
  const bangCua = (sql: string) =>
    /"(guidance_records|exchanges|proposals)"/.exec(sql)?.[1] ?? '';
  const prisma: PrismaBu = {
    $queryRawUnsafe: <T>(sql: string) =>
      Promise.resolve(
        (sql.startsWith('SELECT count')
          ? [dem[bangCua(sql)] ?? { thieu: 0, buDuoc: 0 }]
          : [
              { khoa: 'ho_so_doi_1:1', taiKhoan: 'cb1', hoTen: 'Nguyễn An' },
            ]) as T,
      ),
    $executeRawUnsafe: (sql: string) => {
      const b = bangCua(sql);
      daGhi.push(b);
      return Promise.resolve(ghi[b] ?? dem[b]?.buDuoc ?? 0);
    },
    $transaction: (fn) => fn(prisma),
  };
  return { prisma, daGhi };
}

const im = () => undefined;

describe('buNguoiNhapTier3', () => {
  it('chạy thử: đếm cả ba bảng, KHÔNG ghi', async () => {
    const { prisma, daGhi } = gia({
      guidance_records: { thieu: 541, buDuoc: 541 },
    });
    const kq = await buNguoiNhapTier3(prisma, false, im);
    expect(kq.map((k) => k.bang)).toEqual([...BANG_TIER3]);
    expect(kq[0]).toEqual({
      bang: 'guidance_records',
      thieu: 541,
      buDuoc: 541,
      daBu: 0,
    });
    expect(daGhi).toEqual([]);
  });

  it('ghi thật: chỉ bảng có dòng bù được', async () => {
    const { prisma, daGhi } = gia({
      guidance_records: { thieu: 541, buDuoc: 541 },
      exchanges: { thieu: 0, buDuoc: 0 },
      proposals: { thieu: 34, buDuoc: 33 },
    });
    const kq = await buNguoiNhapTier3(prisma, true, im);
    expect(daGhi).toEqual(['guidance_records', 'proposals']);
    expect(kq.map((k) => k.daBu)).toEqual([541, 0, 33]);
  });

  it('ghi khác số đã đếm → ném lỗi (giao dịch huỷ), không báo thành công', async () => {
    const { prisma } = gia(
      { exchanges: { thieu: 76, buDuoc: 76 } },
      { exchanges: 75 },
    );
    await expect(buNguoiNhapTier3(prisma, true, im)).rejects.toThrow(
      'đếm 76 mà ghi 75',
    );
  });

  it('câu SQL chỉ đụng ô trống và chỉ gán id có trong users', () => {
    for (const bang of BANG_TIER3) {
      expect(cauBu(bang)).toContain('b."createdById" IS NULL');
      expect(cauBu(bang)).toContain(
        `FROM users u WHERE u.id = b."legacyRaw"->>'__createdById'`,
      );
      expect(cauDem(bang)).toContain('LEFT JOIN users u');
      expect(cauDem(bang)).toContain('b."deletedAt" IS NULL');
      expect(cauBu(bang)).toContain('b."deletedAt" IS NULL');
    }
  });
});
