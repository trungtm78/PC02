import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LegacyParityFields } from '@/components/LegacyParityFields';
import { LEGACY_PARITY_FIELDS } from '@/shared/legacy/legacyParityFields.generated';

/**
 * Xoá trắng một ô trong panel "Thông tin nghiệp vụ bổ sung" phải gửi `null`, không `undefined`.
 *
 * `undefined` bị loại khỏi thân lời gọi JSON, nên máy chủ không thấy khoá (`dto.X !== undefined`
 * là sai) và giữ nguyên giá trị cũ: cán bộ xoá trắng, bấm Lưu, mở lại thấy y nguyên thứ vừa
 * xoá. Cùng lớp lỗi đã vá ở form Vụ án (#245), Đơn thư và Vụ việc — panel này là chỗ cuối
 * cùng còn sót, và nó dùng chung cho CẢ BA màn.
 */
const THUC_THE = ['case', 'petition', 'incident'] as const;

/** Ô chữ đầu tiên của thực thể mà panel còn dựng (form chính chưa chiếm). */
function oChuDauTien(entity: (typeof THUC_THE)[number]): string | null {
  const ds = LEGACY_PARITY_FIELDS[entity] ?? [];
  const o = ds.find((d) => d.kind === 'text');
  return o?.col ?? null;
}

describe('Panel parity: xoá trắng thì gửi null, không bỏ khoá', () => {
  it.each(THUC_THE)('thực thể "%s"', (entity) => {
    const col = oChuDauTien(entity);
    if (!col) return;

    const onChange = vi.fn();
    render(<LegacyParityFields entity={entity} values={{ [col]: 'giá trị cũ' }} onChange={onChange} />);
    const nut = screen.queryByTestId('parity-fields-toggle');
    if (nut) fireEvent.click(nut);

    const o = screen.queryByTestId(`parity-field-${col}`);
    if (!o) return; // form chính đã chiếm ô này — panel im, đúng theo cổng dedup

    fireEvent.change(o, { target: { value: '' } });
    expect(onChange).toHaveBeenCalled();
    const [, giaTri] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(giaTri).toBeNull();
    expect(giaTri).not.toBeUndefined();
  });

  /**
   * Ô số cũng vậy: bỏ trống một con số là một hành động, không phải "không nhắc tới".
   */
  it('ô số xoá trắng cũng gửi null', () => {
    const so = (LEGACY_PARITY_FIELDS.case ?? []).find((d) => d.kind === 'number');
    if (!so) return;

    const onChange = vi.fn();
    render(<LegacyParityFields entity="case" values={{ [so.col]: 7 }} onChange={onChange} />);
    const nut = screen.queryByTestId('parity-fields-toggle');
    if (nut) fireEvent.click(nut);

    const o = screen.queryByTestId(`parity-field-${so.col}`);
    if (!o) return;

    fireEvent.change(o, { target: { value: '' } });
    const [, giaTri] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(giaTri).toBeNull();
  });
});
