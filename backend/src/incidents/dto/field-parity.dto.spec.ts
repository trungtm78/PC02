import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateIncidentDto } from './create-incident.dto';

/**
 * Field-parity spec — Incident (Vụ việc) so với hệ thống cũ pc02hcm.com.
 * TDD anchor: FAIL trước khi thêm field vào DTO/schema, PASS sau khi implement.
 */
describe('CreateIncidentDto — field-parity hệ thống cũ (TĐC khắc phục)', () => {
  const validBase = {
    name: 'Vụ việc kiểm thử field-parity',
  };

  it('accepts tienDoKhacPhucTDC (Tiến độ khắc phục TĐC)', async () => {
    const dto = plainToInstance(CreateIncidentDto, {
      ...validBase,
      tienDoKhacPhucTDC: 'Đã khắc phục 80% lý do TĐC, còn thiếu BB/BC',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'tienDoKhacPhucTDC')).toBeUndefined();
  });

  it('tienDoKhacPhucTDC is optional', async () => {
    const dto = plainToInstance(CreateIncidentDto, { ...validBase });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'tienDoKhacPhucTDC')).toBeUndefined();
  });

  it('accepts tdcKhacPhucLyDoBienPhap (Biện pháp khắc phục lý do TĐC)', async () => {
    const dto = plainToInstance(CreateIncidentDto, {
      ...validBase,
      tdcKhacPhucLyDoBienPhap: 'Mời đối tượng đến làm việc lần 2',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'tdcKhacPhucLyDoBienPhap')).toBeUndefined();
  });

  it('accepts tdcKhacPhucBienBan (BB/KH khắc phục TĐC)', async () => {
    const dto = plainToInstance(CreateIncidentDto, {
      ...validBase,
      tdcKhacPhucBienBan: 'BB số 01/VKS ngày 2026-05-01',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'tdcKhacPhucBienBan')).toBeUndefined();
  });

  it('accepts soQuyetDinhTamDinhChiVV (Số QĐ TĐC nguồn tin)', async () => {
    const dto = plainToInstance(CreateIncidentDto, {
      ...validBase,
      soQuyetDinhTamDinhChiVV: 'QĐ-TĐC-2026-001',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'soQuyetDinhTamDinhChiVV')).toBeUndefined();
  });

  it('accepts ngayTamDinhChiVV (Ngày TĐC nguồn tin)', async () => {
    const dto = plainToInstance(CreateIncidentDto, {
      ...validBase,
      ngayTamDinhChiVV: '2026-04-15',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'ngayTamDinhChiVV')).toBeUndefined();
  });

  it('accepts soQuyetDinhPhucHoiVV (Số QĐ phục hồi nguồn tin)', async () => {
    const dto = plainToInstance(CreateIncidentDto, {
      ...validBase,
      soQuyetDinhPhucHoiVV: 'QĐ-PHNT-2026-001',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'soQuyetDinhPhucHoiVV')).toBeUndefined();
  });

  it('accepts ngayPhucHoiVV (Ngày phục hồi nguồn tin)', async () => {
    const dto = plainToInstance(CreateIncidentDto, {
      ...validBase,
      ngayPhucHoiVV: '2026-05-01',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'ngayPhucHoiVV')).toBeUndefined();
  });

  it('accepts laCongNgheCaoVV', async () => {
    const dto = plainToInstance(CreateIncidentDto, {
      ...validBase,
      laCongNgheCaoVV: true,
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'laCongNgheCaoVV')).toBeUndefined();
  });
});
