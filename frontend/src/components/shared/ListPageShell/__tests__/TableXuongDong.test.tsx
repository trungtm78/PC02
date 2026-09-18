import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ListPageShell } from '../ListPageShell';
import { Table } from '../Table';
import type { ColumnDef } from '../Table';
import type { UseBulkSelectionResult } from '@/features/_shared/bulk/useBulkSelection';

/**
 * Anh yêu cầu 18/09/2026: các cột xuống dòng để thấy đủ nội dung, và có thanh cuộn ngang ở trên bảng.
 *
 * Bẫy cũ (styles.ts, 25/08/2026): cho chữ xuống dòng thì bề rộng tối thiểu của bảng tụt, bảng co khít khung,
 * 13 cột bị ép và mất thanh cuộn ngang. Vì vậy chế độ xuống dòng phải LUÔN đặt bề rộng tối thiểu = tổng bề rộng
 * khai của các cột đang hiện: chữ xuống dòng TRONG cột, bảng rộng hơn khung thì vẫn cuộn ngang.
 */
type Row = { id: string };
const ROWS: Row[] = [{ id: 'r1' }];
const COT: ColumnDef<Row>[] = [
  { key: 'actions', header: 'Thao tác', width: '7rem', sticky: true, cellClassName: 'o-thao-tac', render: () => 'x' },
  { key: 'tomTat', header: 'Tóm tắt', width: '20rem', render: () => 'y' },
  { key: 'nguon', header: 'Nguồn', width: '120px', render: () => 'z' },
];

function ve(props: Record<string, unknown> = {}) {
  render(
    <ListPageShell>
      <Table state="ready" columns={COT} data={ROWS} rowKey={(r: Row) => r.id} fixedLayout {...props} />
    </ListPageShell>,
  );
}

/** Các số hạng trong `calc(a + b + …)` — jsdom tự sắp lại thứ tự, nên so TẬP số hạng. */
function soHang(minWidth: string): string[] {
  return (/^calc\((.*)\)$/.exec(minWidth)?.[1] ?? '').split(' + ').sort();
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('<Table xuongDong>', () => {
  it('ô dữ liệu mặc định xuống dòng và canh trên; ô khai lớp riêng giữ lớp riêng', () => {
    ve({ xuongDong: true });
    const o = screen.getByText('y').closest('td')!;
    expect(o.className).toMatch(/\bwhitespace-normal\b/);
    expect(o.className).toMatch(/\balign-top\b/);
    expect(o.className).not.toMatch(/\bwhitespace-nowrap\b/);
    expect(screen.getByText('x').closest('td')!.className).toMatch(/\bo-thao-tac\b/);
  });

  it('LUÔN đặt bề rộng tối thiểu = tổng bề rộng khai (kể cả chưa kéo cột nào)', () => {
    ve({ xuongDong: true });
    const bang = screen.getByRole('table');
    expect(soHang(bang.style.minWidth)).toEqual(['120px', '20rem', '7rem']);
  });

  it('có ô tick chọn nhiều dòng → cộng cả bề rộng ô tick', () => {
    const chon: UseBulkSelectionResult = {
      selectedIds: new Set<string>(),
      mode: 'page',
      count: 0,
      pageState: 'none',
      isSelected: () => false,
      toggleOne: vi.fn(),
      togglePage: vi.fn(),
      selectAllMatchingFilter: vi.fn(),
      clear: vi.fn(),
    };
    ve({ xuongDong: true, bulkSelection: chon });
    expect(soHang(screen.getByRole('table').style.minWidth)).toEqual([
      '120px',
      '2.5rem',
      '20rem',
      '7rem',
    ]);
  });

  it('bảng tràn khung → có thanh cuộn ngang ở TRÊN bảng', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(2400);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    ve({ xuongDong: true });
    const thanh = screen.getByTestId('thanh-cuon-ngang-tren');
    // Thanh đứng TRƯỚC khung bảng.
    expect(thanh.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    vi.restoreAllMocks();
  });

  it('KHÔNG bật xuongDong → bảng giữ nguyên như cũ (không bề rộng tối thiểu, ô không xuống dòng)', () => {
    ve();
    expect(screen.getByRole('table').style.minWidth).toBe('');
    expect(screen.getByText('y').closest('td')!.className).toMatch(/\bwhitespace-nowrap\b/);
    expect(screen.queryByTestId('thanh-cuon-ngang-tren')).not.toBeInTheDocument();
  });
});
