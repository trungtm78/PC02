import { buildMigrationReport, buildFieldCoverage } from './migration-report';

const recs = [
  { id: '1', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau', ten_ca_nhan_co_quan_to_chuc_cung_cap: 'A', tom_tat_noi_dung: 'x' },
  { id: '2', phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau', tom_tat_noi_dung: 'y', quyet_dinh_khoi_to_vu_an: 'QĐ1' },
  { id: '3', phan_loai_nguon_tin_ban_dau: 'vu-an-ban-dau', tom_tat_noi_dung: 'z' },
  { id: '4', phan_loai_nguon_tin_ban_dau: 'khong-biet' },
];

describe('buildMigrationReport', () => {
  const r = buildMigrationReport(recs);

  it('đếm đúng số entity sẽ tạo (decompose 1→nhiều)', () => {
    expect(r.totalRecords).toBe(4);
    expect(r.willCreatePetitions).toBe(1); // rec1
    expect(r.willCreateIncidents).toBe(1); // rec2
    expect(r.willCreateCases).toBe(2); // rec2 (khởi tố) + rec3
  });

  it('thu thập warning record không map được', () => {
    expect(r.warningsCount).toBe(1);
    expect(r.warnings[0]).toMatch(/không nhận diện|phân loại/i);
  });

  it('phát hiện trùng legacySourceId trong batch', () => {
    const dup = buildMigrationReport([recs[0], { ...recs[0] }]);
    expect(dup.duplicateLegacyIds).toContain('1');
  });

  it('record không có id → cảnh báo thiếu khóa', () => {
    const r2 = buildMigrationReport([{ phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau' }]);
    expect(r2.missingIdCount).toBe(1);
  });

  it('đếm tier ③ (guidance/exchange/proposal/lawyer) — PR-M3', () => {
    const t = buildMigrationReport([
      { id: 'g', phan_loai_nguon_tin_ban_dau: 'huong-dan-ban-dau', tom_tat_noi_dung: 'hd' },
      { id: 'e', phan_loai_nguon_tin_ban_dau: 'trao-doi-chuyen-an', tom_tat_noi_dung: 'td' },
      { id: 'p', phan_loai_nguon_tin_ban_dau: 'kien-nghi-vks', tom_tat_noi_dung: 'kn' },
      { id: 'l', phan_loai_nguon_tin_ban_dau: 'luat-su', ten_ca_nhan_co_quan_to_chuc_cung_cap: 'LS' },
    ]);
    expect(t.willCreateGuidance).toBe(1);
    expect(t.willCreateExchanges).toBe(1);
    expect(t.willCreateProposals).toBe(1);
    expect(t.willCreateLawyers).toBe(1);
    // luat-su tạo thêm host Case
    expect(t.willCreateCases).toBe(1);
  });

  it('warning các loại defer/host (luật sư, trả hồ sơ, TĐC) được đếm vào báo cáo', () => {
    const t = buildMigrationReport([
      { id: 'tr', phan_loai_nguon_tin_ban_dau: 'tra-ho-so-ban-dau', tom_tat_noi_dung: 'th' },
    ]);
    expect(t.warningsCount).toBeGreaterThan(0);
    expect(t.warnings.some((w) => /workflow|trả hồ sơ/i.test(w))).toBe(true);
  });

  it('report đính kèm fieldCoverage matrix', () => {
    const r3 = buildMigrationReport([
      { id: 'x', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau', tom_tat_noi_dung: 'a' },
    ]);
    expect(r3.fieldCoverage).toBeDefined();
    expect(r3.fieldCoverage.provisional).toBe(true);
  });
});

describe('buildFieldCoverage (PR-M4 — Codex P2#1, provisional)', () => {
  it('phân biệt key mapped (cột typed) vs raw-only (chỉ legacyRaw)', () => {
    const fc = buildFieldCoverage([
      {
        id: 'x',
        phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau',
        tom_tat_noi_dung: 'có cột', // mapped
        field_la_khong_co_cot: 'chỉ raw', // raw-only
      },
    ]);
    expect(fc.totalRecords).toBe(1);
    expect(fc.mappedKeys).toBeGreaterThanOrEqual(3); // id + phan_loai + tom_tat_noi_dung
    expect(fc.rawOnlyKeyNames).toContain('field_la_khong_co_cot');
    expect(fc.rawOnlyKeyNames).not.toContain('tom_tat_noi_dung');
  });

  it('rawCoverageRatio = 1 (mọi field giữ ở legacyRaw — no data loss)', () => {
    const fc = buildFieldCoverage([
      { id: 'x', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau', a: '1', b: '2' },
    ]);
    expect(fc.rawCoverageRatio).toBe(1);
  });

  it('bỏ qua key rỗng/null khi đếm distinct (chỉ field non-empty)', () => {
    const fc = buildFieldCoverage([
      { id: 'x', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau', rong: '', nul: null },
    ]);
    expect(fc.rawOnlyKeyNames).not.toContain('rong');
    expect(fc.rawOnlyKeyNames).not.toContain('nul');
  });

  it('provisional = true (Codex P1#5 — chưa khẳng định 132/132 từ record tổng hợp)', () => {
    expect(buildFieldCoverage([]).provisional).toBe(true);
  });

  it('record bị skip (phân loại lạ) → field KHÔNG được preserve: rawCoverageRatio < 1 + lostKeyNames', () => {
    const fc = buildFieldCoverage([
      { id: 'ok', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau', tom_tat_noi_dung: 'a' },
      { id: 'skip', phan_loai_nguon_tin_ban_dau: 'khong-biet', foo_chi_o_record_skip: 'mất' },
    ]);
    expect(fc.skippedRecords).toBe(1);
    expect(fc.lostKeyNames).toContain('foo_chi_o_record_skip');
    expect(fc.rawCoverageRatio).toBeLessThan(1);
  });

  it('record thiếu id → bị skip, key chỉ ở đó tính là lost', () => {
    const fc = buildFieldCoverage([
      { phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau', chi_o_record_thieu_id: 'x' },
    ]);
    expect(fc.skippedRecords).toBe(1);
    expect(fc.lostKeyNames).toContain('chi_o_record_thieu_id');
  });

  // ── Vá test-gap từ mutation testing (mutant sống) ──
  it('key chỉ chứa whitespace KHÔNG tính là distinct (isNonEmpty trim)', () => {
    const fc = buildFieldCoverage([
      { id: 'x', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau', chi_whitespace: '   ' },
    ]);
    expect(fc.rawOnlyKeyNames).not.toContain('chi_whitespace');
  });

  it('typedCoverageRatio > 0 khi batch có key mapped (không phải luôn 0)', () => {
    const fc = buildFieldCoverage([
      { id: 'x', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau', tom_tat_noi_dung: 'a' },
    ]);
    expect(fc.typedCoverageRatio).toBeGreaterThan(0);
  });

  it('duplicateLegacyIds CHỈ chứa id trùng (n>1), KHÔNG gồm id xuất hiện 1 lần', () => {
    const r = buildMigrationReport([
      { id: 'dup', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau' },
      { id: 'dup', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau' },
      { id: 'unique', phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau' },
    ]);
    expect(r.duplicateLegacyIds).toContain('dup');
    expect(r.duplicateLegacyIds).not.toContain('unique');
  });
});
