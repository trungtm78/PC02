import { BadRequestException } from '@nestjs/common';
import {
  UserExportPreferencesService,
  THUC_THE_HOP_LE,
} from './user-export-preferences.service';

/**
 * Lựa chọn in chứng từ, riêng từng cán bộ.
 *
 * Rủi ro lớn nhất KHÔNG phải là quên lưu — mà là **đọc hoặc ghi đè lựa chọn của người khác**.
 * Mọi truy vấn phải kẹp `userId`; thiếu một chỗ là cán bộ này thấy cấu hình của cán bộ kia.
 */
function dungService() {
  const prisma: any = {
    userExportPreference: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockImplementation((a: any) => Promise.resolve(a)),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return { prisma, svc: new UserExportPreferencesService(prisma) };
}

describe('UserExportPreferencesService', () => {
  it('khai đủ ba thực thể có popup In chứng từ', () => {
    expect([...THUC_THE_HOP_LE].sort()).toEqual(['DON_THU', 'VU_AN', 'VU_VIEC']);
  });

  describe('list', () => {
    it('CHỈ đọc của chính người ấy', async () => {
      const { prisma, svc } = dungService();
      await svc.list('u1');
      expect(prisma.userExportPreference.findMany.mock.calls[0][0].where).toEqual({ userId: 'u1' });
    });

    /** Trả bản đồ để popup tra thẳng theo thực thể, khỏi lọc mảng ở ba màn. */
    it('trả bản đồ theo thực thể', async () => {
      const { prisma, svc } = dungService();
      prisma.userExportPreference.findMany.mockResolvedValue([
        { entityType: 'DON_THU', templateIds: ['t1'], mode: 'merged' },
        { entityType: 'VU_AN', templateIds: ['t9'], mode: 'zip' },
      ]);
      expect(await svc.list('u1')).toEqual({
        DON_THU: { templateIds: ['t1'], mode: 'merged' },
        VU_AN: { templateIds: ['t9'], mode: 'zip' },
      });
    });

    /**
     * Chuẩn hoá CẢ KHI ĐỌC. Hàng cũ có thể mang chế độ lạ hoặc mã mẫu rác (lưu trước khi có cổng,
     * hoặc sửa tay trong CSDL). Không lọc ở đây thì một hàng hỏng làm vỡ popup của người ấy vĩnh
     * viễn — và họ không có đường tự thoát.
     */
    it('chuẩn hoá khi ĐỌC, không chỉ khi ghi', async () => {
      const { prisma, svc } = dungService();
      prisma.userExportPreference.findMany.mockResolvedValue([
        { entityType: 'DON_THU', templateIds: ['t1', '', 5, 't1'], mode: 'lạ' },
      ]);
      expect(await svc.list('u1')).toEqual({
        DON_THU: { templateIds: ['t1'], mode: 'separate' },
      });
    });

    it('chưa lưu gì thì trả bản đồ rỗng, không ném', async () => {
      const { svc } = dungService();
      expect(await svc.list('u1')).toEqual({});
    });
  });

  describe('upsert', () => {
    it('ghi theo đúng cặp (người, thực thể)', async () => {
      const { prisma, svc } = dungService();
      await svc.upsert('u1', 'DON_THU', { templateIds: ['t1'], mode: 'zip' });
      const arg = prisma.userExportPreference.upsert.mock.calls[0][0];
      expect(arg.where).toEqual({ userId_entityType: { userId: 'u1', entityType: 'DON_THU' } });
      expect(arg.create).toMatchObject({ userId: 'u1', entityType: 'DON_THU', mode: 'zip' });
      expect(arg.update).toMatchObject({ templateIds: ['t1'], mode: 'zip' });
    });

    it('payload méo được chuẩn hoá TRƯỚC khi ghi', async () => {
      const { prisma, svc } = dungService();
      await svc.upsert('u1', 'DON_THU', { templateIds: ['t1', null, 't1'], mode: 'bịa' });
      expect(prisma.userExportPreference.upsert.mock.calls[0][0].create).toMatchObject({
        templateIds: ['t1'],
        mode: 'separate',
      });
    });

    /** Bỏ tích hết rồi xuất là một lựa chọn có thật — phải ghi được, không coi là rỗng vô nghĩa. */
    it('ghi được lựa chọn KHÔNG mẫu nào', async () => {
      const { prisma, svc } = dungService();
      await svc.upsert('u1', 'DON_THU', { templateIds: [], mode: 'merged' });
      expect(prisma.userExportPreference.upsert.mock.calls[0][0].create.templateIds).toEqual([]);
    });

    /**
     * Không chặn thì mỗi lỗi đánh máy ở giao diện sinh một hàng rác vĩnh viễn, và bảng thành chỗ
     * nhét dữ liệu tuỳ ý theo tài khoản.
     */
    it('thực thể lạ bị từ chối', async () => {
      const { prisma, svc } = dungService();
      await expect(svc.upsert('u1', 'VU_LINH_TINH', { templateIds: [] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.userExportPreference.upsert).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('xoá đúng của người ấy và đúng thực thể ấy', async () => {
      const { prisma, svc } = dungService();
      expect(await svc.reset('u1', 'VU_AN')).toEqual({ deleted: 1 });
      expect(prisma.userExportPreference.deleteMany.mock.calls[0][0].where).toEqual({
        userId: 'u1',
        entityType: 'VU_AN',
      });
    });

    it('chưa có gì để xoá thì không lỗi', async () => {
      const { prisma, svc } = dungService();
      prisma.userExportPreference.deleteMany.mockResolvedValue({ count: 0 });
      expect(await svc.reset('u1', 'VU_AN')).toEqual({ deleted: 0 });
    });

    it('thực thể lạ bị từ chối', async () => {
      const { prisma, svc } = dungService();
      await expect(svc.reset('u1', 'X')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.userExportPreference.deleteMany).not.toHaveBeenCalled();
    });
  });
});
