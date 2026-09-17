import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { OTimKiemThe, type OTimKiemTheProps } from '../OTimKiemThe';

const KHAI = [
  { key: 'stt', nhan: 'STT', kieu: 'ma' },
  { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu' },
  { key: 'ngayDeXuat', nhan: 'Ngày đề xuất', kieu: 'ngay' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
] as const;

function dung(p: Partial<OTimKiemTheProps> = {}) {
  const props: OTimKiemTheProps = {
    the: [],
    truong: KHAI,
    khai: KHAI,
    giaTriChon: {
      trangThai: [
        { value: 'DANG_XU_LY', label: 'Đang xử lý' },
        { value: 'DA_LUU_DON', label: 'Lưu đơn' },
      ],
    },
    onThem: vi.fn(() => true),
    onBoThe: vi.fn(),
    onBoGiaTri: vi.fn(),
    ...p,
  };
  render(<OTimKiemThe {...props} />);
  const o = screen.getByRole('combobox', { name: 'Tìm kiếm trong danh sách' });
  return { props, o };
}

const goChu = (o: HTMLElement, v: string) => fireEvent.change(o, { target: { value: v } });
const cacLuaChon = () => within(screen.getByRole('listbox')).getAllByRole('option');

describe('<OTimKiemThe>', () => {
  it('gõ chữ → dòng đầu là "tất cả các cột", Enter tạo thẻ "*" và xoá ô', () => {
    const { props, o } = dung();
    goChu(o, 'nguyen van');
    expect(cacLuaChon()[0]).toHaveTextContent('Tìm trong tất cả các cột: "nguyen van"');
    fireEvent.keyDown(o, { key: 'Enter' });
    expect(props.onThem).toHaveBeenCalledWith('*', 'nguyen van');
    expect((o as HTMLInputElement).value).toBe('');
  });

  it('gợi ý đi đúng thứ tự cột được truyền vào, không tự thêm cột ẩn', () => {
    const { o } = dung({ truong: [KHAI[1], KHAI[0]] });
    goChu(o, '26-1');
    const nhan = cacLuaChon().map((x) => x.textContent);
    expect(nhan[1]).toContain('Người gửi');
    expect(nhan[2]).toContain('STT');
    expect(nhan.join('|')).not.toContain('Ngày đề xuất');
  });

  it('↓ rồi Enter → thẻ theo cột đang chọn', () => {
    const { props, o } = dung();
    goChu(o, 'An');
    fireEvent.keyDown(o, { key: 'ArrowDown' });
    fireEvent.keyDown(o, { key: 'ArrowDown' });
    expect(cacLuaChon()[2]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(o, { key: 'Enter' });
    expect(props.onThem).toHaveBeenCalledWith('nguoiGui', 'An');
  });

  it('↑ ở dòng đầu vòng về dòng cuối chọn được', () => {
    const { o } = dung();
    goChu(o, 'abc');
    fireEvent.keyDown(o, { key: 'ArrowUp' });
    const ds = cacLuaChon().filter((x) => x.getAttribute('aria-disabled') !== 'true');
    expect(ds[ds.length - 1]).toHaveAttribute('aria-selected', 'true');
  });

  /** Bộ gõ Telex/VNI dùng Enter để chốt chữ — tạo thẻ lúc ấy là thẻ chứa nửa chữ. */
  it('Enter trong lúc bộ gõ đang ghép chữ KHÔNG tạo thẻ', () => {
    const { props, o } = dung();
    goChu(o, 'nguye');
    fireEvent.keyDown(o, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(o, { key: 'Enter', keyCode: 229 });
    fireEvent.compositionStart(o);
    fireEvent.keyDown(o, { key: 'Enter' });
    expect(props.onThem).not.toHaveBeenCalled();
    fireEvent.compositionEnd(o);
    fireEvent.keyDown(o, { key: 'Enter' });
    expect(props.onThem).toHaveBeenCalledWith('*', 'nguye');
  });

  it('cột ngày: chữ không phải ngày thì dòng ấy bị khoá và có hướng dẫn', () => {
    const { o } = dung();
    goChu(o, 'abc');
    const dong = cacLuaChon().find((x) => x.textContent?.includes('Ngày đề xuất'))!;
    expect(dong).toHaveAttribute('aria-disabled', 'true');
    expect(dong).toHaveTextContent('12/09/2026');
    goChu(o, '09/2026');
    const dong2 = cacLuaChon().find((x) => x.textContent?.includes('Ngày đề xuất'))!;
    expect(dong2).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('cột chọn giá trị: gõ không dấu ra đúng giá trị, chọn gửi MÃ chứ không gửi nhãn', () => {
    const { props, o } = dung();
    goChu(o, 'dang xu');
    const dong = cacLuaChon().find((x) => x.textContent?.includes('Đang xử lý'))!;
    fireEvent.click(dong);
    expect(props.onThem).toHaveBeenCalledWith('trangThai', 'DANG_XU_LY');
    expect(cacLuaChon.bind(null)).toThrow();
  });

  it('ô trống + mở danh sách → liệt kê giá trị của cột chọn', () => {
    const { o } = dung();
    fireEvent.keyDown(o, { key: 'ArrowDown' });
    const nhan = cacLuaChon().map((x) => x.textContent ?? '');
    expect(nhan.some((t) => t.includes('Lưu đơn'))).toBe(true);
    expect(nhan.some((t) => t.includes('tất cả các cột'))).toBe(false);
  });

  /**
   * ĐỔI LUẬT 17/09/2026: tìm kiếm nay khớp CHUỖI CON ở mọi độ dài (như %like%), nên câu nhắc "dưới 3 ký
   * tự chỉ khớp đầu từ" thành SAI. Giữ nó là nói với cán bộ một luật hệ thống không còn chạy.
   */
  it('gõ 1–2 ký tự → KHÔNG còn nhắc "chỉ khớp đầu từ"', () => {
    const { o } = dung();
    goChu(o, 'An');
    expect(screen.queryByText(/Gõ từ 3 ký tự/)).not.toBeInTheDocument();
    expect(screen.queryByText(/đầu từ/)).not.toBeInTheDocument();
  });

  it('Esc đóng danh sách', () => {
    const { o } = dung();
    goChu(o, 'abc');
    fireEvent.keyDown(o, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(o).toHaveAttribute('aria-expanded', 'false');
  });

  it('thẻ hiện "Nhãn: a hoặc b"; giá trị cột chọn hiện NHÃN; × bỏ thẻ', () => {
    const { props } = dung({
      the: [
        { khoa: 'nguoiGui', giaTri: ['An', 'Bình'] },
        { khoa: 'trangThai', giaTri: ['DANG_XU_LY'] },
      ],
    });
    const the = screen.getAllByTestId('the-tim-kiem');
    expect(the[0]).toHaveTextContent('Người gửi: An hoặc Bình');
    expect(the[1]).toHaveTextContent('Trạng thái: Đang xử lý');
    fireEvent.click(within(the[0]).getByRole('button', { name: 'Bỏ thẻ Người gửi' }));
    expect(props.onBoThe).toHaveBeenCalledWith('nguoiGui');
  });

  it('khoá không còn tìm được → thẻ đỏ nói rõ, không âm thầm bỏ', () => {
    dung({ the: [{ khoa: 'cotDaDoiTen', giaTri: ['x'] }] });
    const the = screen.getByTestId('the-tim-kiem');
    expect(the).toHaveAttribute('data-hop-le', 'false');
    expect(the).toHaveTextContent('Cột không còn tìm được');
  });

  it('Backspace ở ô trống → bỏ giá trị cuối của thẻ cuối', () => {
    const { props, o } = dung({ the: [{ khoa: 'nguoiGui', giaTri: ['An', 'Bình'] }] });
    fireEvent.keyDown(o, { key: 'Backspace' });
    expect(props.onBoGiaTri).toHaveBeenCalledWith('nguoiGui', 'Bình');
  });

  it('bấm vào thẻ → giá trị cuối về ô để sửa', () => {
    const { props, o } = dung({ the: [{ khoa: 'nguoiGui', giaTri: ['An'] }] });
    fireEvent.click(screen.getByRole('button', { name: 'Sửa thẻ Người gửi' }));
    expect(props.onBoGiaTri).toHaveBeenCalledWith('nguoiGui', 'An');
    expect((o as HTMLInputElement).value).toBe('An');
    expect(document.activeElement).toBe(o);
  });

  it('phím "/" ở ngoài ô đặt con trỏ vào ô; trong ô khác thì không', () => {
    const { o } = dung();
    fireEvent.keyDown(document.body, { key: '/' });
    expect(document.activeElement).toBe(o);
    o.blur();
    const khac = document.createElement('input');
    document.body.appendChild(khac);
    khac.focus();
    fireEvent.keyDown(khac, { key: '/' });
    expect(document.activeElement).toBe(khac);
    khac.remove();
  });

  it('máy chủ không nhận thêm (quá giới hạn) → giữ chữ trong ô', () => {
    const { o } = dung({ onThem: vi.fn(() => false) });
    goChu(o, 'abc');
    fireEvent.keyDown(o, { key: 'Enter' });
    expect((o as HTMLInputElement).value).toBe('abc');
  });
});
