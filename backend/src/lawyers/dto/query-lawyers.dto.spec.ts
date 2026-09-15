import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryLawyersDto } from './query-lawyers.dto';

/**
 * Tầng ValidationPipe của thẻ tìm kiếm Luật sư. Ca kiểm service gọi thẳng `getList(... as never)`
 * nên bỏ qua class-validator — giới hạn ở đây không được ai chốt nếu thiếu tệp này.
 */
async function kiem(giaTri: Record<string, unknown>) {
  const dto = plainToInstance(QueryLawyersDto, giaTri);
  return { dto, errors: await validate(dto) };
}

describe('QueryLawyersDto', () => {
  it('một thẻ (`?tk=x`) → mảng một phần tử', async () => {
    const { dto, errors } = await kiem({ tk: 'soThe~LS-1' });
    expect(dto.tk).toEqual(['soThe~LS-1']);
    expect(errors).toEqual([]);
  });

  it('20 thẻ qua, 21 thẻ bị chặn; mục quá dài bị chặn', async () => {
    const hai10 = Array.from({ length: 20 }, (_, i) => `*~v${i}`);
    expect((await kiem({ tk: hai10 })).errors).toEqual([]);
    expect((await kiem({ tk: [...hai10, '*~thua'] })).errors).not.toEqual([]);
    expect((await kiem({ tk: [`*~${'a'.repeat(300)}`] })).errors).not.toEqual(
      [],
    );
  });

  it('`search` dài 300 ký tự vẫn hợp lệ (máy chủ tự cắt còn 200)', async () => {
    expect((await kiem({ search: 'a'.repeat(300) })).errors).toEqual([]);
  });
});
