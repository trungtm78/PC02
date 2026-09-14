import { Test } from '@nestjs/testing';
import { DirectoryService, LOAI_TAO_NHANH_DUOC } from './directory.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Tạo nhanh mục "Loại thông tin" ngay trên ô tìm của form Đơn thư — cùng cửa hẹp với "Đơn vị xử lý".
 *
 * Khác đơn vị ở hai chỗ, và cả hai đều hỏng LẶNG LẼ nếu dùng chung luật của đơn vị:
 *  1. Khoá gộp: "Tố giác (02 đơn)" là "Tố giác", nhưng luật đơn vị không biết hậu tố đếm đơn.
 *  2. Nhóm hạn: mục mới phải mang `nhomHan`, nếu không hồ sơ chọn nó tính hạn theo nhánh mặc định
 *     dù tên nói rõ là "Tố cáo" (30 ngày) hay "Khiếu nại" (30 ngày).
 */
describe('DirectoryService.taoNhanh — LOAI_THONG_TIN', () => {
  let service: DirectoryService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      directory: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'moi', ...data })),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [DirectoryService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(DirectoryService);
  });

  it('nằm trong danh sách loại được tạo nhanh', () => {
    expect(LOAI_TAO_NHANH_DUOC).toEqual(expect.arrayContaining(['DON_VI', 'LOAI_THONG_TIN']));
  });

  it('tạo mục mới với mã tiền tố riêng, vào nhóm chờ duyệt', async () => {
    const ra = await service.taoNhanh({ type: 'LOAI_THONG_TIN', name: 'Xin trích lục hồ sơ' });
    expect(ra.code).toMatch(/^LTT\d{4,}$/);
    const { data } = prisma.directory.create.mock.calls.at(-1)![0];
    expect(data.metadata).toMatchObject({ nguon: 'tao-nhanh', choDuyet: true, nhomHan: 'PHAN_ANH' });
    expect(data.order).toBeGreaterThanOrEqual(9000);
  });

  it.each([
    ['Tố cáo cán bộ xã', 'TO_CAO'],
    ['Khiếu nại (QĐ tố tụng)', 'KHIEU_NAI'],
    ['Kiến nghị khởi tố', 'KIEN_NGHI'],
  ])('"%s" → nhomHan %s', async (ten, nhom) => {
    await service.taoNhanh({ type: 'LOAI_THONG_TIN', name: ten });
    const { data } = prisma.directory.create.mock.calls.at(-1)![0];
    expect(data.metadata.nhomHan).toBe(nhom);
  });

  it.each(['tố giác', 'Tố giác (02 đơn)', 'Tố giác.'])(
    '"%s" khi đã có "Tố giác" → trả mục cũ, không tạo bản sao',
    async (ten) => {
      prisma.directory.findMany.mockResolvedValue([
        { id: 'cu', type: 'LOAI_THONG_TIN', code: 'LTT0001', name: 'Tố giác', isActive: true },
      ]);
      const ra = await service.taoNhanh({ type: 'LOAI_THONG_TIN', name: ten });
      expect(ra).toMatchObject({ id: 'cu', daCoSan: true });
      expect(prisma.directory.create).not.toHaveBeenCalled();
    },
  );

  it('sinh mã từ mã lớn nhất của ĐÚNG loại này', async () => {
    prisma.directory.findMany.mockResolvedValue([
      { id: 'a', type: 'LOAI_THONG_TIN', code: 'LTT0041', name: 'Đề nghị', isActive: true },
    ]);
    const ra = await service.taoNhanh({ type: 'LOAI_THONG_TIN', name: 'Trình báo' });
    expect(ra.code).toBe('LTT0042');
  });

  /** Luật đơn vị không được đổi: "Phòng PC01" vẫn gộp với "PC01" ở danh mục đơn vị. */
  it('không làm đổi luật gộp của DON_VI', async () => {
    prisma.directory.findMany.mockResolvedValue([
      { id: 'pc01', type: 'DON_VI', code: 'DV0001', name: 'PC01 Công an TP. HCM', isActive: true },
    ]);
    const ra = await service.taoNhanh({ type: 'DON_VI', name: 'Phòng PC01 Công an TP. Hồ Chí Minh' });
    expect(ra).toMatchObject({ id: 'pc01', daCoSan: true });
  });
});
