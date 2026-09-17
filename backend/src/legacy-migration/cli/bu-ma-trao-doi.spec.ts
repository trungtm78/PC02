import {
  buMaTraoDoi,
  cauBuMa,
  cauDemMa,
  type PrismaBuMa,
} from './bu-ma-trao-doi';

/**
 * Codex rà 5de2b391: bảng Trao đổi hiện mã `năm-stt` hệ cũ khi `recordCode` rỗng (73/76 bản di trú) nhưng
 * thẻ Mã hồ sơ tìm trên `recordCode` — gõ đúng mã đang thấy vẫn không ra. Bù mã vào cột thật.
 */
function gia(dem: { thieu: number; buDuoc: number }, ghi?: number) {
  const daGhi: string[] = [];
  const prisma: PrismaBuMa = {
    $queryRawUnsafe: <T>(sql: string) =>
      Promise.resolve(
        (sql.startsWith('SELECT count')
          ? [dem]
          : [{ khoa: 'ho_so_doi_1:1', ma: '2025-586' }]) as T,
      ),
    $executeRawUnsafe: (sql: string) => {
      daGhi.push(sql);
      return Promise.resolve(ghi ?? dem.buDuoc);
    },
    $transaction: (fn) => fn(prisma),
  };
  return { prisma, daGhi };
}
const im = () => undefined;

describe('buMaTraoDoi', () => {
  it('chạy thử: chỉ đếm + in mẫu, KHÔNG ghi', async () => {
    const { prisma, daGhi } = gia({ thieu: 73, buDuoc: 73 });
    expect(await buMaTraoDoi(prisma, false, im)).toEqual({
      thieu: 73,
      buDuoc: 73,
      daBu: 0,
    });
    expect(daGhi).toEqual([]);
  });

  it('ghi thật: ghi đúng số đếm; lệch → ném lỗi (giao dịch huỷ)', async () => {
    const ok = gia({ thieu: 73, buDuoc: 73 });
    expect((await buMaTraoDoi(ok.prisma, true, im)).daBu).toBe(73);
    const lech = gia({ thieu: 73, buDuoc: 73 }, 72);
    await expect(buMaTraoDoi(lech.prisma, true, im)).rejects.toThrow(
      'đếm 73 mà ghi 72',
    );
  });

  it('câu SQL chỉ đụng mã rỗng, chỉ năm 4 chữ số + stt số, không đè mã đã có', () => {
    for (const cau of [cauDemMa(), cauBuMa()]) {
      expect(cau).toContain(`coalesce("recordCode", '') = ''`);
      expect(cau).toContain(`"deletedAt" IS NULL`);
      expect(cau).toContain(`~ '^[0-9]{4}$'`);
      expect(cau).toContain(`~ '^[0-9]+$'`);
    }
    expect(cauBuMa()).toContain(
      `SET "recordCode" = ("legacyRaw"->>'nam') || '-' || ("legacyRaw"->>'stt')`,
    );
  });
});
