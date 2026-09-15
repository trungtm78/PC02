import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ExportPetitionsQueryDto } from './export-petitions-query.dto';

/**
 * Tham số xuất Excel danh sách đơn thư (`GET /petitions/export`, nút "Xuất Excel" màn Xuất báo cáo).
 *
 * [lỗi có sẵn] Màn lọc bằng thẻ rồi bấm Xuất: tệp ra KHÁC thứ đang hiện vì lượt xuất không mang thẻ.
 * DTO phải nhận `tk`/`search` thì giao diện mới gửi được — ValidationPipe toàn cục bật
 * `forbidNonWhitelisted`, gửi khoá không khai là 400 cả lượt xuất.
 */
async function kiem(giaTri: Record<string, unknown>) {
  const dto = plainToInstance(ExportPetitionsQueryDto, giaTri);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, errors };
}

describe('ExportPetitionsQueryDto — thẻ tìm kiếm', () => {
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

  it('`search` cũ (cờ thẻ tắt) vẫn nhận, cùng các khoá cũ', async () => {
    const { errors } = await kiem({
      search: 'nguyen',
      ids: 'a,b',
      fromDate: '2026-09-01',
      toDate: '2026-09-30',
      unit: 'Đội 2',
      status: 'DANG_XU_LY',
    });
    expect(errors).toEqual([]);
  });

  it('khoá lạ bị chặn', async () => {
    expect((await kiem({ khongCo: 'x' })).errors).not.toEqual([]);
  });
});
