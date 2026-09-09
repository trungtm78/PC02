import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DirectoryService } from './directory.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Tạo nhanh đơn vị xử lý ngay trên ô tìm.
 *
 * Hai thứ dễ hỏng và cùng hỏng LẶNG LẼ:
 *  1. Không chặn trùng → danh mục vừa dọn (3.806 tên thô → 2.812 đơn vị) phình lại y như cũ,
 *     và báo cáo theo đơn vị đếm sai vì một đơn vị nằm ở ba dòng.
 *  2. Sinh mã bằng cách ĐẾM số dòng → hai cán bộ tạo cùng lúc ra cùng một mã, hoặc sau khi xoá
 *     một dòng thì mã kế tiếp đụng mã đã có.
 */
describe('DirectoryService.taoNhanh', () => {
  let service: DirectoryService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      directory: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'd1', ...data })),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [DirectoryService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(DirectoryService);
  });

  it('tạo được đơn vị mới với mã sinh tự động', async () => {
    const ra = await service.taoNhanh({ type: 'DON_VI', name: 'Công an phường Bến Nghé' });
    expect(ra).toMatchObject({ type: 'DON_VI', name: 'Công an phường Bến Nghé' });
    expect(ra.code).toMatch(/^DV\d{4,}$/);
  });

  it('sinh mã từ mã LỚN NHẤT đang có, không phải từ số lượng dòng', async () => {
    // Danh mục có 2 dòng nhưng mã cao nhất là DV0500 — đếm dòng sẽ sinh DV0003, đụng mã cũ khi
    // dòng ấy tồn tại, hoặc tạo lỗ hổng khó lần khi không.
    prisma.directory.findMany.mockResolvedValue([{ code: 'DV0500', name: 'Đơn vị cũ' }]);
    const ra = await service.taoNhanh({ type: 'DON_VI', name: 'Đơn vị mới' });
    expect(ra.code).toBe('DV0501');
  });

  describe('chặn trùng', () => {
    const daCo = {
      id: 'cu-1',
      type: 'DON_VI',
      code: 'DV0007',
      name: 'Công an Phường Bàn Cờ',
      isActive: true,
    };

    /**
     * Ba cách viết dưới đây đều là CÙNG một đơn vị trong dữ liệu thật hệ cũ. Chặn bằng so chuỗi
     * thô sẽ để lọt cả ba.
     */
    it.each([
      'công an phường bàn cờ',
      'BCH Công an phường Bàn Cờ',
      '  Công an   Phường Bàn Cờ  ',
    ])('%s → trả về đơn vị ĐÃ CÓ, không tạo bản sao', async (ten) => {
      prisma.directory.findMany.mockResolvedValue([daCo]);
      const ra = await service.taoNhanh({ type: 'DON_VI', name: ten });
      expect(ra.id).toBe('cu-1');
      expect(ra.daCoSan).toBe(true);
      expect(prisma.directory.create).not.toHaveBeenCalled();
    });

    it('tên KHÁC thì vẫn tạo bình thường', async () => {
      prisma.directory.findMany.mockResolvedValue([daCo]);
      const ra = await service.taoNhanh({ type: 'DON_VI', name: 'Công an phường Bến Nghé' });
      expect(prisma.directory.create).toHaveBeenCalled();
      expect(ra.daCoSan).toBeUndefined();
    });
  });

  /**
   * Cửa hẹp: endpoint này mở cho quyền `write:Petition` (cán bộ có sẵn) thay vì
   * `write:Directory` (chỉ ADMIN). Mở rộng ra mọi loại danh mục là cho cán bộ sửa cả danh mục
   * pháp lý — nên danh sách loại cho phép phải được cưỡng chế ở tầng dịch vụ, không chỉ ở DTO.
   */
  it('từ chối loại danh mục ngoài danh sách cho phép', async () => {
    await expect(
      service.taoNhanh({ type: 'DOCUMENT_TYPE', name: 'Loại gì đó' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.directory.create).not.toHaveBeenCalled();
  });

  it('tên rỗng thì từ chối, không tạo dòng trắng trong danh mục', async () => {
    await expect(service.taoNhanh({ type: 'DON_VI', name: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
