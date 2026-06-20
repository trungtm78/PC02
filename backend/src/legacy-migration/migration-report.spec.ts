import { buildMigrationReport } from './migration-report';

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
});
