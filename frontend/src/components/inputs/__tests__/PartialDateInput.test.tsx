import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { PartialDateInput } from '../PartialDateInput';

/**
 * Ô "Ngày viết đơn" cho nhập THIẾU thành phần — MỘT Ô CHỮ.
 *
 * Bản đầu dùng ba ô phân đoạn theo NN/g và uxpatterns.dev, vì ở đó "để trống ngày" là bỏ trống
 * một ô chứ không phải rà con trỏ qua hai ký tự rồi xoá. Anh đảo lại sau một ngày dùng thật:
 * thao tác thường xuyên không phải bỏ trống, mà là CHÉP ngày từ đơn giấy hay từ Word và dán
 * một lần. Ba ô làm việc ấy khó hơn hẳn.
 *
 * Bộ này canh đúng ba thứ không được rơi khi đổi: nhập thiếu vẫn lưu được, không bao giờ bịa
 * ngày mồng 1, và ngày không có thật bị chặn TẠI CHỖ chứ không để máy chủ trả 400.
 */
/**
 * Khung GIỮ TRẠNG THÁI: component được điều khiển, nên giá trị mới phải quay lại qua `value`.
 * Dựng bằng `value` cố định thì mỗi ký tự gõ ra lại bị kéo về giá trị cũ — đó là lỗi của khung
 * dựng, không phải của component.
 */
function ve(props: Partial<React.ComponentProps<typeof PartialDateInput>> = {}) {
  const doi = vi.fn();
  function Khung() {
    const [v, setV] = useState<string | null>(props.value ?? null);
    return (
      <PartialDateInput
        label="Ngày viết đơn"
        testId="ngay"
        {...props}
        value={v}
        onChange={(x) => {
          doi(x);
          setV(x);
        }}
      />
    );
  }
  render(<Khung />);
  return { doi };
}

const o = () => screen.getByTestId('ngay') as HTMLInputElement;
const go = (chu: string) => fireEvent.change(o(), { target: { value: chu } });

describe('PartialDateInput', () => {
  it('là MỘT ô chữ mang tên đọc được, không phải ba ô phân đoạn', () => {
    ve();
    expect(screen.getByLabelText(/Ngày viết đơn/)).toBe(o());
    expect(screen.queryByTestId('ngay-ngay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ngay-thang')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ngay-nam')).not.toBeInTheDocument();
  });

  it('gợi ý ngay trên ô cả ba cách gõ được chấp nhận', () => {
    ve();
    const goiY = o().placeholder;
    expect(goiY).toContain('15/12/2026');
    expect(goiY).toContain('12/2026');
    expect(goiY).toContain('2026');
  });

  /**
   * Mệnh đề anh yêu cầu: DÁN MỘT LẦN. Dán là một sự kiện `change` mang trọn chuỗi, không phải
   * chuỗi `change` từng ký tự — nên ca này đúng là thứ trình duyệt làm khi bấm Ctrl+V.
   */
  it.each(['15/12/2026', '15-12-2026', '15.12.2026', '15122026'])(
    'dán MỘT LẦN "%s" → EDTF đầy đủ',
    (chu) => {
      const { doi } = ve();
      go(chu);
      expect(doi).toHaveBeenLastCalledWith('2026-12-15');
    },
  );

  it('gõ TỪNG KÝ TỰ tới đủ ngày → EDTF đầy đủ, chữ không bị nuốt giữa chừng', () => {
    const { doi } = ve();
    for (const chu of ['1', '15', '15/', '15/1', '15/12', '15/12/', '15/12/2', '15/12/20', '15/12/202', '15/12/2026'])
      go(chu);
    expect(o().value).toBe('15/12/2026');
    expect(doi).toHaveBeenLastCalledWith('2026-12-15');
  });

  it('thiếu ngày vẫn lưu được → 2026-12-XX, KHÔNG bịa mồng 1', () => {
    const { doi } = ve();
    go('12/2026');
    expect(doi).toHaveBeenLastCalledWith('2026-12-XX');
  });

  it('chỉ năm → 2026-XX-XX', () => {
    const { doi } = ve();
    go('2026');
    expect(doi).toHaveBeenLastCalledWith('2026-XX-XX');
  });

  it('xoá hết → null, không gửi chuỗi rác', () => {
    const { doi } = ve({ value: '2026-12-15' });
    go('');
    expect(doi).toHaveBeenLastCalledWith(null);
  });

  it('hiện lại ĐÚNG giá trị đang có, không tự điền ngày', () => {
    ve({ value: '2026-12-XX' });
    expect(o().value).toBe('__/12/2026');
  });

  /**
   * Khứ hồi: thứ ô IN RA phải dán lại được chính nó. Không có mệnh đề này thì cán bộ chép ô
   * này sang ô kia là mất dữ liệu — mà đó đúng là thao tác anh muốn làm cho dễ.
   */
  it('dán lại chính thứ ô in ra (`__/12/2026`) → không mất gì', () => {
    const { doi } = ve();
    go('__/12/2026');
    expect(doi).toHaveBeenLastCalledWith('2026-12-XX');
  });

  it('ngày RÁP LẠI không có thật thì báo lỗi ngay tại ô, không đợi máy chủ', () => {
    ve();
    go('31/02/2026');
    fireEvent.blur(o());
    expect(screen.getByTestId('ngay-loi').textContent).toContain('không có thật');
  });

  it('năm thiếu chữ số KHÔNG bị đoán hộ — báo lỗi thay vì lặng lẽ thành năm 20', () => {
    const { doi } = ve();
    go('12/20');
    fireEvent.blur(o());
    expect(screen.getByTestId('ngay-loi').textContent).toContain('4 chữ số');
    // Chuỗi đẩy lên phải LỆCH hình dạng EDTF, nhờ đó `validate.ts` chặn được nút Lưu.
    expect(doi).toHaveBeenLastCalledWith('20-12-XX');
  });

  /**
   * CHƯA rời ô thì chưa mắng: `15/12/20` là trạng thái gõ dở hoàn toàn bình thường — gạch đỏ
   * lúc ấy là mắng người ta giữa chừng một cái năm.
   */
  it('đang gõ dở thì KHÔNG mắng — chỉ báo sau khi rời ô', () => {
    ve();
    go('31/02/2026');
    expect(screen.queryByTestId('ngay-loi')).not.toBeInTheDocument();
    fireEvent.blur(o());
    expect(screen.getByTestId('ngay-loi')).toBeInTheDocument();
  });

  it('lỗi do form đưa xuống (sau khi bấm Lưu) hiện ngay, không cần rời ô', () => {
    ve({ error: 'Ngày viết đơn: sai rồi' });
    expect(screen.getByTestId('ngay-loi').textContent).toContain('sai rồi');
  });

  it('`value` đổi từ BÊN NGOÀI (nạp hồ sơ) thì ô hiện theo, không giữ chữ cũ', () => {
    function Khung() {
      const [v, setV] = useState<string | null>(null);
      return (
        <>
          <button onClick={() => setV('2024-02-29')}>nạp</button>
          <PartialDateInput label="Ngày viết đơn" testId="ngay" value={v} onChange={() => {}} />
        </>
      );
    }
    render(<Khung />);
    expect(o().value).toBe('');
    fireEvent.click(screen.getByText('nạp'));
    expect(o().value).toBe('29/02/2024');
  });
});

/**
 * Lượt soát 20/09/2026 — ba khuyết ở chính ô nhập, không ở phép đọc.
 */
describe('PartialDateInput — sửa sau lượt soát', () => {
  it('sửa lại sau khi bị mắng thì THÔI mắng cho tới lần rời ô kế', () => {
    ve();
    go('31/02/2026');
    fireEvent.blur(o());
    expect(screen.getByTestId('ngay-loi')).toBeInTheDocument();

    // Bấm vào sửa: gõ tới đâu mắng tới đó là mắng người ta giữa chừng, đúng thứ luật rời-ô
    // sinh ra để tránh — mà lần gõ đầu tiên thì tránh được, lần sửa lại thì không.
    go('3');
    expect(screen.queryByTestId('ngay-loi')).not.toBeInTheDocument();
    fireEvent.blur(o());
    expect(screen.getByTestId('ngay-loi')).toBeInTheDocument();
  });

  it('chữ lỗi được NỐI vào ô cho trình đọc màn hình, không chỉ hiện ra mắt', () => {
    ve();
    go('31/02/2026');
    fireEvent.blur(o());
    const idLoi = screen.getByTestId('ngay-loi').id;
    expect(idLoi).toBeTruthy();
    expect(o().getAttribute('aria-describedby')).toContain(idLoi);
    expect(screen.getByTestId('ngay-loi')).toHaveAttribute('role', 'alert');
  });

  it('gõ được DẤU NGĂN trên điện thoại — ô hướng dẫn gõ `15/12/2026`', () => {
    ve();
    // `inputMode="numeric"` cho bàn phím số KHÔNG có `/` `.` `-`: ô in ra `__/12/2026` mà cán
    // bộ dùng điện thoại không gõ lại được chính nó.
    expect(o().getAttribute('inputMode')).not.toBe('numeric');
  });

  it('quên truyền testId thì nhãn vẫn gắn được vào ô, không mồ côi', () => {
    render(<PartialDateInput label="Ngày viết đơn" value={null} onChange={() => {}} />);
    const oKhongId = screen.getByLabelText(/Ngày viết đơn/) as HTMLInputElement;
    expect(oKhongId.id).toBeTruthy();
  });
});
