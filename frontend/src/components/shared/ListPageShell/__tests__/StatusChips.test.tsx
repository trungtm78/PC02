import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListPageShell } from '../ListPageShell';
import { StatusChips, type StatusChipOption } from '../StatusChips';

const OPTIONS: StatusChipOption[] = [
  { value: 'TIEP_NHAN', shortLabel: 'Tiếp nhận', label: 'Tiếp nhận', count: 12 },
  { value: 'DANG_DIEU_TRA', shortLabel: 'Điều tra', label: 'Đang điều tra', count: 45 },
  { value: 'DA_KET_LUAN', shortLabel: 'Kết luận', label: 'Đã kết luận', count: 7 },
];

describe('<ListPageShell.StatusChips>', () => {
  it('render "Tất cả" pseudo-chip + tất cả options', () => {
    render(
      <ListPageShell>
        <StatusChips options={OPTIONS} activeValue={null} onChange={() => {}} />
      </ListPageShell>,
    );
    expect(screen.getByRole('tab', { name: /Tất cả/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Tiếp nhận/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Điều tra/i })).toBeInTheDocument();
  });

  it('container có role="tablist" (a11y contract)', () => {
    render(
      <ListPageShell>
        <StatusChips options={OPTIONS} activeValue={null} onChange={() => {}} />
      </ListPageShell>,
    );
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('chip active có aria-selected=true, others false', () => {
    render(
      <ListPageShell>
        <StatusChips options={OPTIONS} activeValue="TIEP_NHAN" onChange={() => {}} />
      </ListPageShell>,
    );
    const tiepNhan = screen.getByRole('tab', { name: /Tiếp nhận/i });
    const dieuTra = screen.getByRole('tab', { name: /Điều tra/i });
    expect(tiepNhan).toHaveAttribute('aria-selected', 'true');
    expect(dieuTra).toHaveAttribute('aria-selected', 'false');
  });

  it('mỗi chip có aria-controls=tableId từ Context', () => {
    render(
      <ListPageShell>
        <StatusChips options={OPTIONS} activeValue={null} onChange={() => {}} />
      </ListPageShell>,
    );
    const allTab = screen.getByRole('tab', { name: /Tất cả/i });
    const controlsId = allTab.getAttribute('aria-controls');
    expect(controlsId).toMatch(/^list-page-shell-.+-table$/);
  });

  it('count pill render khi count > 0', () => {
    render(
      <ListPageShell>
        <StatusChips options={OPTIONS} activeValue={null} onChange={() => {}} />
      </ListPageShell>,
    );
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('count pill dùng _ACTIVE token trên active chip, _INACTIVE trên inactive', () => {
    render(
      <ListPageShell>
        <StatusChips options={OPTIONS} activeValue="TIEP_NHAN" onChange={() => {}} />
      </ListPageShell>,
    );
    const activeCountPill = screen.getByText('12').closest('span');
    expect(activeCountPill?.className).toContain('bg-white/20');
    const inactiveCountPill = screen.getByText('45').closest('span');
    expect(inactiveCountPill?.className).toContain('bg-slate-200');
  });

  it('click chip gọi onChange với value', () => {
    const onChange = vi.fn();
    render(
      <ListPageShell>
        <StatusChips options={OPTIONS} activeValue={null} onChange={onChange} />
      </ListPageShell>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Tiếp nhận/i }));
    expect(onChange).toHaveBeenCalledWith('TIEP_NHAN');
  });

  it('click "Tất cả" gọi onChange với null (clear filter)', () => {
    const onChange = vi.fn();
    render(
      <ListPageShell>
        <StatusChips options={OPTIONS} activeValue="TIEP_NHAN" onChange={onChange} />
      </ListPageShell>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Tất cả/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('mỗi chip có title=label cho tooltip (shortLabel truncate fallback)', () => {
    render(
      <ListPageShell>
        <StatusChips options={OPTIONS} activeValue={null} onChange={() => {}} />
      </ListPageShell>,
    );
    const dieuTra = screen.getByRole('tab', { name: /Điều tra/i });
    expect(dieuTra).toHaveAttribute('title', 'Đang điều tra');
  });

  it('countsLoading=true hiển thị skeleton dot thay vì count', () => {
    render(
      <ListPageShell>
        <StatusChips options={OPTIONS} activeValue={null} onChange={() => {}} countsLoading />
      </ListPageShell>,
    );
    expect(screen.queryByText('12')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('status-chip-count-skeleton').length).toBeGreaterThan(0);
  });

  /**
   * "Đã hỏi và hỏng" là câu trả lời THỨ BA, cạnh "đang hỏi" và "đã hỏi, không có gì".
   *
   * Đo trên máy thật 29/08/2026: chặn máy chủ rồi mở /objects · /people/* · /lawyers ·
   * /uy-thac-dieu-tra thì chip "Tất cả" hiện số 0 — trong khi kho có hàng nghìn bản ghi. Số 0
   * ấy đọc như một câu trả lời, chứ không đọc như một sự cố.
   */
  it('countsUnknown=true hiện dấu gạch, không hiện số 0', () => {
    render(
      <ListPageShell>
        <StatusChips
          options={OPTIONS}
          activeValue={null}
          onChange={() => {}}
          totalCount={0}
          countsUnknown
        />
      </ListPageShell>,
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('countsUnknown=false vẫn hiện số thật, kể cả số 0', () => {
    render(
      <ListPageShell>
        <StatusChips options={OPTIONS} activeValue={null} onChange={() => {}} totalCount={0} />
      </ListPageShell>,
    );
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('throw nếu render ngoài <ListPageShell>', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(<StatusChips options={OPTIONS} activeValue={null} onChange={() => {}} />),
    ).toThrow(/ListPageShell/);
    spy.mockRestore();
  });
});
