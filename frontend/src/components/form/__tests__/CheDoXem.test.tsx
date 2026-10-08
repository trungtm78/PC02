import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CheDoXemProvider, useCheDoXem } from '../CheDoXem';
import { FormInput, FormSelect, FormTextarea } from '../FormField';
import { FKSelect } from '@/components/FKSelect';
import { CrimeSelect } from '@/components/CrimeSelect';
import { ONhapGoiY } from '@/components/inputs/ONhapGoiY';

Element.prototype.scrollIntoView = vi.fn();

vi.mock('@/hooks/useCrimeOptions', () => ({
  useCrimeOptions: () => ({
    data: [{ id: 'a', code: 'D123', name: 'Tội giết người', pc02Relevant: true, articleNo: 123 }],
    isLoading: false,
  }),
}));

/**
 * CHẾ ĐỘ CHỈ XEM của form (Đơn thư `/petitions/:id`).
 *
 * Hai loại ô cần hai cách khoá KHÁC NHAU, và đó là lý do không thể dùng một `<fieldset disabled>` bao tất cả:
 * - ô CHỮ (chữ/ngày/số/vùng văn bản): `readOnly`, không phải `disabled`. Trong Chromium chữ trong ô `disabled`
 *   KHÔNG bôi chọn/chép được — mà mục đích của chế độ xem là để cán bộ chép dữ liệu ra chỗ khác;
 * - ô CHỌN (select, FK, tội danh, tích): `disabled`, vì không có chữ nào cần chép.
 *
 * Ngữ cảnh để ô mới thêm về sau TỰ được khoá, thay vì phải nhớ nối từng ô.
 */
function Sonde() {
  return <span data-testid="sonde">{String(useCheDoXem())}</span>;
}

function bao(xem: boolean | undefined, ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const noiDung = xem === undefined ? ui : <CheDoXemProvider xem={xem}>{ui}</CheDoXemProvider>;
  return render(<QueryClientProvider client={qc}>{noiDung}</QueryClientProvider>);
}

describe('CheDoXem — ngữ cảnh', () => {
  it('mặc định false (ngoài form có bật chế độ xem thì mọi ô như cũ)', () => {
    bao(undefined, <Sonde />);
    expect(screen.getByTestId('sonde')).toHaveTextContent('false');
  });
  it('true khi form bật chế độ xem', () => {
    bao(true, <Sonde />);
    expect(screen.getByTestId('sonde')).toHaveTextContent('true');
  });
});

describe('ô CHỮ ở chế độ xem: chỉ-đọc nhưng vẫn bôi chọn / chép được', () => {
  it('FormInput: readOnly (KHÔNG disabled) và gõ không gọi onChange', async () => {
    const onChange = vi.fn();
    bao(true, <FormInput label="Họ tên" value="Nguyễn Văn A" onChange={onChange} data-testid="o" />);
    const o = screen.getByTestId('o') as HTMLInputElement;
    expect(o).toHaveAttribute('readonly');
    expect(o).not.toBeDisabled();
    expect(o.value).toBe('Nguyễn Văn A');
    await userEvent.type(o, 'xyz');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('FormInput ngày: cũng readOnly', () => {
    bao(true, <FormInput label="Ngày" type="date" value="2026-03-12" onChange={() => {}} data-testid="o" />);
    expect(screen.getByTestId('o')).toHaveAttribute('readonly');
  });

  it('FormTextarea: readOnly, không disabled, gõ không gọi onChange', async () => {
    const onChange = vi.fn();
    bao(true, <FormTextarea label="Nội dung" value="Nội dung đơn" onChange={onChange} data-testid="o" />);
    const o = screen.getByTestId('o');
    expect(o).toHaveAttribute('readonly');
    expect(o).not.toBeDisabled();
    await userEvent.type(o, 'xyz');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ngoài chế độ xem: gõ được như cũ (không có readonly)', async () => {
    const onChange = vi.fn();
    bao(undefined, <FormInput label="Họ tên" value="" onChange={onChange} data-testid="o" />);
    expect(screen.getByTestId('o')).not.toHaveAttribute('readonly');
    await userEvent.type(screen.getByTestId('o'), 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('ONhapGoiY: ô readOnly và gõ không hỏi máy chủ gợi ý', async () => {
    const timGoiY = vi.fn(async () => []);
    bao(
      true,
      <ONhapGoiY<string>
        value="Trần Thị A"
        onChange={() => {}}
        timGoiY={timGoiY}
        khoa={(g) => g}
        nhan={(g) => g}
        hien={(g) => <span>{g}</span>}
        testId="o"
        doTre={5}
      />,
    );
    expect(screen.getByTestId('o')).toHaveAttribute('readonly');
    await userEvent.type(screen.getByTestId('o'), 'xyz');
    await new Promise((r) => setTimeout(r, 40));
    expect(timGoiY).not.toHaveBeenCalled();
  });
});

describe('ô CHỌN ở chế độ xem: khoá hẳn', () => {
  it('FormSelect: disabled', () => {
    bao(true, <FormSelect label="Mức" value="a" onChange={() => {}} options={[{ value: 'a', label: 'A' }]} data-testid="o" />);
    expect(screen.getByTestId('o')).toBeDisabled();
  });

  it('FKSelect: hiện giá trị đã chọn, không mở được bằng chuột lẫn bàn phím, không có nút xoá', async () => {
    const onChange = vi.fn();
    bao(
      true,
      <FKSelect
        label="Đơn vị"
        value="d1"
        onChange={onChange}
        options={[{ value: 'd1', label: 'Đội 1' }, { value: 'd2', label: 'Đội 2' }]}
        testId="o"
      />,
    );
    const nut = screen.getByTestId('o-trigger');
    expect(nut).toHaveTextContent('Đội 1');
    expect(nut).toHaveAttribute('aria-disabled', 'true');
    // Vẫn tới được bằng Tab (người dùng bàn phím / trình đọc màn hình cần ĐỌC giá trị), chỉ chặn việc mở.
    expect(nut).toHaveAttribute('tabindex', '0');
    await userEvent.click(nut);
    fireEvent.keyDown(nut, { key: 'ArrowDown' });
    fireEvent.keyDown(nut, { key: 'Enter' });
    fireEvent.keyDown(nut, { key: ' ' });
    expect(screen.queryByTestId('o-dropdown')).not.toBeInTheDocument();
    expect(screen.queryByTestId('o-clear')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  /**
   * Codex bắt: hộp đang MỞ khi form chuyển sang chế độ xem (React giữ state khi Back từ màn sửa) vẫn gọi onChange.
   * Khoá phải đóng hộp và chặn chọn, không chỉ ẩn nút mở.
   */
  it('FKSelect đang MỞ mà form chuyển sang chế độ xem: hộp đóng và không chọn được nữa', async () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const ui = (xem: boolean) => (
      <QueryClientProvider client={qc}>
        <CheDoXemProvider xem={xem}>
          <FKSelect
            label="Đơn vị"
            value=""
            onChange={onChange}
            options={[{ value: 'd1', label: 'Đội 1' }]}
            testId="o"
          />
        </CheDoXemProvider>
      </QueryClientProvider>
    );
    const { rerender } = render(ui(false));
    await userEvent.click(screen.getByTestId('o-trigger'));
    expect(screen.getByTestId('o-dropdown')).toBeInTheDocument();

    rerender(ui(true));

    expect(screen.queryByTestId('o-dropdown')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('FKSelect ngoài chế độ xem: mở được như cũ', async () => {
    bao(
      undefined,
      <FKSelect label="Đơn vị" value="" onChange={() => {}} options={[{ value: 'd1', label: 'Đội 1' }]} testId="o" />,
    );
    await userEvent.click(screen.getByTestId('o-trigger'));
    expect(screen.getByTestId('o-dropdown')).toBeInTheDocument();
  });

  it('FKSelect: prop disabled tự nó cũng khoá (dùng được ngoài chế độ xem)', async () => {
    bao(
      undefined,
      <FKSelect label="Đơn vị" value="d1" onChange={() => {}} options={[{ value: 'd1', label: 'Đội 1' }]} testId="o" disabled />,
    );
    await userEvent.click(screen.getByTestId('o-trigger'));
    expect(screen.queryByTestId('o-dropdown')).not.toBeInTheDocument();
  });

  it('CrimeSelect: nút mở bị disabled và không có nút xoá', async () => {
    bao(true, <CrimeSelect label="Tội danh" value="a" onChange={() => {}} />);
    expect(screen.getByTestId('crime-select-trigger')).toBeDisabled();
    expect(screen.queryByTestId('crime-select-clear')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('crime-select-trigger'));
    expect(screen.queryByTestId('crime-select-dropdown')).not.toBeInTheDocument();
  });
});
