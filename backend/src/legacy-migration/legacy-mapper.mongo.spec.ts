import { decomposeLegacyRecord, parseLegacyDate, legacyKey } from './legacy-mapper';

/**
 * Bộ test cho 3 lỗi ĐÃ KIỂM CHỨNG trên 100% dump MongoDB hệ cũ (không lấy mẫu).
 * Xem kế hoạch di trú: P1-1 (đụng khoá), P1-2 (epoch lệch 14h), P1-3 (bịa ngày).
 */

describe('P1-2 — parseLegacyDate với epoch giây của MongoDB', () => {
  // Đo trên 53.796 hồ sơ có đủ ngay/thang/nam để đối chiếu:
  //   đọc theo UTC     → khớp 0 (0,00%)
  //   epoch +7h  (VN)  → khớp 0 (0,00%)
  //   epoch +50400s    → khớp 53.795 (100,00%)
  // Nguyên nhân: PHP cũ trừ offset +7 hai lần. value % 86400 = 36000 ở 100% giá trị.
  it('epoch 1488967200 (hồ sơ id=1) → 9/3/2017, KHÔNG phải 8/3', () => {
    const d = parseLegacyDate(1488967200);
    expect(d).toBeInstanceOf(Date);
    expect(d!.getUTCFullYear()).toBe(2017);
    expect(d!.getUTCMonth() + 1).toBe(3);
    expect(d!.getUTCDate()).toBe(9);
  });

  it('trả về đúng nửa đêm UTC (không giữ phần giờ 10:00)', () => {
    const d = parseLegacyDate(1488967200)!;
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });

  it('epoch 1490263200 → 24/3/2017 và 1492596000 → 20/4/2017', () => {
    const a = parseLegacyDate(1490263200)!;
    expect([a.getUTCDate(), a.getUTCMonth() + 1, a.getUTCFullYear()]).toEqual([24, 3, 2017]);
    const b = parseLegacyDate(1492596000)!;
    expect([b.getUTCDate(), b.getUTCMonth() + 1, b.getUTCFullYear()]).toEqual([20, 4, 2017]);
  });

  it('epoch bảng ho_so mới 1767434400 → 4/1/2026 (cùng quy tắc, cùng code base cũ)', () => {
    const d = parseLegacyDate(1767434400)!;
    expect([d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()]).toEqual([4, 1, 2026]);
  });

  it('sentinel rỗng 0 và -25200 → undefined, KHÔNG phải năm 1970', () => {
    expect(parseLegacyDate(0)).toBeUndefined();
    expect(parseLegacyDate(-25200)).toBeUndefined();
  });

  it('HỒI QUY: Excel serial vẫn chạy như cũ (36526 → 1/1/2000)', () => {
    const d = parseLegacyDate(36526)!;
    expect([d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()]).toEqual([1, 1, 2000]);
  });

  it('HỒI QUY: chuỗi dd/mm/yyyy và yyyy-mm-dd vẫn chạy', () => {
    expect(parseLegacyDate('09/03/2017')!.getUTCDate()).toBe(9);
    expect(parseLegacyDate('2017-03-09')!.getUTCDate()).toBe(9);
  });

  it('chuỗi toàn số vẫn KHÔNG bị nhận nhầm thành ngày (số quyết định)', () => {
    expect(parseLegacyDate('1488967200')).toBeUndefined();
  });
});

describe('P1-1 — legacyKey: khoá phải kèm tên collection', () => {
  // Đo thực tế: ho_so.id = [1,2,3,4] TRÙNG 100% với id của ho_so_doi_1 (chạy 1…53.820).
  // Khoá trần sẽ khiến 4 hồ sơ 01/2026 GHI ĐÈ 4 hồ sơ 2017.
  it('cùng id nhưng khác collection → khoá KHÁC nhau', () => {
    const a = legacyKey({ id: 1, __sourceCollection: 'ho_so_doi_1' });
    const b = legacyKey({ id: 1, __sourceCollection: 'ho_so' });
    expect(a).toBe('ho_so_doi_1:1');
    expect(b).toBe('ho_so:1');
    expect(a).not.toBe(b);
  });

  it('không có __sourceCollection → giữ khoá trần (tương thích ngược)', () => {
    expect(legacyKey({ id: 'L-001' })).toBe('L-001');
  });

  it('decompose gắn khoá có tiền tố vào entity sinh ra', () => {
    const r = decomposeLegacyRecord({
      id: 1,
      __sourceCollection: 'ho_so',
      phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau',
    });
    expect(r.petition!.legacySourceId).toBe('ho_so:1');
  });
});

describe('P1-5 — chuẩn hoá phân loại nguồn tin', () => {
  // 721 hồ sơ rơi ra ngoài: huong-dan (539), "vụ việc" có dấu (89), "" (85),
  // "vụ việc " (7), "vụ án" (1). Trường `loai` sạch hơn, mapper chưa hề đọc.
  it('"vụ việc" có dấu → Incident', () => {
    const r = decomposeLegacyRecord({ id: 1, phan_loai_nguon_tin_ban_dau: 'vụ việc' });
    expect(r.incident).toBeDefined();
  });

  it('"vụ việc " (thừa khoảng trắng) → Incident', () => {
    const r = decomposeLegacyRecord({ id: 1, phan_loai_nguon_tin_ban_dau: 'vụ việc ' });
    expect(r.incident).toBeDefined();
  });

  it('"vụ án" có dấu → Case', () => {
    const r = decomposeLegacyRecord({ id: 1, phan_loai_nguon_tin_ban_dau: 'vụ án' });
    expect(r.case).toBeDefined();
  });

  it('"huong-dan" (539 hồ sơ) → GuidanceRecord', () => {
    const r = decomposeLegacyRecord({ id: 1, phan_loai_nguon_tin_ban_dau: 'huong-dan' });
    expect(r.guidance).toBeDefined();
  });

  it('phân loại RỖNG → dùng `loai` làm nguồn dự phòng', () => {
    const r = decomposeLegacyRecord({ id: 1, phan_loai_nguon_tin_ban_dau: '', loai: 'vu-viec-ban-dau' });
    expect(r.incident).toBeDefined();
  });

  it('phân loại rỗng VÀ loai rỗng → không sinh gì, có cảnh báo', () => {
    const r = decomposeLegacyRecord({ id: 1, phan_loai_nguon_tin_ban_dau: '', loai: '' });
    expect(r.petition ?? r.incident ?? r.case).toBeUndefined();
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('HỒI QUY: giá trị chuẩn cũ vẫn nhận đúng', () => {
    expect(decomposeLegacyRecord({ id: 1, phan_loai_nguon_tin_ban_dau: 'don-cong-van-ban-dau' }).petition).toBeDefined();
    expect(decomposeLegacyRecord({ id: 1, phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau' }).incident).toBeDefined();
    expect(decomposeLegacyRecord({ id: 1, phan_loai_nguon_tin_ban_dau: 'vu-an-ban-dau' }).case).toBeDefined();
  });
});

describe('P2-2 — legacyRaw chỉ lưu MỘT bản', () => {
  // legacyRaw: {...rec} có ở cả 3 builder → 1 hồ sơ sinh 3 thực thể = 3 bản sao ~6,7KB.
  it('một record sinh nhiều thực thể → chỉ 1 thực thể giữ legacyRaw', () => {
    const r = decomposeLegacyRecord({
      id: 1,
      phan_loai_nguon_tin_ban_dau: 'vu-viec-ban-dau',
      quyet_dinh_khoi_to_vu_an: 'QĐ 01/QĐ-CSĐT',
    });
    const withRaw = [r.petition, r.incident, r.case].filter((e) => e && e.legacyRaw);
    expect(withRaw).toHaveLength(1);
  });
});
