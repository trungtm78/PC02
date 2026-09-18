import { duDoanTrungSoHeMoi } from './du-doan-trung-so';

/**
 * `cap-nhat-tu-he-cu --dry` phải cho người duyệt thấy TRƯỚC những hồ sơ hệ cũ mang số đã có hồ sơ
 * hệ mới giữ (đo 18/09/2026: 14 số 2026-11729…11742 của hệ cũ, hệ mới đã cấp đơn thư tới 11913).
 */
describe('duDoanTrungSoHeMoi', () => {
  const prisma = {
    petition: {
      findMany: jest.fn(({ where }: { where: { stt: { in: string[] } } }) =>
        Promise.resolve(
          ['2026-11729', '2026-11732']
            .filter((s) => where.stt.in.includes(s))
            .map((stt) => ({ stt })),
        ),
      ),
    },
    incident: { findMany: jest.fn().mockResolvedValue([]) },
    case: { findMany: jest.fn().mockResolvedValue([]) },
  } as never;

  it('liệt kê hồ sơ hệ cũ trùng số hệ mới, kèm loại hệ cũ và loại hệ mới đang giữ số', async () => {
    const kq = await duDoanTrungSoHeMoi(prisma, [
      { id: 87538, nam: 2026, stt: 11729, loai: 'don_thu' },
      { id: 87541, nam: 2026, stt: 11732, loai: 'vu_viec_da_phan_loai' },
      { id: 87600, nam: 2026, stt: 12000, loai: 'don_thu' },
      { id: 1, loai: 'don_thu' },
    ]);
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
    ]);
  });

  it('không tài liệu nào có năm-stt thì không hỏi CSDL', async () => {
    expect(await duDoanTrungSoHeMoi(prisma, [{ id: 1 }])).toEqual([]);
  });
});
