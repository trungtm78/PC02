import { UserTableLayoutsController } from './user-table-layouts.controller';
import type { UserTableLayoutsService } from './user-table-layouts.service';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

/**
 * Controller chỉ làm hai việc: lấy người dùng từ TOKEN (không bao giờ từ tham số) và chuyển đúng bảng/giá trị
 * xuống service. Nhận người dùng từ tham số là mở đường cho một người sửa tuỳ chọn của người khác.
 */
describe('UserTableLayoutsController', () => {
  const service = {
    list: jest.fn().mockResolvedValue({}),
    upsert: jest.fn().mockResolvedValue({}),
    reset: jest.fn().mockResolvedValue({ deleted: 1 }),
    listMatDo: jest.fn().mockResolvedValue({ petitions: 'gon' }),
    luuMatDo: jest.fn().mockResolvedValue({}),
  };
  const ctrl = new UserTableLayoutsController(
    service as unknown as UserTableLayoutsService,
  );
  const nguoi = { id: 'u1' } as AuthUser;
  const req = { user: { id: 'u1' } };

  beforeEach(() => jest.clearAllMocks());

  it('bố cục cột: đọc / ghi / đặt lại theo người trong token', async () => {
    await ctrl.list(req);
    expect(service.list).toHaveBeenCalledWith('u1');
    await ctrl.luu(req, 'cases', { columns: { a: { width: 120 } } });
    expect(service.upsert).toHaveBeenCalledWith('u1', 'cases', {
      a: { width: 120 },
    });
    await ctrl.datLai(req, 'cases');
    expect(service.reset).toHaveBeenCalledWith('u1', 'cases');
  });

  it('mật độ dòng: đọc và ghi theo người trong token', async () => {
    expect(await ctrl.listMatDo(nguoi)).toEqual({ petitions: 'gon' });
    expect(service.listMatDo).toHaveBeenCalledWith('u1');
    await ctrl.luuMatDo(nguoi, 'incidents', { matDo: 'day-du' });
    expect(service.luuMatDo).toHaveBeenCalledWith('u1', 'incidents', 'day-du');
  });
});
