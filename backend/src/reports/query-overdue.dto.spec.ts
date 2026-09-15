import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryOverdueDto } from './reports.controller';

/**
 * Tầng ValidationPipe của thẻ tìm kiếm Hồ sơ trễ hạn — kiểm bằng đúng cấu hình pipe toàn cục
 * (whitelist + forbidNonWhitelisted). Thiếu khoá `tk` ở DTO thì mọi thẻ của màn là 400 cả danh sách.
 */
async function kiem(giaTri: Record<string, unknown>) {
  const dto = plainToInstance(QueryOverdueDto, giaTri);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('QueryOverdueDto — thẻ tìm kiếm', () => {
  it('một thẻ (`?tk=x`) → mảng một phần tử', async () => {
    const { dto, errors } = await kiem({ tk: 'nguoiGui~an' });
    expect(dto.tk).toEqual(['nguoiGui~an']);
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

  it('`search` cũ vẫn nhận', async () => {
    expect((await kiem({ search: 'an' })).errors).toEqual([]);
  });
});
