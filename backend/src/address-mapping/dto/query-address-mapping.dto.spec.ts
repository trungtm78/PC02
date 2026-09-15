import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryAddressMappingDto } from './query-address-mapping.dto';

/**
 * Tầng ValidationPipe của thẻ tìm kiếm Ánh xạ địa chỉ — kiểm bằng đúng cấu hình pipe toàn cục
 * (whitelist + forbidNonWhitelisted).
 */
async function kiem(giaTri: Record<string, unknown>) {
  const dto = plainToInstance(QueryAddressMappingDto, giaTri);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('QueryAddressMappingDto — thẻ tìm kiếm', () => {
  it('một thẻ (`?tk=x`) → mảng một phần tử', async () => {
    const { dto, errors } = await kiem({ tk: 'quanCu~phu nhuan' });
    expect(dto.tk).toEqual(['quanCu~phu nhuan']);
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
    expect((await kiem({ search: 'phú nhuận' })).errors).toEqual([]);
  });
});
