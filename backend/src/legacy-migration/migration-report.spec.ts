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
});
