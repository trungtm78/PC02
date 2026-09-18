import { buMaHoSo, type GhiSoMoi } from './backfill-ma-ho-so';

jest.mock('./repair-document-counters', () => ({
  napLaiBoDem: jest.fn().mockResolvedValue([]),
}));

/**
 * Hệ cũ vẫn chạy song song. Đo 18/09/2026: sau lần cập nhật 13/09, hệ cũ cấp thêm 14 số
 * 2026-11729…11742, trong khi hệ mới đã tự cấp 185 ĐƠN THƯ 2026-11729…11913. Nạp nguyên số hệ cũ
 * là hai hồ sơ khác nhau cùng một STT (2026-11732 là đơn của Phạm Hồng Thắng ở hệ mới VÀ vụ việc
 * Kha Tử Thạnh ở hệ cũ).
 *
 * Anh chốt: trùng với hồ sơ HỆ MỚI tạo → cấp số mới theo bộ đếm hệ mới, giữ số hệ cũ ở ô STT cũ.
 * Bộ đếm tách theo loại (PETITION/INCIDENT/CASE) nên chỉ xét trùng TRONG CÙNG LOẠI.
 * Trùng giữa hai hồ sơ DI TRÚ với nhau (dữ liệu hệ cũ tự trùng) thì giữ luật hậu tố cũ — cấp
 * số bộ đếm năm nay cho hồ sơ năm 2019 là sai năm.
 */
type Dong = Record<string, unknown> & { id: string };

function prismaGia(bang: {
  case?: Dong[];
  incident?: Dong[];
  petition?: Dong[];
}) {
  const dsCap: Array<{
    bang: string;
    id: string;
    data: Record<string, unknown>;
  }> = [];
  const lam = (ten: 'case' | 'incident' | 'petition') => {
    const dong = bang[ten] ?? [];
    return {
      findMany: jest.fn(
        (q?: { where?: { legacySourceId?: { in: string[] } } }) => {
          const trong = q?.where?.legacySourceId?.in;
          return Promise.resolve(
            trong
              ? dong.filter((d) => trong.includes(d.legacySourceId as string))
              : dong,
          );
        },
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          dsCap.push({ bang: ten, id: where.id, data });
          return Promise.resolve({});
        },
      ),
    };
  };
  return {
    prisma: {
      case: lam('case'),
      incident: lam('incident'),
      petition: lam('petition'),
    } as never,
    dsCap,
  };
}

const raw = (nam: number, stt: number) => ({ nam, stt });

describe('buMaHoSo — hồ sơ hệ cũ mới nạp trùng số hệ mới', () => {
  beforeEach(() =>
    jest.spyOn(console, 'log').mockImplementation(() => undefined),
  );
  afterEach(() => jest.restoreAllMocks());

  it('trùng số với đơn thư HỆ MỚI → cấp số mới theo bộ đếm, số hệ cũ vào STT cũ', async () => {
    const { prisma, dsCap } = prismaGia({
      petition: [
        {
          id: 'moi',
          stt: '2026-11732',
          legacySourceId: null,
          legacyRaw: null,
          sttCu: null,
        },
        {
          id: 'cu',
          stt: 'DT-LEGACY-87544',
          legacySourceId: 'ho_so_doi_1:87544',
          legacyRaw: raw(2026, 11732),
          sttCu: null,
        },
      ],
    });
    const ghiSoMoi: GhiSoMoi = jest.fn().mockResolvedValue('2026-11914');
    const kq = await buMaHoSo(prisma, true, { ghiSoMoi, namBoDem: 2026 });
    expect(ghiSoMoi).toHaveBeenCalledWith('PETITION', 'cu', '2026-11732');
    expect(kq.donThu.soMoi).toEqual([
      { id: 'cu', soHeCu: '2026-11732', ma: '2026-11914' },
    ]);
    // Không ghi đè bằng đường cũ (hậu tố) — chỉ đi qua ghiSoMoi.
    expect(dsCap.filter((d) => d.id === 'cu')).toEqual([]);
  });

  it('chỉ xét trùng TRONG CÙNG LOẠI: vụ việc 2026-11732 giữ nguyên số khi chỉ đơn thư có số ấy', async () => {
    const { prisma, dsCap } = prismaGia({
      petition: [
        {
          id: 'dt',
          stt: '2026-11732',
          legacySourceId: null,
          legacyRaw: null,
          sttCu: null,
        },
      ],
      incident: [
        {
          id: 'vv',
          code: 'VV-LEGACY-87541',
          legacySourceId: 'ho_so_doi_1:87541',
          legacyRaw: raw(2026, 11732),
          sttCu: null,
        },
      ],
    });
    const ghiSoMoi: GhiSoMoi = jest.fn().mockResolvedValue('khong-duoc-goi');
    await buMaHoSo(prisma, true, { ghiSoMoi, namBoDem: 2026 });
    expect(ghiSoMoi).not.toHaveBeenCalled();
    expect(dsCap).toEqual([
      { bang: 'incident', id: 'vv', data: { code: '2026-11732' } },
    ]);
  });

  it('trùng giữa hai hồ sơ DI TRÚ (hệ cũ tự trùng) → giữ luật hậu tố, không cấp số năm nay', async () => {
    const { prisma, dsCap } = prismaGia({
      case: [
        {
          id: 'a',
          caseCode: '2019-125',
          legacySourceId: 'ho_so_doi_1:1',
          legacyRaw: raw(2019, 125),
          sttCu: null,
        },
        {
          id: 'b',
          caseCode: null,
          legacySourceId: 'ho_so_doi_1:2',
          legacyRaw: raw(2019, 125),
          sttCu: null,
        },
      ],
    });
    const ghiSoMoi: GhiSoMoi = jest.fn().mockResolvedValue('khong-duoc-goi');
    await buMaHoSo(prisma, true, { ghiSoMoi, namBoDem: 2026 });
    expect(ghiSoMoi).not.toHaveBeenCalled();
    expect(dsCap).toEqual([
      { bang: 'case', id: 'b', data: { caseCode: '2019-125-2' } },
    ]);
  });

  it('hồ sơ đã có STT cũ riêng → VẪN cấp số mới (không để trống mã), KHÔNG ghi đè STT cũ', async () => {
    const { prisma } = prismaGia({
      petition: [
        {
          id: 'moi',
          stt: '2026-11740',
          legacySourceId: null,
          legacyRaw: null,
          sttCu: null,
        },
        {
          id: 'cu',
          stt: 'DT-LEGACY-87549',
          legacySourceId: 'ho_so_doi_1:87549',
          legacyRaw: raw(2026, 11740),
          sttCu: '2025-77',
        },
      ],
    });
    const ghiSoMoi: GhiSoMoi = jest.fn().mockResolvedValue('2026-11930');
    const kq = await buMaHoSo(prisma, true, { ghiSoMoi, namBoDem: 2026 });
    expect(ghiSoMoi).toHaveBeenCalledWith('PETITION', 'cu', null);
    expect(kq.donThu.sttCuDaCo).toEqual([{ id: 'cu', soHeCu: '2026-11740' }]);
  });

  /**
   * Rà mã 18/09/2026: số bộ đếm vừa cấp cho hồ sơ di trú (2026-11914) vẫn mang khoá nguồn hệ cũ,
   * nên bản đầu coi nó là "số di trú". Hệ cũ đếm tăng dần, chắc chắn sẽ phát 2026-11914 cho hồ sơ
   * kế — bản đầu gắn hậu tố 2026-11914-2 thay vì cấp số mới.
   */
  it('số bộ đếm đã cấp cho hồ sơ di trú là số HỆ MỚI: hồ sơ hệ cũ sau mang số ấy nhận số mới', async () => {
    const { prisma } = prismaGia({
      petition: [
        {
          id: 'da-doi-so',
          stt: '2026-11914',
          legacySourceId: 'ho_so_doi_1:87544',
          legacyRaw: raw(2026, 11732),
          sttCu: '2026-11732',
        },
        {
          id: 'moi-nap',
          stt: 'DT-LEGACY-87600',
          legacySourceId: 'ho_so_doi_1:87600',
          legacyRaw: raw(2026, 11914),
          sttCu: null,
        },
      ],
    });
    const ghiSoMoi: GhiSoMoi = jest.fn().mockResolvedValue('2026-11931');
    await buMaHoSo(prisma, true, { ghiSoMoi, namBoDem: 2026 });
    expect(ghiSoMoi).toHaveBeenCalledWith('PETITION', 'moi-nap', '2026-11914');
  });

  it('số vừa cấp trong CÙNG lượt cũng là số hệ mới', async () => {
    const { prisma } = prismaGia({
      petition: [
        {
          id: 'moi',
          stt: '2026-100',
          legacySourceId: null,
          legacyRaw: null,
          sttCu: null,
        },
        {
          id: 'a',
          stt: 'DT-LEGACY-1',
          legacySourceId: 'ho_so_doi_1:1',
          legacyRaw: raw(2026, 100),
          sttCu: null,
        },
        {
          id: 'b',
          stt: 'DT-LEGACY-2',
          legacySourceId: 'ho_so_doi_1:2',
          legacyRaw: raw(2026, 200),
          sttCu: null,
        },
      ],
    });
    const ghiSoMoi = jest
      .fn()
      .mockResolvedValueOnce('2026-200')
      .mockResolvedValueOnce('2026-201');
    await buMaHoSo(prisma, true, { ghiSoMoi, namBoDem: 2026 });
    expect(ghiSoMoi.mock.calls).toEqual([
      ['PETITION', 'a', '2026-100'],
      ['PETITION', 'b', '2026-200'],
    ]);
  });

  it('số gốc KHÁC năm bộ đếm trùng hồ sơ hệ mới → hậu tố (không cấp số năm nay cho hồ sơ năm cũ)', async () => {
    const { prisma, dsCap } = prismaGia({
      incident: [
        {
          id: 'moi',
          code: '2025-7',
          legacySourceId: null,
          legacyRaw: null,
          sttCu: null,
        },
        {
          id: 'cu',
          code: 'VV-LEGACY-9',
          legacySourceId: 'ho_so_doi_1:9',
          legacyRaw: raw(2025, 7),
          sttCu: null,
        },
      ],
    });
    const ghiSoMoi: GhiSoMoi = jest.fn().mockResolvedValue('khong-duoc-goi');
    await buMaHoSo(prisma, true, { ghiSoMoi, namBoDem: 2026 });
    expect(ghiSoMoi).not.toHaveBeenCalled();
    expect(dsCap).toEqual([
      { bang: 'incident', id: 'cu', data: { code: '2025-7-2' } },
    ]);
  });

  it('chạy thử (không --apply) → không ghi gì, báo trước số hồ sơ sẽ nhận số mới', async () => {
    const { prisma, dsCap } = prismaGia({
      petition: [
        {
          id: 'moi',
          stt: '2026-11729',
          legacySourceId: null,
          legacyRaw: null,
          sttCu: null,
        },
        {
          id: 'cu',
          stt: 'DT-LEGACY-87538',
          legacySourceId: 'ho_so_doi_1:87538',
          legacyRaw: raw(2026, 11729),
          sttCu: null,
        },
      ],
    });
    const ghiSoMoi: GhiSoMoi = jest.fn().mockResolvedValue('khong-duoc-goi');
    const kq = await buMaHoSo(prisma, false, { ghiSoMoi, namBoDem: 2026 });
    expect(ghiSoMoi).not.toHaveBeenCalled();
    expect(dsCap).toEqual([]);
    expect(kq.donThu.soMoi).toEqual([
      { id: 'cu', soHeCu: '2026-11729', ma: '(số mới từ bộ đếm)' },
    ]);
  });

  it('hai hồ sơ cùng lượt: hồ sơ trước lấy số, hồ sơ sau trùng hồ sơ trước (di trú) → hậu tố', async () => {
    const { prisma, dsCap } = prismaGia({
      incident: [
        {
          id: 'x',
          code: 'VV-LEGACY-1',
          legacySourceId: 'ho_so_doi_1:1',
          legacyRaw: raw(2026, 5),
          sttCu: null,
        },
        {
          id: 'y',
          code: 'VV-LEGACY-2',
          legacySourceId: 'ho_so_doi_1:2',
          legacyRaw: raw(2026, 5),
          sttCu: null,
        },
      ],
    });
    await buMaHoSo(prisma, true, { ghiSoMoi: jest.fn(), namBoDem: 2026 });
    expect(dsCap.map((d) => d.data)).toEqual([
      { code: '2026-5' },
      { code: '2026-5-2' },
    ]);
  });
});
