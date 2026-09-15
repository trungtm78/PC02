import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QuerySubjectsDto } from './query-subjects.dto';

/**
 * Tầng ValidationPipe của thẻ tìm kiếm Đối tượng. Ca kiểm service gọi thẳng `getList(... as never)`
 * nên bỏ qua class-validator — giới hạn ở đây không được ai chốt nếu thiếu tệp này.
 */
async function kiem(giaTri: Record<string, unknown>) {
  const dto = plainToInstance(QuerySubjectsDto, giaTri);
  return { dto, errors: await validate(dto) };
}

describe('QuerySubjectsDto', () => {
  it('một thẻ (`?tk=x`) → mảng một phần tử', async () => {
    const { dto, errors } = await kiem({ tk: 'hoTen~An' });
    expect(dto.tk).toEqual(['hoTen~An']);
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

  /**
   * `search` cũ KHÔNG chặn độ dài: máy chủ tự cắt còn 200 ký tự trước khi thành thẻ. Chặn ở DTO là
   * 400 trước khi kịp cắt — GlobalSearchBar gửi nguyên chữ dán, nhóm Đối tượng lặng lẽ biến mất.
   */
  it('`search` dài 300 ký tự vẫn hợp lệ (máy chủ tự cắt)', async () => {
    expect((await kiem({ search: 'a'.repeat(300) })).errors).toEqual([]);
  });
});
