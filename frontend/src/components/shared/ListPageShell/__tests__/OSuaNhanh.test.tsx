import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OSuaNhanh } from '../OSuaNhanh';

/** Dựng ô TRONG một dòng bấm được — bảng thật có `<tr onClick>` mở hồ sơ. */
function trongDong(props: Parameters<typeof OSuaNhanh>[0], onRow = vi.fn()) {
  render(
    <table>
      <tbody>
        <tr onClick={onRow}>
          <td>
            <OSuaNhanh {...props} />
          </td>
        </tr>
      </tbody>
    </table>,
  );
  return onRow;
}

const CHUNG = {
  nhanThem: 'Nhập kết quả',
  moTa: 'Kết quả xử lý đơn 2026-11973',
  testId: 'o-ket-qua-p1',
};

describe('OSuaNhanh — ô sửa nhanh trong bảng', () => {
  /**
   * Đo bản sao prod 23/09/2026: 76% ô của cột "Kết quả xử lý" là RỖNG (11.225/46.741 có chữ).
   * Ô rỗng mới là ca dùng chính — nó phải mời cán bộ nhập, không phải hiện một dấu gạch ngang.
   *
   * Bản trước hiện đúng "—" và chỗ bấm là gạch chân chấm chỉ lộ khi rê chuột: trên bảng 50 dòng
   * không ai rê từng ô để khám phá. Đó là lỗi anh báo.
   */
  it('ô RỖNG: hiện nhãn chữ VÀ icon, không còn dấu gạch trơn', () => {
    trongDong({ ...CHUNG, giaTri: null, onSua: vi.fn() });
    const nut = screen.getByTestId('o-ket-qua-p1');
    expect(nut).toHaveTextContent('Nhập kết quả');
    expect(nut.querySelector('svg'), 'không có icon — đúng lỗi anh báo').toBeTruthy();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('ô CÓ chữ: hiện chữ, và icon là nút', () => {
    trongDong({ ...CHUNG, giaTri: 'Đã chuyển Công an phường', onSua: vi.fn() });
    expect(screen.getByText('Đã chuyển Công an phường')).toBeInTheDocument();
    expect(screen.getByTestId('o-ket-qua-p1').querySelector('svg')).toBeTruthy();
  });

  /**
   * `DESIGN.md §11.2` cho ô cùng loại (`SummaryCell`): "Bấm vào CHỮ (ngoài nút) vẫn mở hồ sơ như
   * mọi ô khác." Bản trước bọc CẢ Ô trong một `<button>` nên bấm chữ không mở được hồ sơ —
   * cột duy nhất trong bảng cư xử khác mọi cột còn lại.
   */
  it('bấm vào CHỮ: KHÔNG gọi sửa nhanh, để dòng mở hồ sơ như mọi cột khác', () => {
    const onSua = vi.fn();
    const onRow = trongDong({ ...CHUNG, giaTri: 'Đã chuyển Công an phường', onSua });
    fireEvent.click(screen.getByText('Đã chuyển Công an phường'));
    expect(onSua).not.toHaveBeenCalled();
    expect(onRow, 'bấm chữ phải mở hồ sơ').toHaveBeenCalled();
  });

  it('bấm NÚT: gọi sửa nhanh và CHẶN LAN — không nhảy sang màn sửa', () => {
    const onSua = vi.fn();
    const onRow = trongDong({ ...CHUNG, giaTri: null, onSua });
    fireEvent.click(screen.getByTestId('o-ket-qua-p1'));
    expect(onSua).toHaveBeenCalledTimes(1);
    expect(onRow, 'không chặn lan thì popup mở xong màn cũng nhảy đi').not.toHaveBeenCalled();
  });

  /** `SummaryCell.tsx:66` chặn cả hai chiều. Đi lệch nếp nhà là để sẵn bẫy cho ngày bảng nhận phím. */
  it('phím trên NÚT cũng chặn lan', () => {
    const onRow = vi.fn();
    render(
      <table>
        <tbody>
          <tr onKeyDown={onRow}>
            <td>
              <OSuaNhanh {...CHUNG} giaTri={null} onSua={vi.fn()} />
            </td>
          </tr>
        </tbody>
      </table>,
    );
    fireEvent.keyDown(screen.getByTestId('o-ket-qua-p1'), { key: 'Enter' });
    expect(onRow).not.toHaveBeenCalled();
  });

  it('chỉ XEM: không có nút nào, chữ vẫn đọc được', () => {
    trongDong({ ...CHUNG, giaTri: 'Đã chuyển Công an phường', chiXem: true, onSua: vi.fn() });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Đã chuyển Công an phường')).toBeInTheDocument();
  });

  it('chỉ XEM + ô rỗng: hiện dấu gạch, không mời nhập', () => {
    trongDong({ ...CHUNG, giaTri: null, chiXem: true, onSua: vi.fn() });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  /**
   * Nút đúng bằng icon 14px thì bấm trượt KHÔNG phải là không có gì xảy ra: cú bấm rơi xuống
   * `<tr onClick>` và nhảy sang màn sửa. Chú thích của chính component viện chuẩn vùng chạm
   * WCAG 2.5.8 làm lý do cho "luôn hiện" — nút phải theo đúng chuẩn ấy.
   */
  it('nút có VÙNG CHẠM, không chỉ bằng cỡ icon', () => {
    trongDong({ ...CHUNG, giaTri: 'Đã chuyển Công an phường', onSua: vi.fn() });
    const l = screen.getByTestId('o-ket-qua-p1').className;
    expect(l).toContain('min-w-6');
    expect(l).toContain('min-h-6');
  });

  /**
   * Chữ dài không ngắt được (mã hồ sơ, đường dẫn) có bề rộng tối thiểu tự nhiên lớn hơn cột
   * 10rem; thiếu `min-w-0` thì nó đẩy nút ra ngoài và `overflow-hidden` của ô cắt mất chỗ bấm.
   */
  it('chữ dài KHÔNG đẩy nút ra khỏi cột', () => {
    trongDong({ ...CHUNG, giaTri: 'A'.repeat(200), onSua: vi.fn() });
    const nut = screen.getByTestId('o-ket-qua-p1');
    expect(nut.className).toContain('flex-shrink-0');
    expect(nut.previousElementSibling?.className).toContain('min-w-0');
  });

  /** Cột có 50 nút giống hệt nhau; "Sửa" không nói được nút nào của hồ sơ nào. */
  it('nút có aria-label phân biệt được hồ sơ', () => {
    trongDong({ ...CHUNG, giaTri: null, onSua: vi.fn() });
    expect(screen.getByTestId('o-ket-qua-p1')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('2026-11973'),
    );
  });
});
