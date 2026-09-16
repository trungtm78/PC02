import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  DO_DAI_MUC_THE_TOI_DA,
  TheTimKiem,
} from './the-tim-kiem.decorator';
import { SO_THE_TOI_DA } from './dieu-kien';

/**
 * Khối kiểm thẻ `tk` từng được CHÉP TAY ở 12 DTO + reports.controller, kèm hằng số
 * `DO_DAI_MUC_THE_TOI_DA = DO_DAI_GIA_TRI_TOI_DA + 50` chép lại 13 nơi. Chép tay kiểu đó thì
 * sửa một nơi là 12 nơi kia lặng lẽ lệch — đúng lớp lỗi mà kho mã này đã mắc nhiều lần.
 * Gộp về một decorator, và ca kiểm dưới đây chốt hợp đồng của nó.
 */
class ThuNghiemDto {
  @TheTimKiem()
  tk?: string[];
}

function kiem(giaTri: unknown): string[] {
  const dto = plainToInstance(ThuNghiemDto, { tk: giaTri });
  return validateSync(dto).flatMap((e) => Object.keys(e.constraints ?? {}));
}

function doiHinh(giaTri: unknown): unknown {
  return plainToInstance(ThuNghiemDto, { tk: giaTri }).tk;
}

describe('@TheTimKiem — hợp đồng kiểm thẻ tìm kiếm', () => {
  it('bỏ trống thì giữ undefined, không thành mảng rỗng', () => {
    expect(doiHinh(undefined)).toBeUndefined();
    expect(kiem(undefined)).toEqual([]);
  });

  it('một chuỗi đơn trên URL thành mảng một phần tử', () => {
    expect(doiHinh('nguoiGui~Nguyễn')).toEqual(['nguoiGui~Nguyễn']);
    expect(kiem('nguoiGui~Nguyễn')).toEqual([]);
  });

  it(`nhận tối đa ${SO_THE_TOI_DA} thẻ`, () => {
    const vua = Array.from({ length: SO_THE_TOI_DA }, (_, i) => `k${i}~v`);
    expect(kiem(vua)).toEqual([]);
  });

  it(`quá ${SO_THE_TOI_DA} thẻ thì hỏng — chặn yêu cầu quá cỡ trước khi chạm CSDL`, () => {
    const qua = Array.from({ length: SO_THE_TOI_DA + 1 }, (_, i) => `k${i}~v`);
    expect(kiem(qua)).toContain('arrayMaxSize');
  });

  it(`mỗi mục dài tối đa ${DO_DAI_MUC_THE_TOI_DA} ký tự`, () => {
    expect(kiem(['k~' + 'a'.repeat(DO_DAI_MUC_THE_TOI_DA - 2)])).toEqual([]);
    expect(kiem(['k~' + 'a'.repeat(DO_DAI_MUC_THE_TOI_DA)])).toContain(
      'maxLength',
    );
  });

  it('phần tử không phải chuỗi thì hỏng', () => {
    expect(kiem([123])).toContain('isString');
  });

  it('giới hạn độ dài mục = giới hạn giá trị + chỗ cho khoá và dấu ~', () => {
    // Chốt công thức, vì trước đây 13 nơi tự tính lại: lệch một nơi là giới hạn
    // đầu vào chỗ ấy khác hẳn mà không ai biết.
    expect(DO_DAI_MUC_THE_TOI_DA).toBe(250);
  });
});
