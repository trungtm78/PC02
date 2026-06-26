import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateIncidentDto } from './update-incident.dto';

// Regression: field TĐC vụ việc trước đây thiếu ở UpdateIncidentDto → forbidNonWhitelisted 400
// khi EDIT (nhập-không-lưu). Test bảo đảm DTO khai báo + chấp nhận chúng.
describe('UpdateIncidentDto — field-parity TĐC vụ việc', () => {
  it('chấp nhận field TĐC + ngayHetThoiHieuVV hợp lệ', async () => {
    const dto = plainToInstance(UpdateIncidentDto, {
      soQuyetDinhTamDinhChiVV: 'QĐ-01',
      ngayTamDinhChiVV: '2026-06-20',
      soQuyetDinhPhucHoiVV: 'QĐ-02',
      ngayPhucHoiVV: '2026-06-25',
      ngayHetThoiHieuVV: '2027-06-20',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('từ chối ngayHetThoiHieuVV sai định dạng', async () => {
    const dto = plainToInstance(UpdateIncidentDto, { ngayHetThoiHieuVV: 'không-phải-ngày' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'ngayHetThoiHieuVV')).toBe(true);
  });
});
