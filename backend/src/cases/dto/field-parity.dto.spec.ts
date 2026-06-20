import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateCaseDto } from './create-case.dto';
import { CaseStatisticDto } from './case-statistic.dto';
import { CaseProvenance } from '@prisma/client';

/**
 * Field-parity spec — Case + CaseStatistic so với hệ thống cũ pc02hcm.com.
 * TDD anchor: FAIL trước khi thêm field, PASS sau khi implement.
 */
describe('CreateCaseDto — field-parity hệ thống cũ', () => {
  const validBase = {
    name: 'Vụ án kiểm thử field-parity',
    caseProvenance: CaseProvenance.DIRECT_DISCOVERY,
  };

  it('accepts soKLDT (Số kết luận điều tra)', async () => {
    const dto = plainToInstance(CreateCaseDto, {
      ...validBase,
      soKLDT: 'KLĐT-2026-001',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'soKLDT')).toBeUndefined();
  });

  it('accepts ngayKLDT (Ngày kết luận điều tra)', async () => {
    const dto = plainToInstance(CreateCaseDto, {
      ...validBase,
      ngayKLDT: '2026-06-01',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'ngayKLDT')).toBeUndefined();
  });

  it('accepts soQDDieuTraLai (Số QĐ điều tra lại)', async () => {
    const dto = plainToInstance(CreateCaseDto, {
      ...validBase,
      soQDDieuTraLai: 'QĐ-ĐTLẠI-2026-001',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'soQDDieuTraLai')).toBeUndefined();
  });

  it('accepts ngayQDDieuTraLai (Ngày QĐ điều tra lại)', async () => {
    const dto = plainToInstance(CreateCaseDto, {
      ...validBase,
      ngayQDDieuTraLai: '2026-06-01',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'ngayQDDieuTraLai')).toBeUndefined();
  });

  it('all new fields are optional', async () => {
    const dto = plainToInstance(CreateCaseDto, { ...validBase });
    const errors = await validate(dto);
    const newFields = ['soKLDT', 'ngayKLDT', 'soQDDieuTraLai', 'ngayQDDieuTraLai'];
    newFields.forEach((field) => {
      expect(errors.find((e) => e.property === field)).toBeUndefined();
    });
  });
});

describe('CaseStatisticDto — field-parity hệ thống cũ (bị hại, thiệt hại, xét xử)', () => {
  it('accepts soLuongBiHai (Số lượng bị hại)', async () => {
    const dto = plainToInstance(CaseStatisticDto, { soLuongBiHai: 3 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'soLuongBiHai')).toBeUndefined();
  });

  it('accepts soNguoiBiThuong (Số người bị thương)', async () => {
    const dto = plainToInstance(CaseStatisticDto, { soNguoiBiThuong: 1 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'soNguoiBiThuong')).toBeUndefined();
  });

  it('accepts soLuongNguoiChet (Số lượng người chết)', async () => {
    const dto = plainToInstance(CaseStatisticDto, { soLuongNguoiChet: 0 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'soLuongNguoiChet')).toBeUndefined();
  });

  it('accepts soTienBiThietHai (Số tiền bị thiệt hại)', async () => {
    const dto = plainToInstance(CaseStatisticDto, { soTienBiThietHai: 50000000 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'soTienBiThietHai')).toBeUndefined();
  });

  it('accepts soTienThuHoi (Số tiền thu hồi)', async () => {
    const dto = plainToInstance(CaseStatisticDto, { soTienThuHoi: 30000000 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'soTienThuHoi')).toBeUndefined();
  });

  it('accepts vuAnDaDuocXetXu (Vụ án đã được xét xử)', async () => {
    const dto = plainToInstance(CaseStatisticDto, { vuAnDaDuocXetXu: true });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'vuAnDaDuocXetXu')).toBeUndefined();
  });

  it('rejects negative soLuongBiHai', async () => {
    const dto = plainToInstance(CaseStatisticDto, { soLuongBiHai: -1 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'soLuongBiHai')).toBeDefined();
  });

  it('all new statistic fields are optional', async () => {
    const dto = plainToInstance(CaseStatisticDto, {});
    const errors = await validate(dto);
    const newFields = [
      'soLuongBiHai', 'soNguoiBiThuong', 'soLuongNguoiChet',
      'soTienBiThietHai', 'soTienThuHoi', 'vuAnDaDuocXetXu',
    ];
    newFields.forEach((field) => {
      expect(errors.find((e) => e.property === field)).toBeUndefined();
    });
  });

  // PR-M2 (Codex P1#9) — 3 cờ xét-xử RIÊNG
  it.each([
    ['ghiAmGhiHinhDaDuocXetXu', true],
    ['coSuDungKQGhiAmTrongXetXu', false],
    ['khongGAGHNhungToaYeuCau', true],
  ])('accepts boolean %s', async (field, val) => {
    const dto = plainToInstance(CaseStatisticDto, { [field]: val });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === field)).toBeUndefined();
  });

  it('reject giá trị không phải boolean cho 3 cờ xét-xử', async () => {
    const dto = plainToInstance(CaseStatisticDto, { ghiAmGhiHinhDaDuocXetXu: 'yes' as any });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'ghiAmGhiHinhDaDuocXetXu')).toBeDefined();
  });
});

describe('CreateCaseDto — PR-M2 ghiChuKhac + toiDanhKhacIds', () => {
  const validBase = { name: 'Vụ án', caseProvenance: CaseProvenance.DIRECT_DISCOVERY };

  it('accepts ghiChuKhac (ghi chú tự do)', async () => {
    const dto = plainToInstance(CreateCaseDto, { ...validBase, ghiChuKhac: 'Ghi chú' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'ghiChuKhac')).toBeUndefined();
  });

  it('accepts toiDanhKhacIds (mảng crime id)', async () => {
    const dto = plainToInstance(CreateCaseDto, { ...validBase, toiDanhKhacIds: ['c1', 'c2'] });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'toiDanhKhacIds')).toBeUndefined();
  });

  it('reject toiDanhKhacIds chứa phần tử không phải string', async () => {
    const dto = plainToInstance(CreateCaseDto, { ...validBase, toiDanhKhacIds: [1, 2] as any });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'toiDanhKhacIds')).toBeDefined();
  });
});
