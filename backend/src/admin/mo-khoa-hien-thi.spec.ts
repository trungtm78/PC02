import { AdminService } from './admin.service';

/**
 * Màn quản lý người dùng phải NHÌN THẤY ai đang bị khoá.
 *
 * Thông báo đăng nhập cố ý không nói "đang bị khoá" (chống dò tên đăng nhập), nên danh sách này
 * là chỗ DUY NHẤT trạng thái ấy hiện ra. Thiếu nó thì nút mở khoá thành bấm mù, và người bị khoá
 * vẫn không ai biết.
 *
 * Đúng lớp lỗi "khe hở giữa bộ nạp và bộ đọc": bộ đọc cần cột mà bộ nạp không khai.
 */
describe('Danh sách người dùng trả về trạng thái khoá', () => {
  it('`getUsers` select có `lockedUntil` và `failedLoginAttempts`', async () => {
    const prisma: any = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const svc = new AdminService(prisma, {} as any, {} as any, {} as any);
    await svc.getUsers({} as any);
    const sel = prisma.user.findMany.mock.calls[0][0].select;
    expect(sel.lockedUntil).toBe(true);
    expect(sel.failedLoginAttempts).toBe(true);
  });
});
