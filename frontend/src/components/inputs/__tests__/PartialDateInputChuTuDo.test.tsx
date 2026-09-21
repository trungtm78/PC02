import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PartialDateInput } from '../PartialDateInput';
import type { NgayVietDonDaDoc } from '@/shared/ngay-thieu/ngay-viet-don';

/*
  Chế độ CHỮ TỰ DO (21/09/2026).

  Cán bộ gõ `../../2026, 31/01/2026 (đơn không có chữ ký người đứng đơn)` và bị chặn với
  "Năm phải đủ 4 chữ số" — trong khi năm đã đủ bốn chữ số. Đo prod: 4.454/46.129 hồ sơ mang
  giá trị không đọc ra được một ngày, vì đây là hồ sơ GỘP nhiều đơn.

  Anh chốt: để nguyên chữ đã nhập và cho vào file Word.

  Hợp đồng ở ô nhập: KHÔNG chặn, giữ nguyên chữ, và NÓI RA hệ hiểu được gì.
*/
function ve(p: Partial<Parameters<typeof PartialDateInput>[0]> = {}) {
  const onDoc = vi.fn((_ra: NgayVietDonDaDoc) => {});
  render(
    <PartialDateInput
      label="Ngày viết đơn"
      value={null}
      onChange={() => {}}
      chuTuDo
      onDoc={onDoc}
      testId="field-petitionDate"
      {...p}
    />,
  );
  return { onDoc, o: screen.getByTestId('field-petitionDate') as HTMLInputElement };
}

const CHU_THAT = '../../2026, 31/01/2026 (đơn không có chữ ký người đứng đơn)';

describe('<PartialDateInput chuTuDo>', () => {
  it('chữ tự do KHÔNG bị mắng, và được đẩy lên nguyên văn', () => {
    const { onDoc, o } = ve();
    fireEvent.change(o, { target: { value: CHU_THAT } });
    fireEvent.blur(o);
    expect(screen.queryByText(/Năm phải đủ 4 chữ số/)).not.toBeInTheDocument();
    expect(onDoc).toHaveBeenLastCalledWith(
      expect.objectContaining({ chu: CHU_THAT, edtf: '2026-XX-XX' }),
    );
  });

  /* Đọc thầm rồi giữ một phần là lớp mất-im-lặng đã phải vá hai lần ở chính ô này. */
  it('nói ra hệ hiểu được gì', () => {
    const { o } = ve();
    fireEvent.change(o, { target: { value: CHU_THAT } });
    expect(screen.getByTestId('field-petitionDate-hieu-la')).toHaveTextContent(
      /in nguyên văn/,
    );
  });

  it('không đọc ra ngày nào thì nói rõ sẽ không lọc được', () => {
    const { o } = ve();
    fireEvent.change(o, { target: { value: 'Không ghi ngày' } });
    expect(screen.getByTestId('field-petitionDate-hieu-la')).toHaveTextContent(
      /không lọc được theo ngày/,
    );
  });

  it('ngày gõ sạch thì KHÔNG làm phiền bằng câu giải thích', () => {
    const { o } = ve();
    fireEvent.change(o, { target: { value: '31/01/2026' } });
    expect(screen.queryByTestId('field-petitionDate-hieu-la')).not.toBeInTheDocument();
  });

  /* Mở hồ sơ cũ có chữ tự do → ô phải hiện ĐÚNG chữ ấy, không dựng lại từ EDTF. */
  it('nạp hồ sơ có chữ nguyên văn → ô hiện đúng chữ đã lưu', () => {
    const { o } = ve({ value: '2026-XX-XX', valueChu: CHU_THAT });
    expect(o.value).toBe(CHU_THAT);
  });

  it('không bật chuTuDo → giữ NGUYÊN hành vi cũ, vẫn mắng chữ không phải ngày', () => {
    render(
      <PartialDateInput
        label="Ngày viết đơn"
        value={null}
        onChange={() => {}}
        testId="o-cu"
      />,
    );
    const o = screen.getByTestId('o-cu');
    fireEvent.change(o, { target: { value: CHU_THAT } });
    fireEvent.blur(o);
    expect(screen.getByText(/Năm phải đủ 4 chữ số/)).toBeInTheDocument();
  });
});
