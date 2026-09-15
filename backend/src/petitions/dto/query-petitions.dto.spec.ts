import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryPetitionsDto } from './query-petitions.dto';

/**
 * Tầng ValidationPipe của thẻ tìm kiếm. Ca kiểm service gọi thẳng `getList(... as never)` nên bỏ
 * qua class-validator — giới hạn ở đây không được ai chốt nếu thiếu tệp này.
 */
async function loi(tk: unknown) {
  const dto = plainToInstance(QueryPetitionsDto, { tk });
  return { dto, errors: await validate(dto) };
}

describe('QueryPetitionsDto.tk', () => {
  it('một giá trị (`?tk=x`) → mảng một phần tử', async () => {
    const { dto, errors } = await loi('nguoiGui~An');
    expect(dto.tk).toEqual(['nguoiGui~An']);
    expect(errors).toEqual([]);
  });

  it('20 thẻ qua, 21 thẻ bị chặn', async () => {
    const hai10 = Array.from({ length: 20 }, (_, i) => `*~v${i}`);
    expect((await loi(hai10)).errors).toEqual([]);
    expect((await loi([...hai10, '*~thua'])).errors).not.toEqual([]);
  });

  it('mục quá dài bị chặn; mục dài 200 ký tự giá trị vẫn qua', async () => {
    expect((await loi([`*~${'a'.repeat(200)}`])).errors).toEqual([]);
    expect((await loi([`*~${'a'.repeat(300)}`])).errors).not.toEqual([]);
  });

  it('không có tk → hợp lệ, không tự tạo mảng rỗng', async () => {
    const dto = plainToInstance(QueryPetitionsDto, {});
    expect(dto.tk).toBeUndefined();
    expect(await validate(dto)).toEqual([]);
  });
});
