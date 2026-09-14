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
interface DuLieuTao {
  data: { code: string; order: number; metadata: Record<string, unknown> };
}
interface MucDangCo {
  id: string;
  type: string;
  code: string;
  name: string;
  isActive: boolean;
}
interface PrismaGia {
  directory: {
    findMany: jest.Mock<Promise<MucDangCo[]>, []>;
    create: jest.Mock<Promise<unknown>, [DuLieuTao]>;
  };
}

const trungMa = () =>
  Object.assign(new Error('Unique constraint'), { code: 'P2002' });
const muc = (
  id: string,
  code: string,
  name: string,
  type = 'LOAI_THONG_TIN',
): MucDangCo => ({
  id,
  type,
  code,
  name,
  isActive: true,
});

describe('DirectoryService.taoNhanh — LOAI_THONG_TIN', () => {
  let service: DirectoryService;
  let prisma: PrismaGia;
  const lanTaoCuoi = () => prisma.directory.create.mock.calls.at(-1)![0].data;

  beforeEach(async () => {
    prisma = {
      directory: {
        findMany: jest.fn<Promise<MucDangCo[]>, []>().mockResolvedValue([]),
        create: jest
          .fn<Promise<unknown>, [DuLieuTao]>()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'moi', ...data }),
          ),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [
        DirectoryService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = mod.get(DirectoryService);
  });

  it('nằm trong danh sách loại được tạo nhanh', () => {
    expect(LOAI_TAO_NHANH_DUOC).toEqual(
      expect.arrayContaining(['DON_VI', 'LOAI_THONG_TIN']),
    );
  });

  it('tạo mục mới với mã tiền tố riêng, vào nhóm chờ duyệt', async () => {
    const ra = await service.taoNhanh({
      type: 'LOAI_THONG_TIN',
      name: 'Xin trích lục hồ sơ',
    });
    expect(ra.code).toMatch(/^LTT\d{4,}$/);
    expect(lanTaoCuoi().metadata).toMatchObject({
      nguon: 'tao-nhanh',
      choDuyet: true,
      nhomHan: 'PHAN_ANH',
    });
    expect(lanTaoCuoi().order).toBeGreaterThanOrEqual(9000);
  });

  it.each([
    ['Tố cáo cán bộ xã', 'TO_CAO'],
    ['Khiếu nại (QĐ tố tụng)', 'KHIEU_NAI'],
    ['Kiến nghị khởi tố', 'KIEN_NGHI'],
  ])('"%s" → nhomHan %s', async (ten, nhom) => {
    await service.taoNhanh({ type: 'LOAI_THONG_TIN', name: ten });
    expect(lanTaoCuoi().metadata).toMatchObject({ nhomHan: nhom });
  });

  it.each(['tố giác', 'Tố giác (02 đơn)', 'Tố giác.'])(
    '"%s" khi đã có "Tố giác" → trả mục cũ, không tạo bản sao',
    async (ten) => {
      prisma.directory.findMany.mockResolvedValue([
        muc('cu', 'LTT0001', 'Tố giác'),
      ]);
      const ra = await service.taoNhanh({ type: 'LOAI_THONG_TIN', name: ten });
      expect(ra).toMatchObject({ id: 'cu', daCoSan: true });
      expect(prisma.directory.create).not.toHaveBeenCalled();
    },
  );

  it('sinh mã từ mã lớn nhất của ĐÚNG loại này', async () => {
    prisma.directory.findMany.mockResolvedValue([
      muc('a', 'LTT0041', 'Đề nghị'),
    ]);
    const ra = await service.taoNhanh({
      type: 'LOAI_THONG_TIN',
      name: 'Trình báo',
    });
    expect(ra.code).toBe('LTT0042');
  });

  /**
   * Cửa này mở cho `write:Petition`. Tra luật bằng khoá của object: không có `hasOwnProperty` thì
   * "constructor"/"__proto__" lấy được giá trị kế thừa và lọt qua danh sách cho phép.
   */
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'loại "%s" (khoá kế thừa của object) bị từ chối',
    async (type) => {
      await expect(service.taoNhanh({ type, name: 'x' })).rejects.toThrow(
        /Không tạo nhanh được/,
      );
      expect(prisma.directory.create).not.toHaveBeenCalled();
    },
  );

  /**
   * Soát 15/09/2026: đọc mã lớn nhất rồi mới ghi — hai cán bộ tạo cùng lúc ra cùng mã, người sau
   * nhận 409 "giá trị đã tồn tại" khó hiểu. Đụng mã thì đọc lại và thử lần nữa.
   */
  it('đụng mã (P2002) → đọc lại danh mục, sinh mã mới, tạo được', async () => {
    prisma.directory.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([muc('khac', 'LTT0001', 'Trình báo')]);
    prisma.directory.create.mockRejectedValueOnce(trungMa());

    const ra = await service.taoNhanh({
      type: 'LOAI_THONG_TIN',
      name: 'Kêu cứu',
    });

    expect(ra.code).toBe('LTT0002');
    expect(prisma.directory.create).toHaveBeenCalledTimes(2);
  });

  it('đụng mã vì người khác vừa tạo CÙNG loại → trả mục của họ (daCoSan)', async () => {
    prisma.directory.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([muc('ho', 'LTT0001', 'Kêu cứu')]);
    prisma.directory.create.mockRejectedValueOnce(trungMa());

    const ra = await service.taoNhanh({
      type: 'LOAI_THONG_TIN',
      name: 'kêu cứu',
    });

    expect(ra).toMatchObject({ id: 'ho', daCoSan: true });
    expect(prisma.directory.create).toHaveBeenCalledTimes(1);
  });

  it('đụng mã mãi (3 lần) → ném lỗi, không lặp vô hạn', async () => {
    const loi = trungMa();
    prisma.directory.create.mockRejectedValue(loi);
    await expect(
      service.taoNhanh({ type: 'LOAI_THONG_TIN', name: 'Kêu cứu' }),
    ).rejects.toBe(loi);
    expect(prisma.directory.create).toHaveBeenCalledTimes(3);
  });

  it('lỗi khác P2002 → ném ngay, không thử lại', async () => {
    const loiKhac = new Error('mất kết nối');
    prisma.directory.create.mockRejectedValueOnce(loiKhac);
    await expect(
      service.taoNhanh({ type: 'LOAI_THONG_TIN', name: 'Kêu cứu' }),
    ).rejects.toBe(loiKhac);
    expect(prisma.directory.create).toHaveBeenCalledTimes(1);
  });

  /** Luật đơn vị không được đổi: "Phòng PC01" vẫn gộp với "PC01" ở danh mục đơn vị. */
  it('không làm đổi luật gộp của DON_VI', async () => {
    prisma.directory.findMany.mockResolvedValue([
      muc('pc01', 'DV0001', 'PC01 Công an TP. HCM', 'DON_VI'),
    ]);
    const ra = await service.taoNhanh({
      type: 'DON_VI',
      name: 'Phòng PC01 Công an TP. Hồ Chí Minh',
    });
    expect(ra).toMatchObject({ id: 'pc01', daCoSan: true });
  });
});
