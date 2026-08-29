import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveSplitButton } from '../SaveSplitButton';

/**
 * Nút Lưu phải KHOÁ trong lúc đang gửi.
 *
 * ── Vì sao ghim ──
 *
 * Bấm hai lần là HAI hồ sơ, mà mạng cơ quan chậm nên bấm lại là phản xạ tự nhiên. Cơ chế này
 * hiện CHẠY ĐÚNG — đo trên máy thật 29/08/2026 ở `/vu-viec/new`: chặn yêu cầu ghi cho treo thì
 * nút chuyển `disabled` và nhãn đổi thành "Đang lưu...".
 *
 * Nhưng KHÔNG ca kiểm nào đứng canh nó. Một lần sửa `disabled={isSubmitting}` thành `disabled`
 * cứng, hay bỏ prop khi tái cấu trúc, sẽ đi qua toàn bộ bộ kiểm mà không ai biết — và hỏng theo
 * kiểu im lặng nhất: chỉ lộ ra khi có hai hồ sơ trùng trong cơ sở dữ liệu.
 *
 * (Ghi chú cho người đọc sau: lượt soát giao diện ban đầu báo "3 form không chặn bấm hai lần" —
 * đó là DƯƠNG TÍNH GIẢ do đo nhầm phần tử. Đo lại bằng đúng `data-testid` và đếm số lần yêu cầu
 * thật sự phát đi thì hai form kia có `guiDi=0`, tức validation chặn nên chưa có gì để khoá.)
 */
function dung(isSubmitting: boolean, onSave = vi.fn()) {
  render(
    <SaveSplitButton
      onSave={onSave}
      onSaveAndExport={vi.fn()}
      isSubmitting={isSubmitting}
      label="Lưu hồ sơ"
      idPrefix="btn-save"
      mainTestId="btn-save"
    />,
  );
  return { onSave };
}

describe('SaveSplitButton — chống bấm hai lần', () => {
  it('đang gửi thì nút chính bị khoá', () => {
    dung(true);
    expect(screen.getByTestId('btn-save')).toBeDisabled();
  });

  it('đang gửi thì nút mũi tên cũng bị khoá — không mở được lối lưu khác', () => {
    dung(true);
    expect(screen.getByTestId('btn-save-caret')).toBeDisabled();
  });

  it('đang gửi thì nhãn đổi để người dùng biết hệ đang làm việc', () => {
    dung(true);
    expect(screen.getByTestId('btn-save')).toHaveTextContent('Đang lưu');
  });

  it('bấm nhiều lần khi đang gửi chỉ gọi onSave 0 lần', () => {
    const { onSave } = dung(true);
    const nut = screen.getByTestId('btn-save');
    fireEvent.click(nut);
    fireEvent.click(nut);
    fireEvent.click(nut);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('không gửi thì bấm được bình thường', () => {
    const { onSave } = dung(false);
    expect(screen.getByTestId('btn-save')).not.toBeDisabled();
    fireEvent.click(screen.getByTestId('btn-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});

/**
 * Ba form tạo hồ sơ chính phải TRUYỀN `isSubmitting` xuống — nút biết khoá mà trang không nói
 * cho nó biết khi nào thì cũng vô dụng. Đây là chỗ nối dễ đứt khi tái cấu trúc.
 */
describe('Ba form tạo hồ sơ đều nối isSubmitting', () => {
  it.each([
    ['vụ án', 'pages/cases/CaseFormPage/index.tsx'],
    ['vụ việc', 'pages/incidents/IncidentFormPage.tsx'],
    ['đơn thư', 'pages/petitions/PetitionFormPage/index.tsx'],
  ])('form %s truyền isSubmitting cho SaveSplitButton', async (_ten, duong) => {
    const ma = (await import(`../../../../${duong}?raw`)).default as string;
    const soNut = (ma.match(/<SaveSplitButton/g) ?? []).length;
    const soNoi = (ma.match(/isSubmitting=\{/g) ?? []).length;
    expect(soNut).toBeGreaterThan(0);
    // Đếm chứ không hỏi "có xuất hiện": các form này có HAI nút Lưu (đầu và cuối trang), nên
    // gỡ dây nối ở một nút vẫn để chuỗi kia lại và phép kiểm có-mặt vẫn xanh. Gieo lỗi đã cho
    // thấy đúng như vậy.
    expect(soNoi).toBe(soNut);
  });
});
