import { NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';

/**
 * Mở khoá tài khoản bị khoá vì đăng nhập sai nhiều lần.
 *
 * ── Vì sao cần ──
 *
 * Sai 5 lần liên tiếp là khoá 15 phút. Thông báo trả về CỐ Ý giữ nguyên "Invalid credentials"
 * để không lộ rằng tài khoản ấy có tồn tại (chống dò tên đăng nhập) — nên người bị khoá KHÔNG
 * biết mình bị khoá, họ tưởng gõ sai mật khẩu và thử mãi.
 *
 * Trước bản này, cả hệ thống KHÔNG có đường mở khoá nào: chờ đủ 15 phút, hoặc phải vào tận CSDL.
 * Ngày 29/08/2026 chính tài khoản quản trị bị khoá và phải mở bằng SQL trên máy thật. Với 238
 * cán bộ sắp dùng, đó là việc sẽ lặp lại hằng tuần.
 */
describe('AdminService.moKhoaTaiKhoan', () => {
  function dung() {
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          username: 'canbo',
          failedLoginAttempts: 5,
          lockedUntil: new Date('2099-01-01'),
        }),
        update: jest.fn().mockImplementation((a: any) => Promise.resolve({ id: 'u1', ...a.data })),
      },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    // Hai phụ thuộc cuối không tham gia luồng mở khoá — truyền rỗng cho rõ ý.
    const svc = new AdminService(prisma, audit as any, {} as any, {} as any);
    return { prisma, audit, svc };
  }

  it('xoá cả bộ đếm sai lẫn mốc khoá', async () => {
    const { prisma, svc } = dung();
    await svc.moKhoaTaiKhoan('u1', 'admin1');
    expect(prisma.user.update.mock.calls[0][0]).toMatchObject({
      where: { id: 'u1' },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  });

  /**
   * Chỉ xoá mốc khoá mà để bộ đếm ở 5 thì lần gõ sai KẾ TIẾP khoá lại ngay — mở khoá thành ra
   * vô nghĩa. Hai thứ phải đi cùng nhau.
   */
  it('bộ đếm phải về 0, không chỉ gỡ mốc khoá', async () => {
    const { prisma, svc } = dung();
    await svc.moKhoaTaiKhoan('u1', 'admin1');
    expect(prisma.user.update.mock.calls[0][0].data.failedLoginAttempts).toBe(0);
  });

  /** Mở khoá là một can thiệp lên tài khoản người khác — phải để lại dấu vết. */
  it('ghi nhật ký kèm ai mở cho ai', async () => {
    const { audit, svc } = dung();
    await svc.moKhoaTaiKhoan('u1', 'admin1');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin1',
        action: 'ADMIN_UNLOCK_ACCOUNT',
        subjectId: 'u1',
      }),
    );
  });

  it('tài khoản không tồn tại thì báo rõ, không ghi gì', async () => {
    const { prisma, audit, svc } = dung();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(svc.moKhoaTaiKhoan('lung-tung', 'admin1')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  /** Tài khoản đang bình thường vẫn mở được — không ném, để nút bấm lúc nào cũng an toàn. */
  it('tài khoản KHÔNG bị khoá thì vẫn chạy êm', async () => {
    const { prisma, svc } = dung();
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      username: 'canbo',
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
    await expect(svc.moKhoaTaiKhoan('u1', 'admin1')).resolves.toMatchObject({ success: true });
    expect(prisma.user.update).toHaveBeenCalled();
  });
});
