import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateIncidentDto } from './update-incident.dto';

// Regression: field TĐC vụ việc trước đây thiếu ở UpdateIncidentDto → forbidNonWhitelisted 400
// khi EDIT (nhập-không-lưu). Test bảo đảm DTO khai báo + chấp nhận chúng.
describe('UpdateIncidentDto — field-parity TĐC vụ việc', () => {
  it('chấp nhận TOÀN BỘ field TĐC form gửi khi EDIT (chống forbidNonWhitelisted 400)', async () => {
    const dto = plainToInstance(UpdateIncidentDto, {
      soQuyetDinhTamDinhChiVV: 'QĐ-01',
      ngayTamDinhChiVV: '2026-06-20',
      soQuyetDinhPhucHoiVV: 'QĐ-02',
      ngayPhucHoiVV: '2026-06-25',
      ngayHetThoiHieuVV: '2027-06-20',
      tienDoKhacPhucTDC: 'Đang khắc phục',
      tdcKhacPhucLyDoBienPhap: 'Lý do X',
      tdcKhacPhucBienBan: 'BB-01',
      laCongNgheCaoVV: true,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('PR-6: chấp nhận soQDKhongKhoiTo/ngayQDKhongKhoiTo/xacDinhVuViecTamDung', async () => {
    const dto = plainToInstance(UpdateIncidentDto, {
      soQDKhongKhoiTo: 'QĐ-KKT-01',
      ngayQDKhongKhoiTo: '2026-06-20',
      xacDinhVuViecTamDung: true,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('từ chối ngayHetThoiHieuVV sai định dạng', async () => {
    const dto = plainToInstance(UpdateIncidentDto, { ngayHetThoiHieuVV: 'không-phải-ngày' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'ngayHetThoiHieuVV')).toBe(true);
  });

  // PR-1 catalog: lyDoKhongKhoiTo validate qua danh mục LY_DO_KHONG_KHOI_TO (@IsCatalogValue).
  it('chấp nhận lyDoKhongKhoiTo là mảng code thuộc danh mục', async () => {
    const dto = plainToInstance(UpdateIncidentDto, {
      lyDoKhongKhoiTo: ['KHONG_CO_SU_VIEC', 'HET_THOI_HIEU'],
    });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'lyDoKhongKhoiTo')).toHaveLength(0);
  });

  it('từ chối lyDoKhongKhoiTo chứa code không thuộc danh mục', async () => {
    const dto = plainToInstance(UpdateIncidentDto, { lyDoKhongKhoiTo: ['CODE_RAC'] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'lyDoKhongKhoiTo')).toBe(true);
  });
});
