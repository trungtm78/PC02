import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LegacyFilterPanel, type LegacyFilterField } from '../LegacyFilterPanel';

/**
 * Thẻ lọc hai vế theo hệ cũ. Panel THUẦN TRÌNH BÀY: nhận giá trị + gọi lại, không tự đụng
 * địa chỉ trang — nhờ vậy kiểm được mà không cần dựng router.
 */
const FIELDS: LegacyFilterField[] = [
  { key: 'search', label: 'Từ khóa', type: 'text', placeholder: 'Tìm kiếm', side: 'left' },
  {
    key: 'enteredById',
    label: 'Cán bộ nhập',
    type: 'select',
    side: 'left',
    options: [
      { value: '', label: 'Tất cả' },
      { value: 'u1', label: 'Trần Hoàng Duy' },
    ],
  },
  { key: 'stt', label: 'STT', type: 'text', side: 'right' },
  { key: 'sttCu', label: 'STT cũ', type: 'text', side: 'right' },
  { key: 'fromDate', label: 'Từ ngày', type: 'date', side: 'right' },
  { key: 'toDate', label: 'Đến ngày', type: 'date', side: 'right' },
];

function setup(over: Partial<React.ComponentProps<typeof LegacyFilterPanel>> = {}) {
  const props = {
    fields: FIELDS,
    values: {},
    onChange: vi.fn(),
    onApply: vi.fn(),
    onReset: vi.fn(),
    today: new Date(2026, 7, 25),
    ...over,
  };
  render(<LegacyFilterPanel {...props} />);
  return props;
}

describe('LegacyFilterPanel', () => {
  it('hiện đủ ô lọc, mỗi ô có nhãn liên kết đúng', () => {
    setup();
    for (const f of FIELDS) {
      expect(screen.getByLabelText(f.label)).toBeInTheDocument();
    }
  });

  it('chia đúng hai vế trái/phải như hệ cũ', () => {
    setup();
    const trai = screen.getByTestId('legacy-filter-left');
    const phai = screen.getByTestId('legacy-filter-right');
    expect(trai).toContainElement(screen.getByLabelText('Từ khóa'));
    expect(phai).toContainElement(screen.getByLabelText('STT'));
  });

  it('gõ vào ô gọi onChange đúng khoá', async () => {
    const user = userEvent.setup();
    const p = setup();
    await user.type(screen.getByLabelText('STT'), '2');
    expect(p.onChange).toHaveBeenCalledWith({ stt: '2' });
  });

  it('chọn cán bộ nhập gọi onChange đúng giá trị', async () => {
    const user = userEvent.setup();
    const p = setup();
    await user.selectOptions(screen.getByLabelText('Cán bộ nhập'), 'u1');
    expect(p.onChange).toHaveBeenCalledWith({ enteredById: 'u1' });
  });

  it('bấm Tìm kiếm gọi onApply, bấm Xóa bộ lọc gọi onReset', async () => {
    const user = userEvent.setup();
    const p = setup();
    await user.click(screen.getByRole('button', { name: /tìm kiếm/i }));
    expect(p.onApply).toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /xóa bộ lọc/i }));
    expect(p.onReset).toHaveBeenCalled();
  });

  it('Enter trong ô lọc cũng tìm — cán bộ nhập liệu không rời bàn phím', async () => {
    const user = userEvent.setup();
    const p = setup();
    await user.type(screen.getByLabelText('STT'), '{Enter}');
    expect(p.onApply).toHaveBeenCalled();
  });

  it('nút Xuất Excel chỉ hiện khi có nơi nhận — không hiện nút chết', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.queryByRole('button', { name: /xuất excel/i })).not.toBeInTheDocument();

    const onExportExcel = vi.fn();
    render(
      <LegacyFilterPanel
        fields={FIELDS}
        values={{}}
        onChange={vi.fn()}
        onApply={vi.fn()}
        onReset={vi.fn()}
        onExportExcel={onExportExcel}
        today={new Date(2026, 7, 25)}
      />,
    );
    await user.click(screen.getAllByRole('button', { name: /xuất excel/i })[0]);
    expect(onExportExcel).toHaveBeenCalled();
  });

  it('chọn khoảng thời gian ghi Từ ngày và Đến ngày trong MỘT lần gọi', async () => {
    const user = userEvent.setup();
    const p = setup();
    await user.click(screen.getByRole('button', { name: /chọn khoảng thời gian/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Tháng này' }));

    // Hai lần gọi rời nhau sẽ khiến lần sau ghi đè trạng thái của lần trước ở component
    // cha có kiểm soát — mốc thứ hai biến mất mà không ai thấy.
    expect(p.onChange).toHaveBeenCalledTimes(1);
    expect(p.onChange).toHaveBeenCalledWith({ fromDate: '2026-08-01', toDate: '2026-08-31' });
  });

  it('hiện lại giá trị đang lọc — tải lại trang không mất bộ lọc', () => {
    setup({ values: { stt: '26-11171', fromDate: '2026-08-01' } });
    expect(screen.getByLabelText('STT')).toHaveValue('26-11171');
    expect(screen.getByLabelText('Từ ngày')).toHaveValue('2026-08-01');
  });
});
