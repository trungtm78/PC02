/**
 * v0.37.2.3 — Regression test for P0 bug found during UAT 2026-05-23.
 *
 * Bug: handleSave (CaseFormPage/index.tsx:220-260) built API payload without
 * including caseProvenance, linkedPetitionId, linkedIncidentId,
 * sourceDocumentNote, expectedPetitionUpdatedAt, expectedIncidentUpdatedAt.
 *
 * After v0.37.2.0 made caseProvenance a REQUIRED field in DTO with the compat
 * shim removed, every UI submit returned 400 → Cases CREATE was 100% broken.
 *
 * Fix: extract pure helper buildCreateCasePayload(formData) → testable +
 * includes all 4 provenance fields (+ 2 optimistic-lock tokens when relevant).
 */
import { describe, it, expect } from 'vitest';
import { buildCreateCasePayload } from '../buildCreateCasePayload';
import { INITIAL_FORM_DATA } from '../types';
import type { CaseFormData } from '../types';

const baseValid: CaseFormData = {
  ...INITIAL_FORM_DATA,
  caseCode: 'HS-2026-001',
  receiveDate: '2026-05-23',
  caseTitle: 'Test case',
  caseProvenance: 'DIRECT_DISCOVERY',
  sourceDocumentNote: 'Phát hiện qua tuần tra',
};

describe('buildCreateCasePayload (v0.37.2.3 UAT P0 fix)', () => {
  it('includes caseProvenance at top level (CONTRACT: required by BE DTO)', () => {
    const payload = buildCreateCasePayload(baseValid);
    expect(payload.caseProvenance).toBe('DIRECT_DISCOVERY');
  });

  it('includes sourceDocumentNote when DIRECT_DISCOVERY', () => {
    const payload = buildCreateCasePayload(baseValid);
    expect(payload.sourceDocumentNote).toBe('Phát hiện qua tuần tra');
  });

  it('includes linkedPetitionId + expectedPetitionUpdatedAt when FROM_PETITION', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      caseProvenance: 'FROM_PETITION',
      linkedPetitionId: 'pet-id-123',
      expectedPetitionUpdatedAt: '2026-05-23T01:00:00.000Z',
    });
    expect(payload.caseProvenance).toBe('FROM_PETITION');
    expect(payload.linkedPetitionId).toBe('pet-id-123');
    expect(payload.expectedPetitionUpdatedAt).toBe('2026-05-23T01:00:00.000Z');
  });

  it('includes linkedIncidentId + expectedIncidentUpdatedAt when FROM_INCIDENT', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      caseProvenance: 'FROM_INCIDENT',
      linkedIncidentId: 'inc-id-456',
      expectedIncidentUpdatedAt: '2026-05-23T02:00:00.000Z',
    });
    expect(payload.caseProvenance).toBe('FROM_INCIDENT');
    expect(payload.linkedIncidentId).toBe('inc-id-456');
    expect(payload.expectedIncidentUpdatedAt).toBe('2026-05-23T02:00:00.000Z');
  });

  it('does not include FROM_PETITION fields when provenance is DIRECT_DISCOVERY', () => {
    const payload = buildCreateCasePayload(baseValid);
    expect(payload.linkedPetitionId).toBeUndefined();
    expect(payload.expectedPetitionUpdatedAt).toBeUndefined();
    expect(payload.linkedIncidentId).toBeUndefined();
    expect(payload.expectedIncidentUpdatedAt).toBeUndefined();
  });

  it('preserves existing fields: name, crime, status, metadata.code', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      criminalType: 'Trộm cắp tài sản',
      status: 'TIEP_NHAN',
    });
    expect(payload.name).toBe('Test case');
    expect(payload.crime).toBe('Trộm cắp tài sản');
    expect(payload.status).toBe('TIEP_NHAN');
    expect(payload.metadata?.caseCode).toBe('HS-2026-001');
  });
});

/**
 * Hotfix #112 regression tests — TDD red-green-restore verified.
 *
 * Codex post-merge /review + /verification-before-completion phát hiện 3 P1
 * bugs trong PR #102-#110: LAWYER mapping, crimeId default '', MediaFile
 * fake IDs as documentIds. Em fix trong #112 nhưng KHÔNG write regression
 * tests. Plan twinkly-crescent TDD audit Phase 1 add 3 tests below + URL
 * hydration test in separate file.
 */
describe('buildCreateCasePayload (hotfix #112 regressions)', () => {
  const subjectBase = {
    id: 's1',
    name: 'Nguyễn Văn A',
    idNumber: '0123456789',
    dateOfBirth: '1980-01-01',
    address: '123 Đường ABC, Q.1',
    phone: '0901234567',
    gender: 'Nam',
    nationality: 'Việt Nam',
    occupation: '',
  } as const;

  it('filters out Luật sư subjects (LAWYER không có trong Prisma SubjectType enum)', () => {
    const payload = buildCreateCasePayload(baseValid, {
      subjects: [
        { ...subjectBase, id: 's1', type: 'Bị can', name: 'Bị can A', crimeId: 'crime-1' } as never,
        { ...subjectBase, id: 's2', type: 'Luật sư', name: 'Luật sư B', crimeId: 'crime-1' } as never,
        { ...subjectBase, id: 's3', type: 'Bị hại', name: 'Bị hại C', crimeId: 'crime-1' } as never,
      ],
    });
    // Luật sư phải bị filter out — Prisma SubjectType chỉ có SUSPECT/VICTIM/WITNESS
    expect(payload.subjects).toHaveLength(2);
    expect(payload.subjects?.map((s) => s.fullName)).toEqual(['Bị can A', 'Bị hại C']);
    expect(payload.subjects?.find((s) => s.fullName === 'Luật sư B')).toBeUndefined();
  });

  /**
   * MỐC ĐÚNG ĐÃ ĐỔI, KHÔNG PHẢI CA KIỂM BỊ SỬA CHO KHỚP MÃ.
   *
   * Bản cũ chốt "bỏ đối tượng thiếu crimeId", lý do ghi là "backend @IsNotEmpty rejects
   * empty string". Lý do ấy sai với mã đang chạy: `create-case.dto.ts` khai
   * `@IsOptional() @IsString() crimeId?: string` kèm chú thích "nhân chứng/bị hại không bắt
   * buộc tội danh".
   *
   * Hệ quả của bản cũ: hộp thoại thêm đối tượng KHÔNG có ô tội danh, nên không đối tượng
   * nào từng mang crimeId — mọi đối tượng cán bộ nhập đều bị loại, mà màn hình vẫn báo lưu
   * thành công. Từ 26/08/2026 giữ lại tất cả; chỉ đính kèm crimeId khi thật sự có.
   */
  it('giữ đối tượng chưa có crimeId — máy chủ khai crimeId là tuỳ chọn', () => {
    const payload = buildCreateCasePayload(baseValid, {
      subjects: [
        { ...subjectBase, id: 's1', type: 'Bị can', name: 'Có crimeId', crimeId: 'crime-1' } as never,
        { ...subjectBase, id: 's2', type: 'Bị can', name: 'Không có crimeId' } as never,
        { ...subjectBase, id: 's3', type: 'Bị can', name: 'crimeId empty', crimeId: '' } as never,
      ],
    });
    expect(payload.subjects).toHaveLength(3);
    expect(payload.subjects?.map((s) => s.fullName)).toEqual([
      'Có crimeId',
      'Không có crimeId',
      'crimeId empty',
    ]);
    // Chỉ đính kèm crimeId khi có giá trị — gửi chuỗi rỗng lên là ép máy chủ tra một khoá
    // ngoại không tồn tại.
    expect(payload.subjects?.[0].crimeId).toBe('crime-1');
    expect(payload.subjects?.[1].crimeId).toBeUndefined();
    expect(payload.subjects?.[2].crimeId).toBeUndefined();
  });

  it('does NOT include documentIds even when options.documentIds present (MediaFile upload disabled)', () => {
    // Hotfix #112: handleUploadMedia tạo local "MF-${Date.now()}" IDs, file
    // chưa upload thực sự. Pass fake IDs to backend → throw 400 → rollback.
    // documentIds wire phải disabled cho đến khi implement actual upload.
    const payload = buildCreateCasePayload(baseValid, {
      documentIds: ['MF-1700000000', 'MF-1700000001'],
    });
    expect(payload.documentIds).toBeUndefined();
  });
});

/**
 * Tab 2-9 data-loss fix — regression tests.
 * Bug: buildCreateCasePayload only included Tab 1 fields in metadata.
 * All Tab 2-9 fields were silently dropped on CREATE and never restored on EDIT.
 */
describe('Tab 2-9 fields wired into metadata (data-loss fix)', () => {
  it('Tab 2: incidentCode and incidentDate appear in metadata', () => {
    const p = buildCreateCasePayload({ ...baseValid, incidentCode: 'VV-001', incidentDate: '2026-05-24' });
    expect(p.metadata.incidentCode).toBe('VV-001');
    expect(p.metadata.incidentDate).toBe('2026-05-24');
  });

  it('Tab 2: empty fields omitted from metadata (falsy → undefined)', () => {
    const p = buildCreateCasePayload(baseValid);
    expect(p.metadata.incidentCode).toBeUndefined();
  });

  it('Tab 3: criminalCode in metadata, criminalType NOT duplicated (already top-level crime)', () => {
    const p = buildCreateCasePayload({ ...baseValid, criminalCode: 'HS-001', criminalType: 'Trộm cắp' });
    expect(p.metadata.criminalCode).toBe('HS-001');
    expect((p.metadata as Record<string, unknown>).criminalType).toBeUndefined();
    expect(p.crime).toBe('Trộm cắp');
  });

  it('Tab 5: tdcIncidentCode in metadata', () => {
    const p = buildCreateCasePayload({ ...baseValid, tdcIncidentCode: 'TDC-001' });
    expect(p.metadata.tdcIncidentCode).toBe('TDC-001');
  });

  it('Tab 6: tdcCaseCode in metadata', () => {
    const p = buildCreateCasePayload({ ...baseValid, tdcCaseCode: 'VA-TDC-001' });
    expect(p.metadata.tdcCaseCode).toBe('VA-TDC-001');
  });

  it('Tab 9: stat fields in metadata', () => {
    const p = buildCreateCasePayload({ ...baseValid, stat_primaryCrime: 'Cướp', stat_victimCount: '3' });
    expect(p.metadata.stat_primaryCrime).toBe('Cướp');
    expect(p.metadata.stat_victimCount).toBe('3');
  });

  it('Tab 9: stat_damageAmount stored as raw string (NOT parsed through parseVND, unlike Tab 1 damageAmount)', () => {
    // Tab 9 stats are informational strings. CurrencyInput.onValueChange returns unmasked "1000000".
    // Intentional asymmetry from Tab 1 damageAmount which uses parseVND → number.
    const p = buildCreateCasePayload({ ...baseValid, stat_damageAmount: '1500000' });
    expect(typeof p.metadata.stat_damageAmount).toBe('string');
    expect(p.metadata.stat_damageAmount).toBe('1500000');
    expect(typeof p.metadata.damageAmount).not.toBe('string'); // Tab 1 is a number
  });
});

describe('buildCreateCasePayload — UTDT (caseProvenance=UY_THAC_DIEU_TRA)', () => {
  const utdtBase: CaseFormData = {
    ...INITIAL_FORM_DATA,
    caseCode: 'UT-2026-001',
    receiveDate: '2026-05-26',
    caseTitle: 'Ủy thác điều tra test',
    caseProvenance: 'UY_THAC_DIEU_TRA',
    utdt_donViGiao: 'C06',
  };

  it('throws validation error when utdt_donViGiao is empty for UY_THAC_DIEU_TRA', () => {
    expect(() =>
      buildCreateCasePayload({ ...utdtBase, utdt_donViGiao: '' })
    ).toThrow('Đơn vị giao ủy thác là bắt buộc');
  });

  it('includes donViGiao in payload when utdt_donViGiao is set', () => {
    const payload = buildCreateCasePayload(utdtBase);
    expect(payload.donViGiao).toBe('C06');
    expect(payload.caseType).toBe('UY_THAC_DIEU_TRA');
  });
});

/**
 * v0.39 Input mask refactor — regression tests.
 * AD-1: form state lưu raw string. AD-1 + AD-2: parse tại boundary submit.
 * damageAmount (currency) → number. *Phone fields → strip space.
 */
describe('buildCreateCasePayload — v0.39 input-mask formatting boundary', () => {
  it('parses string damageAmount "1000000" to number 1000000 in metadata', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      damageAmount: '1000000',
    });
    expect(payload.metadata.damageAmount).toBe(1000000);
  });

  it('returns undefined damageAmount when form value is empty string', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      damageAmount: '',
    });
    expect(payload.metadata.damageAmount).toBeUndefined();
  });

  it('strips spaces from reporterPhone before submit', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      reporterPhone: '0901 234 567',
    });
    expect(payload.metadata.reporterPhone).toBe('0901234567');
  });

  it('strips spaces from subject.phone in subjects[] mapping', () => {
    const payload = buildCreateCasePayload(baseValid, {
      subjects: [
        {
          id: 'sub-1',
          name: 'Nguyễn Văn A',
          dateOfBirth: '1990-01-01',
          gender: 'M',
          idNumber: '123456789',
          address: 'Hà Nội',
          phone: '0901 234 567',
          occupation: 'occ-1',
          nationality: 'nat-1',
          type: 'Bị can',
          criminalRecord: '',
          crimeId: 'crime-1',
        } as never,
      ],
    });
    expect(payload.subjects?.[0].phone).toBe('0901234567');
  });
});

describe('buildCreateCasePayload — PR-M2 ghiChuKhac/toiDanhKhacIds + 3 cờ xét-xử', () => {
  it('gửi ghiChuKhac + toiDanhKhacIds khi có giá trị', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      ghiChuKhac: 'Ghi chú tự do',
      toiDanhKhacIds: ['D173', 'D174'],
    });
    expect(payload.ghiChuKhac).toBe('Ghi chú tự do');
    expect(payload.toiDanhKhacIds).toEqual(['D173', 'D174']);
  });

  it('KHÔNG gửi toiDanhKhacIds khi mảng rỗng', () => {
    const payload = buildCreateCasePayload({ ...baseValid, toiDanhKhacIds: [] });
    expect('toiDanhKhacIds' in payload).toBe(false);
  });

  it('3 cờ xét-xử true → vào payload.statistic; false → bỏ qua', () => {
    const payload = buildCreateCasePayload({
      ...baseValid,
      statistic: {
        ...baseValid.statistic,
        ghiAmGhiHinhDaDuocXetXu: true,
        coSuDungKQGhiAmTrongXetXu: false,
        khongGAGHNhungToaYeuCau: true,
      },
    });
    const stat = payload.statistic as Record<string, unknown>;
    expect(stat.ghiAmGhiHinhDaDuocXetXu).toBe(true);
    expect(stat.khongGAGHNhungToaYeuCau).toBe(true);
    expect('coSuDungKQGhiAmTrongXetXu' in stat).toBe(false); // false không gửi (giữ nullable)
  });

  // ── Consolidate epic: field promoted → cột typed TOP-LEVEL ──
  describe('consolidate: promote → cột typed top-level', () => {
    /**
     * MỐC ĐÚNG ĐÃ ĐỔI 26/08/2026 — MỘT CỘT, MỘT Ô (cùng lý do với `diaChiCungCap` bên dưới).
     *
     * Ô "Họ và tên" trong khối Người báo tin đã gỡ khỏi giao diện: nó ghi cùng cột
     * `tenCungCap` với ô "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại" ở tab Thông tin.
     * Màn Sửa nạp cùng một cột vào cả hai ô, nên khi còn cả hai thì xoá trắng ô hệ cũ xong ô
     * kia gửi lại giá trị cũ — cán bộ xoá mà không xoá được.
     */
    it('cột tenCungCap do ô hệ cũ làm chủ, ô Họ và tên đã gỡ không còn ghi', () => {
      const payload = buildCreateCasePayload({
        ...baseValid,
        reporter: 'Nguyễn Văn A',
        tenCungCap: 'Trần Thị B',
      });
      expect(payload.tenCungCap).toBe('Trần Thị B');
    });

    /**
     * MỐC ĐÚNG ĐÃ ĐỔI 26/08/2026 — MỘT CỘT, MỘT Ô.
     *
     * Ô "Địa chỉ thường trú" và ô "Số CCCD/CMND" trong khối Người báo tin đã gỡ: chúng ghi cùng cột
     * `diaChiCungCap` với ô "Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại" ở tab
     * Thông tin (đúng chữ hệ cũ). Khi còn cả hai, ô hệ cũ luôn thắng lúc lưu nên ô kia là ô
     * gõ vào không có tác dụng. Nay chủ cột là `formData.diaChiCungCap`.
     */
    it('cccdCungCap và diaChiCungCap đều do ô hệ cũ làm chủ; moTaChiTiet vẫn từ description', () => {
      const payload = buildCreateCasePayload({
        ...baseValid,
        reporterIdNumber: '079123456789',
        reporterAddress: '12 Lê Lợi',
        diaChiCungCap: '34 Nguyễn Huệ',
        description: 'Nội dung',
      });
      expect(payload.cccdCungCap).toBeNull();
      expect(payload.diaChiCungCap).toBe('34 Nguyễn Huệ');
      expect(payload.moTaChiTiet).toBe('Nội dung');
    });

    it('reporterDateOfBirth năm-only → YYYY-01-01 + precision year', () => {
      const payload = buildCreateCasePayload({ ...baseValid, reporter: 'A', sinhNamCungCap: '1985' });
      expect(payload.reporterDateOfBirth).toBe('1985-01-01');
      expect(payload.reporterDateOfBirthPrecision).toBe('year');
    });

    it('reporterDateOfBirth ngày đầy đủ → precision date', () => {
      const payload = buildCreateCasePayload({ ...baseValid, reporterDateOfBirth: '2001-03-15' });
      expect(payload.reporterDateOfBirth).toBe('2001-03-15');
      expect(payload.reporterDateOfBirthPrecision).toBe('date');
    });

    it('round-trip năm-only: load YYYY-01-01 + precision year → GIỮ year khi save (chống P0 codex)', () => {
      // Mô phỏng edit: merge nạp reporterDateOfBirth='1985-01-01' + precision='year' từ cột.
      const payload = buildCreateCasePayload({
        ...baseValid,
        reporterDateOfBirth: '1985-01-01',
        reporterDateOfBirthPrecision: 'year',
      });
      expect(payload.reporterDateOfBirth).toBe('1985-01-01');
      expect(payload.reporterDateOfBirthPrecision).toBe('year'); // KHÔNG tự nâng thành 'date'
    });

    it('Jan-1 không có precision đã load → date (mặc định an toàn)', () => {
      const payload = buildCreateCasePayload({ ...baseValid, reporterDateOfBirth: '1990-01-01' });
      expect(payload.reporterDateOfBirthPrecision).toBe('date');
    });

    it('damageAmount → statistic.soTienBiThietHai (canonical)', () => {
      const payload = buildCreateCasePayload({ ...baseValid, damageAmount: '5.500.000' });
      const stat = payload.statistic as Record<string, unknown>;
      expect(stat.soTienBiThietHai).toBe(5500000);
    });

    it('deXuatXuLy → cột deXuat; dieuTraVienText → cột dieuTraVien', () => {
      const payload = buildCreateCasePayload({ ...baseValid, deXuatXuLy: 'Khởi tố', dieuTraVienText: 'Trần B' });
      expect(payload.deXuat).toBe('Khởi tố');
      expect(payload.dieuTraVien).toBe('Trần B');
    });
  });
});
