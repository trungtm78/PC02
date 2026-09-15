import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryUsersDto } from './query-users.dto';

/**
 * Hợp đồng tham số `GET /admin/users` — kiểm bằng ĐÚNG cấu hình ValidationPipe toàn cục
 * (`main.ts`: whitelist + forbidNonWhitelisted). Màn Quản lý người dùng từng gửi `isActive`, khoá
 * không có ở đây, nên máy chủ trả 400 cho cả danh sách mỗi khi cán bộ lọc trạng thái.
 */
async function kiem(giaTri: Record<string, unknown>) {
  const dto = plainToInstance(QueryUsersDto, giaTri);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

describe('QueryUsersDto', () => {
  it('nhận `status` = active | inactive', async () => {
    expect(await kiem({ status: 'active' })).toEqual([]);
    expect(await kiem({ status: 'inactive' })).toEqual([]);
  });

  it('từ chối `isActive` (khoá không khai) — giao diện phải gửi `status`', async () => {
    const loi = await kiem({ isActive: 'true' });
    expect(loi.map((l) => l.property)).toContain('isActive');
  });

  it('từ chối `status` ngoài danh sách', async () => {
    const loi = await kiem({ status: 'ACTIVE' });
    expect(loi.map((l) => l.property)).toContain('status');
  });
});
