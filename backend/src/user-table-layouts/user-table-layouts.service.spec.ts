import { Test } from '@nestjs/testing';
import { UserTableLayoutsService } from './user-table-layouts.service';
import { PrismaService } from '../prisma/prisma.service';
import { BE_RONG_TOI_THIEU } from './bo-cuc-cot.util';

const kho = {
  userTableLayout: {
    findMany: jest.fn(),
    upsert: jest.fn((a: any) => Promise.resolve({ id: 'l1', ...a.create })),
    deleteMany: jest.fn(() => Promise.resolve({ count: 1 })),
  },
};

/**
 * Bố cục cột là dữ liệu RIÊNG của từng người. Hai điều phải đúng tuyệt đối:
 *   • không ai đọc/ghi được bố cục của người khác — mọi truy vấn phải kẹp `userId`
 *   • payload méo không lọt vào cơ sở dữ liệu
 */
describe('UserTableLayoutsService', () => {
  let svc: UserTableLayoutsService;

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [UserTableLayoutsService, { provide: PrismaService, useValue: kho }],
    }).compile();
    svc = mod.get(UserTableLayoutsService);
    jest.clearAllMocks();
  });

  describe('đọc', () => {
    it('chỉ lấy bố cục của chính người dùng ấy', async () => {
      kho.userTableLayout.findMany.mockResolvedValue([]);
      await svc.list('u1');
      expect(kho.userTableLayout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'u1' } }),
      );
    });

    /** Trả về dạng bản đồ theo bảng để giao diện tra thẳng, khỏi lọc mảng ở mọi trang. */
    it('trả về bản đồ theo khoá bảng', async () => {
      kho.userTableLayout.findMany.mockResolvedValue([
        { tableKey: 'petitions', columns: { a: { width: 120 } } },
        { tableKey: 'cases', columns: { b: { hidden: true } } },
      ]);
      expect(await svc.list('u1')).toEqual({
        petitions: { a: { width: 120 } },
        cases: { b: { hidden: true } },
      });
    });

    /**
     * Hàng cũ có thể mang payload méo (lưu trước khi có cổng kiểm, hoặc sửa tay trong cơ sở dữ
     * liệu). Chuẩn hoá cả lúc ĐỌC, không chỉ lúc ghi — nếu không, một hàng hỏng làm vỡ bảng
     * của người ấy vĩnh viễn và không có đường tự thoát.
     */
    it('chuẩn hoá cả khi đọc — hàng cũ méo không làm vỡ bảng', async () => {
      kho.userTableLayout.findMany.mockResolvedValue([
        { tableKey: 'cases', columns: { a: { width: 'to' }, 'b c': { width: 100 }, d: { width: 1 } } },
      ]);
      expect(await svc.list('u1')).toEqual({ cases: { d: { width: BE_RONG_TOI_THIEU } } });
    });
  });

  describe('ghi', () => {
    it('lưu theo cặp (người dùng, bảng), không đè bảng khác', async () => {
      await svc.upsert('u1', 'petitions', { a: { width: 200 } });
      const arg = kho.userTableLayout.upsert.mock.calls[0][0];
      expect(arg.where).toEqual({ userId_tableKey: { userId: 'u1', tableKey: 'petitions' } });
      expect(arg.create).toMatchObject({ userId: 'u1', tableKey: 'petitions' });
    });

    it('payload méo bị chuẩn hoá TRƯỚC khi ghi', async () => {
      await svc.upsert('u1', 'cases', { a: { width: 99999 }, '<x>': { width: 100 } } as never);
      const arg = kho.userTableLayout.upsert.mock.calls[0][0];
      expect(arg.create.columns).toEqual({ a: { width: 1200 } });
      expect(arg.update.columns).toEqual({ a: { width: 1200 } });
    });

    /** Khối rỗng LÀ hợp lệ: người dùng vừa bấm "Về mặc định" cho bảng ấy. */
    it('khối rỗng vẫn ghi được', async () => {
      await svc.upsert('u1', 'cases', {});
      expect(kho.userTableLayout.upsert.mock.calls[0][0].create.columns).toEqual({});
    });

    it('khoá bảng lạ bị từ chối, không ghi gì', async () => {
      await expect(svc.upsert('u1', 'bang-khong-co', {})).rejects.toThrow();
      expect(kho.userTableLayout.upsert).not.toHaveBeenCalled();
    });
  });

  describe('đặt lại', () => {
    it('chỉ xoá bố cục của chính người dùng ấy, đúng một bảng', async () => {
      await svc.reset('u1', 'cases');
      expect(kho.userTableLayout.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', tableKey: 'cases' },
      });
    });

    /** Chưa có hàng nào thì xoá vẫn phải êm — người dùng bấm "Về mặc định" khi chưa chỉnh gì. */
    it('không có gì để xoá vẫn không lỗi', async () => {
      kho.userTableLayout.deleteMany.mockResolvedValue({ count: 0 });
      await expect(svc.reset('u1', 'cases')).resolves.toEqual({ deleted: 0 });
    });

    it('khoá bảng lạ bị từ chối, không xoá gì', async () => {
      await expect(svc.reset('u1', 'bang-khong-co')).rejects.toThrow();
      expect(kho.userTableLayout.deleteMany).not.toHaveBeenCalled();
    });
  });
});
