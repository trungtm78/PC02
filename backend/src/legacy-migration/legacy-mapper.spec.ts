import {
  decomposeLegacyRecord,
  parseLegacyDate,
  parseLegacyNumber,
  parseLegacyBool,
  buildCaseStatistic,
} from './legacy-mapper';

describe('parseLegacyNumber (tiền localized hệ cũ)', () => {
  it('phân tách nghìn kiểu VN 1.000.000 → 1000000', () => {
    expect(parseLegacyNumber('1.000.000')).toBe(1000000);
  });
  it('phân tách nghìn kiểu , → 1,000,000 → 1000000', () => {
    expect(parseLegacyNumber('1,000,000')).toBe(1000000);
  });
  it('"50 triệu" → 50000000', () => {
    expect(parseLegacyNumber('50 triệu')).toBe(50000000);
  });
  it('"1,5 tỷ" (thập phân VN) → 1500000000', () => {
    expect(parseLegacyNumber('1,5 tỷ')).toBe(1500000000);
  });
  it('số thường + rỗng/sai', () => {
    expect(parseLegacyNumber('42')).toBe(42);
    expect(parseLegacyNumber('')).toBeUndefined();
    expect(parseLegacyNumber('abc')).toBeUndefined();
  });
});

describe('parseLegacyBool (nhãn boolean tiếng Việt)', () => {
  it('nhãn true: Có/Đã/Rồi/1/true/x', () => {
    ['Có', 'có', 'Đã', 'Rồi', '1', 'true', 'x'].forEach((v) => expect(parseLegacyBool(v)).toBe(true));
  });
  it('nhãn false: Không/Chưa/0/false', () => {
    ['Không', 'không', 'Chưa', '0', 'false'].forEach((v) => expect(parseLegacyBool(v)).toBe(false));
  });
  it('cụm từ: nhận diện theo từ đầu (Đã xét xử→true, Không có→false, Chưa xét xử→false, Có ghi âm→true)', () => {
    expect(parseLegacyBool('Đã xét xử')).toBe(true);
    expect(parseLegacyBool('Có ghi âm')).toBe(true);
    expect(parseLegacyBool('Không có')).toBe(false);
    expect(parseLegacyBool('Chưa xét xử')).toBe(false);
  });
  it('rỗng/null → undefined (phân biệt thiếu vs false)', () => {
    expect(parseLegacyBool('')).toBeUndefined();
    expect(parseLegacyBool(null)).toBeUndefined();
    expect(parseLegacyBool(undefined)).toBeUndefined();
  });
});

describe('parseLegacyDate — Excel serial', () => {
  it('serial 45000 (NUMBER) → 2023-03-15 (epoch Excel 1899-12-30)', () => {
    expect(parseLegacyDate(45000)?.toISOString().slice(0, 10)).toBe('2023-03-15');
  });
  it('chuỗi "45000" KHÔNG coi là serial (tránh nhận nhầm mã/số 5-6 chữ số) → undefined', () => {
    expect(parseLegacyDate('45000')).toBeUndefined();
  });
});

describe('buildCaseStatistic — field đếm là Int (round, không Float gây Prisma reject)', () => {
  it('"1,5" cho field đếm → làm tròn về integer', () => {
    const stat = buildCaseStatistic({ so_luong_bi_hai: '1,5' });
    expect(Number.isInteger(stat!.soLuongBiHai)).toBe(true);
  });
  it('field tiền giữ thập phân (Float) — soTienBiThietHai không bị round', () => {
    const stat = buildCaseStatistic({ so_tien_bi_thiet_hai: '1.000.000' });
    expect(stat!.soTienBiThietHai).toBe(1000000);
  });
});

describe('buildCaseStatistic — số/tiền/cờ thống kê hệ cũ', () => {
  it('map số bị hại + tiền localized + cờ xét xử', () => {
    const stat = buildCaseStatistic({
      so_luong_bi_hai: '3',
      so_tien_bi_thiet_hai: '1.000.000',
      so_tien_thu_hoi: '50 triệu',
      xac_nhan_vu_an_da_duoc_xet_xu: 'Có',
    });
    expect(stat).toBeDefined();
    expect(stat!.soLuongBiHai).toBe(3);
    expect(stat!.soTienBiThietHai).toBe(1000000);
    expect(stat!.soTienThuHoi).toBe(50000000);
    expect(stat!.vuAnDaDuocXetXu).toBe(true);
  });
  it('record không có field thống kê → undefined (không tạo row rỗng)', () => {
    expect(buildCaseStatistic({ id: 'X', tom_tat_noi_dung: 'abc' })).toBeUndefined();
  });
});

describe('parseLegacyDate', () => {
  it('dd/mm/yyyy → ISO Date', () => {
    expect(parseLegacyDate('15/04/2025')?.toISOString().slice(0, 10)).toBe('2025-04-15');
  });
  it('yyyy-mm-dd cũng nhận', () => {
    expect(parseLegacyDate('2025-04-15')?.toISOString().slice(0, 10)).toBe('2025-04-15');
  });
  it('rỗng/sai → undefined', () => {
    expect(parseLegacyDate('')).toBeUndefined();
    expect(parseLegacyDate('linh tinh')).toBeUndefined();
  });
  it('ngày overflow (31/02/2025) → undefined (không wrap sang tháng 3)', () => {
    expect(parseLegacyDate('31/02/2025')).toBeUndefined();
  });
  it('ngày hợp lệ cuối tháng (28/02/2025) → Date đúng', () => {
    expect(parseLegacyDate('28/02/2025')?.toISOString().slice(0, 10)).toBe('2025-02-28');
  });
});

describe('decomposeLegacyRecord', () => {
  const base = {
    id: 'L-001',
    ten_ca_nhan_co_quan_to_chuc_cung_cap: 'Nguyễn Văn A',
    so_dien_thoai_nguyen_don: '0901234567',
    so_cccd_nguyen_don: '012345678901',
    'dia-chi-bi-hai': '1 Lê Lợi',
    tom_tat_noi_dung: 'Bị trộm xe',
    toi_danh_chinh_blhs2015: '95', // legacy value → crime
    noi_xay_ra: 'Quận 1',
  };

  it('phân loại Đơn → tạo Petition, map field + legacySourceId', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau' });
    expect(r.petition).toBeDefined();
    expect(r.case).toBeUndefined();
    expect(r.petition!.senderName).toBe('Nguyễn Văn A');
    expect(r.petition!.senderPhone).toBe('0901234567');
    expect(r.petition!.senderIdNumber).toBe('012345678901');
    expect(r.petition!.summary).toBe('Bị trộm xe');
    expect(r.petition!.legacySourceId).toBe('L-001');
    expect(r.petition!.crimeChinhLegacyValue).toBe(95);
  });

  it('phân loại Vụ việc → tạo Incident', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau' });
    expect(r.incident).toBeDefined();
    expect(r.incident!.name).toContain('Bị trộm xe');
    expect(r.incident!.legacySourceId).toBe('L-001');
  });

  it('phân loại Vụ án → tạo Case', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'vu-an-ban-dau' });
    expect(r.case).toBeDefined();
    expect(r.case!.legacySourceId).toBe('L-001');
  });

  it('có QĐ khởi tố vụ án → tạo thêm Case dù phân loại là vụ việc (decompose 1→nhiều)', () => {
    const r = decomposeLegacyRecord({
      ...base,
      phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau',
      quyet_dinh_khoi_to_vu_an: 'QĐ-123',
    });
    expect(r.incident).toBeDefined();
    expect(r.case).toBeDefined();
    expect(r.case!.soQuyetDinhKhoiTo).toBe('QĐ-123');
  });

  it('gắn legacyRaw = toàn bộ record gốc (Codex P1#1 — không mất data)', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau', field_la_khong_map: 'giữ nguyên' });
    expect((r.petition!.legacyRaw as Record<string, unknown>).field_la_khong_map).toBe('giữ nguyên');
    expect((r.petition!.legacyRaw as Record<string, unknown>).tom_tat_noi_dung).toBe('Bị trộm xe');
  });

  it('gắn statistic vào case khi record có field thống kê', () => {
    const r = decomposeLegacyRecord({
      ...base,
      phan_loai_nguon_tin_ban_dau: 'vu-an-ban-dau',
      so_luong_bi_hai: '2',
      so_tien_bi_thiet_hai: '1.000.000',
    });
    expect(r.case).toBeDefined();
    expect(r.statistic).toBeDefined();
    expect(r.statistic!.soLuongBiHai).toBe(2);
    expect(r.statistic!.soTienBiThietHai).toBe(1000000);
  });

  it('Petition map thêm field nhóm B (laCongNgheCao, baoCaoBanGiamDoc bool, thoiHanUTDT)', () => {
    const r = decomposeLegacyRecord({
      ...base,
      phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau',
      phan_loai_toi_pham_cong_nghe_cao: 'Có',
      truong_hop_bao_cao_ban_giam_doc: 'Đã báo cáo BGĐ ngày 1/6',
      thoi_han_thuc_hien_uy_thac_dieu_tra: '30/06/2026',
    });
    expect(r.petition!.laCongNgheCao).toBe(true);
    expect(r.petition!.baoCaoBanGiamDoc).toBe(true);
    expect(r.petition!.thoiHanUTDT).toBeInstanceOf(Date);
  });

  it('phân loại lạ → warning, không tạo entity nào', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'khong-biet' });
    expect(r.petition).toBeUndefined();
    expect(r.incident).toBeUndefined();
    expect(r.case).toBeUndefined();
    expect(r.warnings.some((w) => /phân loại/i.test(w))).toBe(true);
  });
});

describe('decomposeLegacyRecord — tier ③ (PR-M3: 5 loại bị skip + luật sư + UTDT)', () => {
  const base = {
    id: 'T-001',
    ten_ca_nhan_co_quan_to_chuc_cung_cap: 'Nguyễn Văn B',
    tom_tat_noi_dung: 'Nội dung hồ sơ',
    so_dien_thoai_nguyen_don: '0900000000',
    don_vi_giai_quyet: 'Đội 1',
  };

  it('huong-dan-ban-dau → guidance (guidedPerson + guidanceContent + legacySourceId + legacyRaw)', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'huong-dan-ban-dau' });
    expect(r.guidance).toBeDefined();
    expect(r.guidance!.legacySourceId).toBe('T-001');
    expect(r.guidance!.guidedPerson).toBe('Nguyễn Văn B');
    expect(r.guidance!.guidanceContent).toBe('Nội dung hồ sơ');
    expect((r.guidance!.legacyRaw as Record<string, unknown>).don_vi_giai_quyet).toBe('Đội 1');
    expect(r.petition).toBeUndefined();
    expect(r.case).toBeUndefined();
  });

  it('trao-doi-chuyen-an → exchange (subject + legacySourceId)', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'trao-doi-chuyen-an' });
    expect(r.exchange).toBeDefined();
    expect(r.exchange!.legacySourceId).toBe('T-001');
    expect(r.exchange!.subject).toBe('Nội dung hồ sơ');
  });

  it('kien-nghi-vks → proposal (content + legacySourceId; proposalNumber sinh deterministic ở commit)', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'kien-nghi-vks' });
    expect(r.proposal).toBeDefined();
    expect(r.proposal!.legacySourceId).toBe('T-001');
    expect(r.proposal!.content).toBe('Nội dung hồ sơ');
    expect(r.proposal!.proposalNumber).toBeUndefined();
  });

  it('uy-thac-dieu-tra → case caseType UY_THAC_DIEU_TRA + provenance hint (CHECK constraint non-linked)', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'uy-thac-dieu-tra' });
    expect(r.case).toBeDefined();
    expect(r.case!.caseType).toBe('UY_THAC_DIEU_TRA');
    expect(r.caseProvenanceHint).toBe('UY_THAC_DIEU_TRA');
  });

  it('luat-su → lawyer + host case (Lawyer.caseId FK required — không mất data, warning verify M4)', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'luat-su' });
    expect(r.lawyer).toBeDefined();
    expect(r.lawyer!.legacySourceId).toBe('T-001');
    expect(r.lawyer!.fullName).toBe('Nguyễn Văn B');
    expect(r.case).toBeDefined();
    expect(r.warnings.some((w) => /luật sư|lawyer/i.test(w))).toBe(true);
  });

  it('tra-ho-so-ban-dau → host case + warning (module workflow defer, legacyRaw không mất data)', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'tra-ho-so-ban-dau' });
    expect(r.case).toBeDefined();
    expect((r.case!.legacyRaw as Record<string, unknown>).tom_tat_noi_dung).toBe('Nội dung hồ sơ');
    expect(r.warnings.some((w) => /workflow|trả hồ sơ/i.test(w))).toBe(true);
  });

  it('cong-van-don-doc-phuc-hoi-tdc → incident host mang field TĐC phục hồi + warning', () => {
    const r = decomposeLegacyRecord({
      ...base,
      phan_loai_nguon_tin_ban_dau: 'cong-van-don-doc-phuc-hoi-tdc',
      phuc_hoi_nguon_tin_toi_pham: 'QĐ-PH-9',
      ngay_phuc_hoi_nguon_tin: '01/06/2025',
    });
    expect(r.incident).toBeDefined();
    expect(r.incident!.soQuyetDinhPhucHoiVV).toBe('QĐ-PH-9');
    expect(r.warnings.some((w) => /tđc|phục hồi/i.test(w))).toBe(true);
  });

  it('tier-3 standalone + QĐ khởi tố → KHÔNG drop Case structured (decompose 1→nhiều vẫn chạy)', () => {
    const r = decomposeLegacyRecord({
      ...base,
      phan_loai_nguon_tin_ban_dau: 'kien-nghi-vks',
      quyet_dinh_khoi_to_vu_an: 'QĐ-9',
      so_luong_bi_hai: '2',
    });
    expect(r.proposal).toBeDefined();
    expect(r.case).toBeDefined(); // có khởi tố → tạo Case dạng structured, không chỉ legacyRaw
    expect(r.case!.soQuyetDinhKhoiTo).toBe('QĐ-9');
    expect(r.statistic).toBeDefined(); // statistic gắn vào case
    expect(r.statistic!.soLuongBiHai).toBe(2);
  });

  it('phân loại hoàn toàn lạ → warning, không tạo entity tier-3 nào', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'hoan-toan-la' });
    expect(r.guidance).toBeUndefined();
    expect(r.exchange).toBeUndefined();
    expect(r.proposal).toBeUndefined();
    expect(r.lawyer).toBeUndefined();
    expect(r.case).toBeUndefined();
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});
