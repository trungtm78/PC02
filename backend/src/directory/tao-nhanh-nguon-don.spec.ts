import { Test } from '@nestjs/testing';
import { DirectoryService, LOAI_TAO_NHANH_DUOC } from './directory.service';
import { PrismaService } from '../prisma/prisma.service';
import { LOAI_DANH_MUC_NGUON_DON } from '../common/utils/nguon-don.util';

/**
 * Tạo nhanh mục "Nguồn đơn/Đơn vị giao" ngay trên ô tìm của form Đơn thư.
 *
 * Hệ cũ để ô này là chữ tự do. Đo trên bản chạy thật 20/09/2026: 47.456 đơn có giá trị nhưng
 * **1.431 cách viết** cho cùng vài chục nguồn — vừa mất thời gian gõ, vừa hỏng thống kê.
 *
 * Khác "Đơn vị xử lý" ở một chỗ quyết định: mục mới phải mang cờ `laTrucTiep` ngay, vì cờ ấy
 * quyết định nhóm thông tin định danh có bung ra không VÀ Số điện thoại nguyên đơn có bắt buộc
 * không. Suy từ tên nên không ai quên gắn được.
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

describe('DirectoryService.taoNhanh — NGUON_DON', () => {
  let service: DirectoryService;
  let prisma: {
    directory: {
      findMany: jest.Mock<Promise<MucDangCo[]>, []>;
      create: jest.Mock<Promise<unknown>, [DuLieuTao]>;
    };
  };
  const lanTaoCuoi = () => prisma.directory.create.mock.calls.at(-1)![0].data;

  beforeEach(async () => {
    prisma = {
      directory: {
        findMany: jest.fn<Promise<MucDangCo[]>, []>().mockResolvedValue([]),
        create: jest
          .fn<Promise<unknown>, [DuLieuTao]>()
          .mockImplementation(({ data }) => Promise.resolve({ id: 'moi', ...data })),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [DirectoryService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(DirectoryService);
  });

  it('nằm trong danh sách loại được tạo nhanh', () => {
    expect(LOAI_TAO_NHANH_DUOC).toEqual(expect.arrayContaining([LOAI_DANH_MUC_NGUON_DON]));
  });

  it('sinh mã mang tiền tố ND', async () => {
    await service.taoNhanh({ type: LOAI_DANH_MUC_NGUON_DON, name: 'Bưu điện' });
    expect(lanTaoCuoi().code).toMatch(/^ND/);
  });

  it('mục tên "Trực tiếp" TỰ mang cờ laTrucTiep — không ai quên gắn được', async () => {
    await service.taoNhanh({ type: LOAI_DANH_MUC_NGUON_DON, name: 'Trực tiếp' });
    expect(lanTaoCuoi().metadata).toMatchObject({ laTrucTiep: true });
  });

  it('biến thể "Nộp trực tiếp tại trụ sở" cũng mang cờ', async () => {
    await service.taoNhanh({ type: LOAI_DANH_MUC_NGUON_DON, name: 'Nộp trực tiếp tại trụ sở' });
    expect(lanTaoCuoi().metadata).toMatchObject({ laTrucTiep: true });
  });

  it('nguồn KHÔNG trực tiếp mang cờ false, không phải thiếu khoá', async () => {
    // Thiếu khoá và `false` khác nhau ở chỗ đọc: thiếu khoá buộc mọi nơi dùng phải tự đỡ.
    await service.taoNhanh({ type: LOAI_DANH_MUC_NGUON_DON, name: 'Bưu điện' });
    expect(lanTaoCuoi().metadata).toMatchObject({ laTrucTiep: false });
  });

  it('tên chỉ khác dấu/hoa thường thì KHÔNG tạo bản trùng', async () => {
    prisma.directory.findMany.mockResolvedValue([
      { id: 'cu', type: LOAI_DANH_MUC_NGUON_DON, code: 'ND0001', name: 'Trực tiếp', isActive: true },
    ]);
    const ra = await service.taoNhanh({ type: LOAI_DANH_MUC_NGUON_DON, name: 'trực tiếp' });
    expect(ra.daCoSan).toBe(true);
    expect(prisma.directory.create).not.toHaveBeenCalled();
  });

  it('gộp được cả biến thể viết tắt đơn vị — "PC01 CA TP.HCM" và bản đầy đủ là MỘT', async () => {
    prisma.directory.findMany.mockResolvedValue([
      {
        id: 'cu',
        type: LOAI_DANH_MUC_NGUON_DON,
        code: 'ND0002',
        name: 'PC01 CA TP. Hồ Chí Minh',
        isActive: true,
      },
    ]);
    const ra = await service.taoNhanh({ type: LOAI_DANH_MUC_NGUON_DON, name: 'PC01 CA TP.HCM' });
    expect(ra.daCoSan).toBe(true);
  });
});
