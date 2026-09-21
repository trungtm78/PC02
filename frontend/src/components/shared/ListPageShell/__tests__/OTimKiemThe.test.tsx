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

  /**
   * 21/09/2026: dòng hướng dẫn ngày gộp thành MỘT cho mọi cột ngày, thay vì mỗi cột một dòng.
   * Đơn thư sắp có chín cột ngày — chín dòng giống hệt nhau là chín dòng rác. Mệnh đề giữ
   * nguyên: chữ không phải ngày thì không chọn được cột ngày, và có hướng dẫn dạng gõ.
   */
  it('cột ngày: chữ không phải ngày thì KHÔNG chọn được, có MỘT dòng hướng dẫn chung', () => {
    const { o } = dung();
    goChu(o, 'abc');
    expect(cacLuaChon().some((x) => x.textContent?.includes('Ngày đề xuất'))).toBe(false);
    const huongDan = cacLuaChon().filter((x) => x.textContent?.includes('12/09/2026'));
    expect(huongDan).toHaveLength(1);
    expect(huongDan[0]).toHaveAttribute('aria-disabled', 'true');

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

/**
 * Đợt 21/09/2026 — anh yêu cầu tìm được TẤT CẢ các cột.
 *
 * Gợi ý hiện chỉ suy từ cột ĐANG HIỆN trên bảng (`truongGoiY(visibleColumns, …)`), nên trường
 * của cột đang ẩn không có dòng nào để chọn — cán bộ không có đường nào tìm theo chúng. Đơn thư
 * ẩn sẵn ba cột, và đợt này sắp thêm sáu thẻ ngày cũng ở dạng ẩn.
 */
const KHAI_RONG = [
  { key: 'stt', nhan: 'STT', kieu: 'ma' },
  { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu' },
  { key: 'ngayDeXuat', nhan: 'Ngày đề xuất', kieu: 'ngay' },
  { key: 'trangThai', nhan: 'Trạng thái', kieu: 'chon' },
  // Bốn trường dưới đây KHÔNG nằm trong `truong` (cột đang ẩn trên bảng).
  { key: 'doiTuong', nhan: 'Đối tượng bị tố', kieu: 'chu' },
  { key: 'hanXuLy', nhan: 'Hạn xử lý', kieu: 'ngay' },
  { key: 'ngayTao', nhan: 'Ngày tạo', kieu: 'ngay' },
  { key: 'ngayVietDon', nhan: 'Ngày viết đơn', kieu: 'ngay' },
] as const;

const dungRong = (p: Partial<OTimKiemTheProps> = {}) =>
  dung({ truong: KHAI, khai: KHAI_RONG, ...p });

const chuCacLuaChon = () => cacLuaChon().map((l) => l.textContent ?? '');

describe('<OTimKiemThe> — gợi ý cho cột đang ẩn (đợt 21/09/2026)', () => {
  it('trường của cột ĐANG ẨN vẫn chọn được, nằm trong nhóm "Cột khác"', () => {
    const { o } = dungRong();
    goChu(o, 'nguyen');
    const chu = chuCacLuaChon().join('\n');
    expect(chu).toContain('Đối tượng bị tố');
    expect(screen.getByText(/Cột khác/)).toBeInTheDocument();
  });

  it('cột đang HIỆN xếp trước cột ẩn — mạch đọc theo đúng thứ tự bảng', () => {
    const { o } = dungRong();
    goChu(o, 'nguyen');
    const chu = chuCacLuaChon();
    expect(chu.findIndex((c) => c.includes('Người gửi'))).toBeLessThan(
      chu.findIndex((c) => c.includes('Đối tượng bị tố')),
    );
  });

  /**
   * Bốn cột ngày × một dòng hướng dẫn mỗi cột = bốn dòng rác giống hệt nhau. Đợt này Đơn thư lên
   * chín cột ngày, tức chín dòng.
   */
  it('chữ không phải ngày → MỘT dòng hướng dẫn ngày chung, không phải mỗi cột một dòng', () => {
    const { o } = dungRong();
    goChu(o, 'nguyen');
    const huongDan = chuCacLuaChon().filter((c) => c.includes('12/09/2026'));
    expect(huongDan).toHaveLength(1);
  });

  it('chữ LÀ ngày → mỗi cột ngày một dòng chọn được, không còn dòng hướng dẫn', () => {
    const { o } = dungRong();
    goChu(o, '12/09/2026');
    const chu = chuCacLuaChon();
    expect(chu.filter((c) => c.includes('gõ 12/09/2026'))).toHaveLength(0);
    for (const nhan of ['Ngày đề xuất', 'Hạn xử lý', 'Ngày tạo', 'Ngày viết đơn'])
      expect(chu.join('\n')).toContain(nhan);
  });

  it('danh sách có TRẦN — không đổ 30 dòng ra màn hình', () => {
    const nhieu = Array.from({ length: 30 }, (_, i) => ({
      key: `c${i}`,
      nhan: `Cột ${i}`,
      kieu: 'chu' as const,
    }));
    const { o } = dung({ truong: KHAI, khai: [...KHAI, ...nhieu] });
    goChu(o, 'nguyen');
    expect(cacLuaChon().length).toBeLessThanOrEqual(14);
    expect(screen.getByText(/còn \d+ cột khác/)).toBeInTheDocument();
  });

  /**
   * Cú pháp `tên cột:giá trị` — cách DUY NHẤT với tới 30 trường mà không phải cuộn.
   */
  it('gõ "đối tượng:nguyen" → lọc đúng trường ấy, bỏ trần', () => {
    const { o } = dungRong();
    goChu(o, 'đối tượng:nguyen');
    const chu = chuCacLuaChon();
    expect(chu.join('\n')).toContain('Đối tượng bị tố');
    expect(chu.filter((c) => c.includes('Người gửi'))).toHaveLength(0);
  });

  it('gõ KHÔNG DẤU cũng khớp tên cột: "doi tuong:nguyen"', () => {
    const { o } = dungRong();
    goChu(o, 'doi tuong:nguyen');
    expect(chuCacLuaChon().join('\n')).toContain('Đối tượng bị tố');
  });

  it('cú pháp `tên:` gửi lên ĐÚNG giá trị sau dấu hai chấm, không gửi cả chuỗi', () => {
    const { props, o } = dungRong();
    goChu(o, 'doi tuong:nguyen');
    fireEvent.keyDown(o, { key: 'Enter' });
    expect(props.onThem).toHaveBeenCalledWith('doiTuong', 'nguyen');
  });

  it('tên cột không khớp gì → KHÔNG im lặng trả rỗng, vẫn còn dòng "tất cả các cột"', () => {
    const { o } = dungRong();
    goChu(o, 'khongcocotnao:nguyen');
    expect(chuCacLuaChon()[0]).toContain('tất cả các cột');
  });
});
