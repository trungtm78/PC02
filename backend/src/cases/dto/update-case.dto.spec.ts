/**
 * v0.37.2.6 — Regression test for P1 bug discovered during UAT 2026-05-23.
 *
 * Bug: cases.service.update() casts DTO to Record<string,unknown> to access
 * 8 TAM_DINH_CHI / PHUC_HOI fields (lyDoTamDinhChiVuAn, lyDoTamDinhChiText,
 * soQuyetDinhTamDinhChi, ngayTamDinhChi, daRaSoat, ngayRaSoat,
 * soQuyetDinhPhucHoi, ketQuaPhucHoiVuAn). None of these are declared in
 * UpdateCaseDto (PartialType of CreateCaseDto which also doesn't have them).
 * ValidationPipe forbidNonWhitelisted strips/rejects → 400 Validation failed
 * → cannot TAM_DINH_CHI a case via API.
 *
 * Fix: declare all 8 fields in UpdateCaseDto with proper decorators.
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateCaseDto } from './update-case.dto';

describe('UpdateCaseDto — TAM_DINH_CHI / PHUC_HOI fields (v0.37.2.6 P1 fix)', () => {
  it('accepts lyDoTamDinhChiVuAn MẢNG nhiều enum value (PR-8 multi)', async () => {
    const dto = plainToInstance(UpdateCaseDto, {
      status: 'TAM_DINH_CHI',
      lyDoTamDinhChiVuAn: ['CHUA_CO_KET_QUA_GIAM_DINH', 'BAT_KHA_KHANG'],
      caseProvenance: 'DIRECT_DISCOVERY',
    });
    const errors = await validate(dto);
    const lyDoErr = errors.find((e) => e.property === 'lyDoTamDinhChiVuAn');
    expect(lyDoErr).toBeUndefined();
  });

  it('rejects invalid lyDoTamDinhChiVuAn enum value trong mảng', async () => {
    const dto = plainToInstance(UpdateCaseDto, {
      lyDoTamDinhChiVuAn: ['NOT_A_VALID_ENUM'],
      caseProvenance: 'DIRECT_DISCOVERY',
    });
    const errors = await validate(dto);
    const lyDoErr = errors.find((e) => e.property === 'lyDoTamDinhChiVuAn');
    expect(lyDoErr).toBeDefined();
    // PR-3 catalog: cơ chế validate đổi từ @IsEnum sang @IsCatalogValue (vẫn reject code rác).
    expect(lyDoErr?.constraints).toHaveProperty('isCatalogValue');
  });

  it('accepts lyDoTamDinhChiText (optional string)', async () => {
    const dto = plainToInstance(UpdateCaseDto, {
      lyDoTamDinhChiText: 'Chờ kết quả giám định pháp y theo công văn số 123',
      caseProvenance: 'DIRECT_DISCOVERY',
    });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'lyDoTamDinhChiText');
    expect(err).toBeUndefined();
  });

  it('accepts soQuyetDinhTamDinhChi + ngayTamDinhChi', async () => {
    const dto = plainToInstance(UpdateCaseDto, {
      soQuyetDinhTamDinhChi: 'QĐ-123/2026',
      ngayTamDinhChi: '2026-05-23T00:00:00.000Z',
      caseProvenance: 'DIRECT_DISCOVERY',
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'soQuyetDinhTamDinhChi'),
    ).toBeUndefined();
    expect(errors.find((e) => e.property === 'ngayTamDinhChi')).toBeUndefined();
  });

  it('accepts daRaSoat + ngayRaSoat + soQuyetDinhPhucHoi (Phục hồi fields)', async () => {
    const dto = plainToInstance(UpdateCaseDto, {
      daRaSoat: true,
      ngayRaSoat: '2026-06-15T00:00:00.000Z',
      soQuyetDinhPhucHoi: 'QĐ-PH-456/2026',
      caseProvenance: 'DIRECT_DISCOVERY',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'daRaSoat')).toBeUndefined();
    expect(errors.find((e) => e.property === 'ngayRaSoat')).toBeUndefined();
    expect(
      errors.find((e) => e.property === 'soQuyetDinhPhucHoi'),
    ).toBeUndefined();
  });

  it('accepts ketQuaPhucHoiVuAn enum', async () => {
    const dto = plainToInstance(UpdateCaseDto, {
      ketQuaPhucHoiVuAn: 'KET_LUAN_DE_NGHI_TRUY_TO',
      caseProvenance: 'DIRECT_DISCOVERY',
    });
    const errors = await validate(dto);
    expect(
      errors.find((e) => e.property === 'ketQuaPhucHoiVuAn'),
    ).toBeUndefined();
  });

  // PR-3 (2026-06-26) — 4 field TĐC vụ án còn sót: form GỬI khi EDIT → trước 400 (forbidNonWhitelisted).
  it('accepts ngayPhucHoi + ngayHetThoiHieu + tdcKhacPhuc* (parity tab Vụ án TĐC)', async () => {
    const dto = plainToInstance(UpdateCaseDto, {
      ngayPhucHoi: '2026-06-25T00:00:00.000Z',
      ngayHetThoiHieu: '2027-06-25T00:00:00.000Z',
      tdcKhacPhucLyDoBienPhap: 'Lý do/biện pháp khắc phục',
      tdcKhacPhucBienBan: 'BB khắc phục số 01',
      caseProvenance: 'DIRECT_DISCOVERY',
    });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'ngayPhucHoi')).toBeUndefined();
    expect(
      errors.find((e) => e.property === 'ngayHetThoiHieu'),
    ).toBeUndefined();
    expect(
      errors.find((e) => e.property === 'tdcKhacPhucLyDoBienPhap'),
    ).toBeUndefined();
    expect(
      errors.find((e) => e.property === 'tdcKhacPhucBienBan'),
    ).toBeUndefined();
  });

  it('rejects invalid ketQuaPhucHoiVuAn enum value', async () => {
    const dto = plainToInstance(UpdateCaseDto, {
      ketQuaPhucHoiVuAn: 'INVALID_ENUM',
      caseProvenance: 'DIRECT_DISCOVERY',
    });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'ketQuaPhucHoiVuAn');
    expect(err).toBeDefined();
    // PR-7 catalog: @IsEnum→@IsCatalogValue.
    expect(err?.constraints).toHaveProperty('isCatalogValue');
  });

  it('rejects daRaSoat with non-boolean value', async () => {
    const dto = plainToInstance(UpdateCaseDto, {
      daRaSoat: 'yes',
      caseProvenance: 'DIRECT_DISCOVERY',
    });
    const errors = await validate(dto);
    const err = errors.find((e) => e.property === 'daRaSoat');
    expect(err).toBeDefined();
    expect(err?.constraints).toHaveProperty('isBoolean');
  });
});

/**
 * PR-A2 — `PUT /cases/:id` used to accept `subjects[]`, `evidences[]` and
 * `documentIds[]`, return 200, and write none of them.
 *
 * `create()` hands those arrays to `createSubEntitiesInTransaction`;
 * `update()` never called it. So an officer who added a piece of seized
 * evidence while editing a case was told it saved and it was not. On a legal
 * record, silently discarding an entry is worse than refusing it.
 */
describe('UpdateCaseDto — sub-entity arrays are refused, not ignored', () => {
  const base = { name: 'Vụ án thí nghiệm', caseProvenance: 'DIRECT_DISCOVERY' };

  it.each([
    ['subjects', [{ fullName: 'Nguyễn Văn A', type: 'BI_CAN' }]],
    ['evidences', [{ code: 'VC-001', name: 'Dao' }]],
    ['documentIds', ['doc-1']],
  ])(
    'rejects %s with a message that names the right endpoint',
    async (field, value) => {
      const dto = plainToInstance(UpdateCaseDto, { ...base, [field]: value });
      const errors = await validate(dto);

      const err = errors.find((e) => e.property === field);
      expect(err).toBeDefined();
      // The point of the custom message: tell the caller where the data goes.
      const text = Object.values(err?.constraints ?? {}).join(' ');
      expect(text).toMatch(/trang chi tiết|POST \//);
    },
  );

  it('accepts an ordinary edit that carries none of them', async () => {
    const dto = plainToInstance(UpdateCaseDto, {
      ...base,
      note: 'Cập nhật tiến độ',
    });
    const errors = await validate(dto);

    for (const field of ['subjects', 'evidences', 'documentIds']) {
      expect(errors.find((e) => e.property === field)).toBeUndefined();
    }
  });

  it('rejects an empty array too — sending [] is still a caller mistake', async () => {
    // An empty array reads as "remove everything", which this endpoint has
    // never done. Accepting it silently would be the same bug in a new shape.
    const dto = plainToInstance(UpdateCaseDto, { ...base, evidences: [] });
    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'evidences')).toBeDefined();
  });
});
