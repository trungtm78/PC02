import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateDelegationDto } from './update-delegation.dto';

/**
 * Lệnh sửa từng nhận `Partial<CreateDelegationDto>` — kiểu ấy biến mất lúc chạy nên ValidationPipe không
 * kiểm gì: `status: 'pending'` đi thẳng vào Prisma (500). DTO sửa phải kiểm như DTO tạo, mọi trường tuỳ chọn.
 */
describe('UpdateDelegationDto', () => {
  const loi = async (o: object) =>
    (await validate(plainToInstance(UpdateDelegationDto, o))).map(
      (e) => e.property,
    );

  it('trạng thái chữ thường → lỗi; mã enum → hợp lệ; mọi trường tuỳ chọn', async () => {
    expect(await loi({ status: 'pending' })).toEqual(['status']);
    expect(await loi({ status: 'RECEIVED' })).toEqual([]);
    expect(await loi({})).toEqual([]);
  });
});
