import { describe, it, expect } from 'vitest';
import { DATE_RANGE_PRESETS, tinhKhoangThoiGian } from '../dateRangePresets';

/**
 * "Chọn khoảng thời gian" của hệ cũ — nút mở danh sách mốc dựng sẵn rồi điền vào ô
 * Từ ngày / Đến ngày. Thuần frontend: chỉ tính hai mốc rồi ghi vào bộ lọc đã có.
 *
 * Mốc "hôm nay" truyền vào thay vì gọi `new Date()` bên trong, để ca kiểm cố định được
 * thời điểm và không đỏ theo ngày chạy.
 */
const HOM_NAY = new Date(2026, 7, 25); // thứ Ba, 25/08/2026

describe('DATE_RANGE_PRESETS', () => {
  it('đủ năm mốc và không trùng khoá', () => {
    const keys = DATE_RANGE_PRESETS.map((p) => p.key);
    expect(keys).toEqual(['hom-nay', 'tuan-nay', 'thang-nay', 'quy-nay', 'nam-nay']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('mốc nào cũng có nhãn tiếng Việt để hiện trên nút', () => {
    for (const p of DATE_RANGE_PRESETS) expect(p.label.length).toBeGreaterThan(0);
  });
});

describe('tinhKhoangThoiGian', () => {
  it('hôm nay: từ và đến cùng một ngày', () => {
    expect(tinhKhoangThoiGian('hom-nay', HOM_NAY)).toEqual({
      fromDate: '2026-08-25',
      toDate: '2026-08-25',
    });
  });

  it('tuần này bắt đầu từ THỨ HAI — tuần làm việc Việt Nam, không phải Chủ nhật', () => {
    // 25/08/2026 là thứ Ba → thứ Hai là 24/08.
    expect(tinhKhoangThoiGian('tuan-nay', HOM_NAY)).toEqual({
      fromDate: '2026-08-24',
      toDate: '2026-08-30',
    });
  });

  it('tuần này khi hôm nay là CHỦ NHẬT vẫn lùi về thứ Hai tuần đó', () => {
    // 30/08/2026 là Chủ nhật. Nếu tính theo chuẩn Mỹ, Chủ nhật thành ĐẦU tuần sau —
    // cán bộ bấm "Tuần này" ngày Chủ nhật sẽ mất cả tuần vừa làm.
    const chuNhat = new Date(2026, 7, 30);
    expect(tinhKhoangThoiGian('tuan-nay', chuNhat)).toEqual({
      fromDate: '2026-08-24',
      toDate: '2026-08-30',
    });
  });

  it('tháng này: từ mùng 1 tới ngày cuối tháng', () => {
    expect(tinhKhoangThoiGian('thang-nay', HOM_NAY)).toEqual({
      fromDate: '2026-08-01',
      toDate: '2026-08-31',
    });
  });

  it('tháng có 30 ngày và tháng 2 năm nhuận đều tính đúng ngày cuối', () => {
    expect(tinhKhoangThoiGian('thang-nay', new Date(2026, 8, 10)).toDate).toBe('2026-09-30');
    expect(tinhKhoangThoiGian('thang-nay', new Date(2028, 1, 10)).toDate).toBe('2028-02-29');
  });

  it('quý này: 25/08 thuộc quý III', () => {
    expect(tinhKhoangThoiGian('quy-nay', HOM_NAY)).toEqual({
      fromDate: '2026-07-01',
      toDate: '2026-09-30',
    });
  });

  it('năm nay: trọn năm dương lịch', () => {
    expect(tinhKhoangThoiGian('nam-nay', HOM_NAY)).toEqual({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
    });
  });

  it('khoá lạ trả null — không đoán bừa một khoảng thời gian', () => {
    expect(tinhKhoangThoiGian('khong-co-that' as never, HOM_NAY)).toBeNull();
  });
});
