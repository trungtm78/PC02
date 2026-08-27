import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LegacyParityFields } from '@/components/LegacyParityFields';
import { LEGACY_PARITY_FIELDS } from '@/shared/legacy/legacyParityFields.generated';
import { ownedColumnsFor } from '../registry';

/**
 * CỔNG: một cột chỉ được có MỘT ô nhập — cho MỌI thực thể, không chỉ Vụ án.
 *
 * Panel "Thông tin nghiệp vụ bổ sung" cuối trang dựng ô cho các cột di trú. Nếu form chính đã
 * có ô cho cùng cột ấy thì cán bộ nhìn thấy hai ô — và vì giá trị panel được gộp vào payload
 * SAU giá trị form, panel THẮNG. Cán bộ gõ trong tab, bấm Lưu, giá trị bị thay bằng thứ panel
 * đang giữ. Mất dữ liệu trong đúng một lần lưu, không thông báo gì.
 *
 * Đây là rủi ro lớn nhất khi bật bố cục hệ cũ cho một thực thể mới. Trước 26/08/2026 panel rẽ
 * nhánh `entity === "case"` viết cứng, nên chỉ cần quên sửa chỗ ấy là lỗi xuất hiện im lặng.
 * Nay tra bảng `ownedColumnsFor`, và cổng này chạy cho cả ba thực thể — có hiệu lực TỪ TRƯỚC
 * khi Đơn thư được dựng, chứ không phải sau.
 */
const THUC_THE = ['case', 'petition', 'incident'] as const;

describe('Một cột chỉ được có một ô nhập', () => {
  it.each(THUC_THE)('thực thể "%s": panel không dựng ô cho cột form đã sở hữu', (entity) => {
    render(<LegacyParityFields entity={entity} values={{}} onChange={vi.fn()} />);

    // Panel gập sẵn — không mở ra thì không ô nào tồn tại và ca kiểm xanh vì lý do sai.
    const nut = screen.queryByRole('button');
    if (nut) fireEvent.click(nut);

    const formSoHuu = ownedColumnsFor(entity);
    const trung = (LEGACY_PARITY_FIELDS[entity] ?? [])
      .map((d) => d.col)
      .filter((col) => formSoHuu.has(col))
      .filter((col) => screen.queryByTestId(`parity-field-${col}`) !== null);

    expect(trung).toEqual([]);
  });

  /**
   * Bảng tra phải thật sự trả về tập cột của Vụ án. Nếu nó rơi về tập rỗng thì ca kiểm trên
   * xanh một cách vô nghĩa — không cột nào "form sở hữu" thì không có gì để trùng.
   */
  it('bảng tra trả đúng tập cột của Vụ án, không rơi về rỗng', () => {
    const cot = ownedColumnsFor('case');
    expect(cot.size).toBeGreaterThan(50);
    expect(cot.has('moTaChiTiet')).toBe(true);
    expect(cot.has('nguonDon')).toBe(true);
  });

  it('Đơn thư đã dựng theo đặc tả nên bảng tra trả về tập cột của nó', () => {
    const cot = ownedColumnsFor('petition');
    expect(cot.has('senderName')).toBe(true);
    expect(cot.has('detailContent')).toBe(true);
  });

  it('Vụ việc đã dựng theo đặc tả nên bảng tra trả về tập cột của nó', () => {
    const cot = ownedColumnsFor('incident');
    expect(cot.has('nhanXet')).toBe(true);
    expect(cot.has('chuyenTuDonVi')).toBe(true);
    expect(cot.size).toBeGreaterThan(40);
  });

  it('thực thể chưa dựng theo đặc tả trả tập rỗng, không ném lỗi', () => {
    expect(ownedColumnsFor('khong-co-that').size).toBe(0);
  });
});
