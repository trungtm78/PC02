import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryDaXoaDto } from './query-da-xoa.dto';

/**
 * Tham số danh sách hồ sơ ĐÃ XOÁ (`GET /cases|incidents|petitions/admin/deleted`, màn Khôi phục).
 *
 * [lỗi có sẵn] Ba controller khai `@Query() query: { limit?; offset?; search? }` — kiểu TypeScript
 * trần, ValidationPipe không có lớp để kiểm: `limit=abc` lọt xuống thành `Number('abc')` = NaN, còn
 * thêm `tk` thì `forbidNonWhitelisted` không chặn được gì vì không có whitelist. Kiểm bằng đúng cấu
 * hình pipe toàn cục.
 */
async function kiem(giaTri: Record<string, unknown>) {
  const dto = plainToInstance(QueryDaXoaDto, giaTri);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('QueryDaXoaDto', () => {
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

  it('limit/offset là số (chuỗi trên URL đổi sang số); chữ rác bị chặn', async () => {
    const { dto, errors } = await kiem({ limit: '50', offset: '0' });
    expect(errors).toEqual([]);
    expect(dto.limit).toBe(50);
    expect(dto.offset).toBe(0);
    expect((await kiem({ limit: 'abc' })).errors).not.toEqual([]);
    expect((await kiem({ offset: '-1' })).errors).not.toEqual([]);
    expect((await kiem({ limit: '101' })).errors).not.toEqual([]);
  });

  it('`search` cũ vẫn nhận; khoá lạ bị chặn', async () => {
    expect((await kiem({ search: 'tham nhũng' })).errors).toEqual([]);
    expect((await kiem({ khongCo: 'x' })).errors).not.toEqual([]);
  });
});
