import { duDoanTrungSoHeMoi } from './du-doan-trung-so';

/**
 * `cap-nhat-tu-he-cu --dry` phải cho người duyệt thấy TRƯỚC những hồ sơ hệ cũ mang số đang là số HỆ
 * MỚI (đo 18/09/2026: 14 số 2026-11729…11742 của hệ cũ, hệ mới đã cấp đơn thư tới 11926) — cùng luật
 * với bước ghi `buMaHoSo`.
 */
describe('duDoanTrungSoHeMoi', () => {
  const donThu = [
    { stt: '2026-11729', legacySourceId: null, legacyRaw: null },
    { stt: '2026-11732', legacySourceId: null, legacyRaw: null },
    // Số bộ đếm đã cấp cho một hồ sơ di trú trước đó — cũng là số hệ mới.
    {
      stt: '2026-11914',
      legacySourceId: 'ho_so_doi_1:87544',
      legacyRaw: { nam: 2026, stt: 11735 },
    },
    // Hồ sơ di trú giữ đúng số hệ cũ của nó — KHÔNG phải số hệ mới.
    {
      stt: '2026-11740',
      legacySourceId: 'ho_so_doi_1:87549',
      legacyRaw: { nam: 2026, stt: 11740 },
    },
  ];
  const prisma = {
    petition: {
      findMany: jest.fn(({ where }: { where: { stt: { in: string[] } } }) =>
        Promise.resolve(donThu.filter((d) => where.stt.in.includes(d.stt))),
      ),
    },
    incident: { findMany: jest.fn().mockResolvedValue([]) },
    case: { findMany: jest.fn().mockResolvedValue([]) },
  } as never;

  it('liệt kê hồ sơ hệ cũ trùng số hệ mới, kèm loại hệ cũ và loại hệ mới đang giữ số', async () => {
    const kq = await duDoanTrungSoHeMoi(
      prisma,
      [
        { id: 87538, nam: 2026, stt: 11729, loai: 'don_thu' },
        { id: 87541, nam: 2026, stt: 11732, loai: 'vu_viec_da_phan_loai' },
        { id: 87600, nam: 2026, stt: 11914, loai: 'don_thu' },
        { id: 87601, nam: 2026, stt: 11740, loai: 'don_thu' },
        { id: 87602, nam: 2026, stt: 12000, loai: 'don_thu' },
        { id: 1, loai: 'don_thu' },
      ],
      2026,
    );
    expect(kq).toEqual([
      {
        sourceId: '87538',
        soHeCu: '2026-11729',
        loaiHeCu: 'don_thu',
        bangHeMoi: ['Đơn thư'],
      },
      {
        sourceId: '87541',
        soHeCu: '2026-11732',
        loaiHeCu: 'vu_viec_da_phan_loai',
        bangHeMoi: ['Đơn thư'],
      },
      {
        sourceId: '87600',
        soHeCu: '2026-11914',
        loaiHeCu: 'don_thu',
        bangHeMoi: ['Đơn thư'],
      },
    ]);
  });

  it('số gốc khác năm bộ đếm không vào danh sách (bước ghi dùng hậu tố)', async () => {
    expect(
      await duDoanTrungSoHeMoi(
        prisma,
        [{ id: 5, nam: 2025, stt: 11729, loai: 'don_thu' }],
        2026,
      ),
    ).toEqual([]);
  });

  it('không tài liệu nào có năm-stt thì không hỏi CSDL', async () => {
    expect(await duDoanTrungSoHeMoi(prisma, [{ id: 1 }], 2026)).toEqual([]);
  });
});
