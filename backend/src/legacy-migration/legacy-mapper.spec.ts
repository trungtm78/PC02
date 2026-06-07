import { decomposeLegacyRecord, parseLegacyDate } from './legacy-mapper';

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

  it('phân loại lạ → warning, không tạo entity nào', () => {
    const r = decomposeLegacyRecord({ ...base, phan_loai_nguon_tin_ban_dau: 'khong-biet' });
    expect(r.petition).toBeUndefined();
    expect(r.incident).toBeUndefined();
    expect(r.case).toBeUndefined();
    expect(r.warnings.some((w) => /phân loại/i.test(w))).toBe(true);
  });
});
