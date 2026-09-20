import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FKSelect, type FKGroup } from '../FKSelect';

Element.prototype.scrollIntoView = vi.fn();

vi.mock('@/hooks/useDirectoryOptions', () => ({
  useDirectoryOptions: () => ({ data: undefined, isLoading: false }),
}));

function boc({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/**
 * Ô chọn cán bộ gom nhóm theo Tổ. Luật tìm anh nêu:
 *
 * - gõ TÊN NGƯỜI  → chỉ hiện người khớp, vẫn kê dưới nhóm của họ, bỏ nhóm rỗng
 * - gõ TÊN TỔ     → hiện CẢ nhóm ấy, không lọc người bên trong
 */
const NHOM: FKGroup[] = [
  {
    key: 't1',
    label: 'Tổ 1',
    options: [
      { value: 'a', label: 'Nguyễn Văn A' },
      { value: 'b', label: 'Nguyễn Văn B' },
      { value: 'd', label: 'Trịnh Lê D' },
    ],
  },
  {
    key: 't2',
    label: 'Tổ 2',
    options: [
      { value: 'e', label: 'Nguyễn Văn E' },
      { value: 'f', label: 'Nguyễn Văn F' },
    ],
  },
];

function moRa(props: Partial<React.ComponentProps<typeof FKSelect>> = {}) {
  render(
    <FKSelect label="Cán bộ" value="" onChange={vi.fn()} groups={NHOM} testId="o-can-bo" {...props} />,
    { wrapper: boc },
  );
  fireEvent.click(screen.getByTestId('o-can-bo-trigger'));
  return screen.getByTestId('o-can-bo-search');
}

function tenDangHien(): string[] {
  return screen.getAllByRole('option').map((o) => o.textContent?.trim() ?? '');
}

describe('FKSelect — chế độ nhóm', () => {
  it('hiện tiêu đề từng nhóm và người trong nhóm', () => {
    moRa();
    expect(screen.getByText('Tổ 1')).toBeInTheDocument();
    expect(screen.getByText('Tổ 2')).toBeInTheDocument();
    expect(tenDangHien()).toEqual([
      'Nguyễn Văn A', 'Nguyễn Văn B', 'Trịnh Lê D', 'Nguyễn Văn E', 'Nguyễn Văn F',
    ]);
  });

  it('gõ TÊN NGƯỜI → lọc trong từng nhóm, giữ nguyên nhóm của họ', () => {
    const o = moRa();
    fireEvent.change(o, { target: { value: 'Nguyễn Văn' } });
    expect(screen.getByText('Tổ 1')).toBeInTheDocument();
    expect(screen.getByText('Tổ 2')).toBeInTheDocument();
    expect(tenDangHien()).toEqual([
      'Nguyễn Văn A', 'Nguyễn Văn B', 'Nguyễn Văn E', 'Nguyễn Văn F',
    ]);
  });

  it('gõ TÊN TỔ → hiện CẢ nhóm ấy, bỏ nhóm kia', () => {
    const o = moRa();
    fireEvent.change(o, { target: { value: 'Tổ 1' } });
    expect(screen.getByText('Tổ 1')).toBeInTheDocument();
    expect(screen.queryByText('Tổ 2')).not.toBeInTheDocument();
    expect(tenDangHien()).toEqual(['Nguyễn Văn A', 'Nguyễn Văn B', 'Trịnh Lê D']);
  });

  it('gõ không dấu và gõ tắt vẫn ra nhóm — cán bộ hiếm khi bỏ dấu khi tìm nhanh', () => {
    const o = moRa();
    fireEvent.change(o, { target: { value: 'to 1' } });
    expect(tenDangHien()).toEqual(['Nguyễn Văn A', 'Nguyễn Văn B', 'Trịnh Lê D']);
  });

  it('nhóm rỗng sau khi lọc thì KHÔNG hiện tiêu đề trơ trọi', () => {
    const o = moRa();
    fireEvent.change(o, { target: { value: 'Trịnh' } });
    expect(screen.getByText('Tổ 1')).toBeInTheDocument();
    expect(screen.queryByText('Tổ 2')).not.toBeInTheDocument();
  });

  it('phím mũi tên đi XUYÊN nhóm theo đúng thứ tự nhìn thấy, không nhảy cóc', () => {
    const o = moRa();
    // Mục ĐANG TÔ đọc qua `aria-activedescendant`. `aria-selected` nghĩa là ĐÃ CHỌN — hai
    // thứ khác nhau, gộp lại thì trình đọc màn hình đọc mỗi lần bấm mũi tên là "đã chọn".
    const thuTu: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      fireEvent.keyDown(o, { key: 'ArrowDown' });
      const id = o.getAttribute('aria-activedescendant');
      thuTu.push(document.getElementById(id ?? '')?.textContent?.trim() ?? '');
    }
    expect(thuTu).toEqual([
      'Nguyễn Văn A', 'Nguyễn Văn B', 'Trịnh Lê D', 'Nguyễn Văn E', 'Nguyễn Văn F',
    ]);
  });

  it('Enter chọn đúng người đang được tô, kể cả ở nhóm thứ hai', () => {
    const doi = vi.fn();
    render(
      <FKSelect label="Cán bộ" value="" onChange={doi} groups={NHOM} testId="o2" />, { wrapper: boc },
    );
    fireEvent.click(screen.getByTestId('o2-trigger'));
    const o = screen.getByTestId('o2-search');
    for (let i = 0; i < 4; i += 1) fireEvent.keyDown(o, { key: 'ArrowDown' });
    fireEvent.keyDown(o, { key: 'Enter' });
    expect(doi).toHaveBeenCalledWith('e');
  });

  it('theo chuẩn WAI-ARIA: listbox chứa group có tên, option có aria-selected', () => {
    moRa();
    const ds = screen.getByRole('listbox');
    const nhom = within(ds).getAllByRole('group');
    expect(nhom).toHaveLength(2);
    expect(nhom[0]).toHaveAttribute('aria-label', 'Tổ 1');
    // Chưa chọn ai thì không mục nào mang aria-selected=true.
    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'false');
  });

  it('ô tìm trỏ tới mục đang tô bằng aria-activedescendant', () => {
    const o = moRa();
    // `role=combobox` nằm ở Ô BẤM MỞ — thứ người ta Tab tới. Ô tìm chỉ tồn tại sau khi hộp
    // đã mở, đặt vai trò ở đó là tả một thứ không ai với tới được.
    expect(screen.getByTestId('o-can-bo-trigger')).toHaveAttribute('role', 'combobox');
    fireEvent.keyDown(o, { key: 'ArrowDown' });
    const id = o.getAttribute('aria-activedescendant');
    expect(id).toBeTruthy();
    expect(document.getElementById(id as string)?.textContent?.trim()).toBe('Nguyễn Văn A');
  });

  it('Escape khi danh sách rỗng vẫn đóng được ô — không kẹt lại', () => {
    // Nhánh này đi qua `dsPhang.length === 0`, tức đúng điều kiện đã đổi khi thêm chế độ nhóm.
    const o = moRa();
    fireEvent.change(o, { target: { value: 'zzz' } });
    expect(screen.getByTestId('o-can-bo-khong-co-ket-qua')).toBeInTheDocument();
    fireEvent.keyDown(o, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('xoá lựa chọn thì ô về chữ gợi ý — nút Xoá đọc nhãn qua `tatCaMuc`', () => {
    const doi = vi.fn();
    render(
      <FKSelect label="Cán bộ" value="e" onChange={doi} groups={NHOM} testId="o3" />, { wrapper: boc },
    );
    // Giá trị nằm ở NHÓM THỨ HAI: nếu nhãn chỉ tra trong `options` (rỗng ở chế độ nhóm) thì ô
    // hiện chữ gợi ý dù đã chọn — đúng lỗi đã bắt được lúc dựng.
    expect(screen.getByTestId('o3-trigger').textContent).toContain('Nguyễn Văn E');
    fireEvent.click(screen.getByTestId('o3-clear'));
    expect(doi).toHaveBeenCalledWith('');
  });

  it('không tìm thấy ai thì nói rõ, không để hộp trắng', () => {
    const o = moRa();
    fireEvent.change(o, { target: { value: 'zzz' } });
    expect(screen.getByTestId('o-can-bo-khong-co-ket-qua')).toBeInTheDocument();
  });
});

/**
 * Những lỗi lượt rà mã độc lập bắt được — mỗi mệnh đề dưới đây từng ĐỎ.
 */
describe('FKSelect — nhóm: các lỗi đã bắt được', () => {
  it('[P1] danh sách ĐỔI khi đang tô thì bỏ tô, không chọn nhầm người', () => {
    const doi = vi.fn();
    // Khung giữ trạng thái: đổi `groups` NGAY TRONG cây đang chạy, đúng như khi hồ sơ phân
    // công về muộn. Dựng lại component bằng provider mới sẽ đóng hộp và không tái hiện được.
    function Khung() {
      const [ds, setDs] = useState<FKGroup[]>(NHOM);
      return (
        <>
          <button type="button" data-testid="rut-ngan" onClick={() => setDs([{ ...NHOM[0], options: NHOM[0].options.slice(1) }, NHOM[1]])}>
            rút ngắn
          </button>
          <FKSelect label="Cán bộ" value="" onChange={doi} groups={ds} testId="o4" />
        </>
      );
    }
    render(<Khung />, { wrapper: boc });

    fireEvent.click(screen.getByTestId('o4-trigger'));
    fireEvent.keyDown(screen.getByTestId('o4-search'), { key: 'ArrowDown' }); // tô chỉ số 0 = 'Nguyễn Văn A'

    fireEvent.click(screen.getByTestId('rut-ngan')); // A biến mất → chỉ số 0 nay là 'Nguyễn Văn B'
    fireEvent.keyDown(screen.getByTestId('o4-search'), { key: 'Enter' });

    expect(doi).not.toHaveBeenCalled();
  });

  it('[P1] ô bấm mở là điểm dừng của phím Tab và mở được bằng bàn phím', () => {
    moRa();
    const nut = screen.getByTestId('o-can-bo-trigger');
    expect(nut).toHaveAttribute('role', 'combobox');
    expect(nut).toHaveAttribute('tabindex', '0');
    expect(nut).toHaveAttribute('aria-expanded');
  });

  it('[P1] bấm Enter trên ô đóng thì MỞ danh sách — không phải chỉ chuột mới mở được', () => {
    render(
      <FKSelect label="Cán bộ" value="" onChange={vi.fn()} groups={NHOM} testId="o5" />, { wrapper: boc },
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('o5-trigger'), { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('[P2] cán bộ ở HAI tổ: mỗi mục một data-testid riêng, không trùng', () => {
    const HAI_TO: FKGroup[] = [
      { key: 't1', label: 'Tổ 1', options: [{ value: 'h', label: 'Phạm Hai Tổ' }] },
      { key: 't2', label: 'Tổ 2', options: [{ value: 'h', label: 'Phạm Hai Tổ' }] },
    ];
    render(
      <FKSelect label="Cán bộ" value="" onChange={vi.fn()} groups={HAI_TO} testId="o6" />, { wrapper: boc },
    );
    fireEvent.click(screen.getByTestId('o6-trigger'));
    // `getByTestId` NỔ khi trùng — đó chính là lỗi: ca kiểm và kịch bản Playwright đều hỏng.
    expect(() => screen.getByTestId('o6-option-h')).not.toThrow();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('[P2] đang TẢI thì nói "đang tải", KHÔNG nói "không tìm thấy" — hai điều khác hẳn nhau', () => {
    render(
      <FKSelect label="Cán bộ" value="" onChange={vi.fn()} groups={[]} loading testId="o7" />,
      { wrapper: boc },
    );
    fireEvent.click(screen.getByTestId('o7-trigger'));
    expect(screen.queryByTestId('o7-khong-co-ket-qua')).not.toBeInTheDocument();
  });

  it('[P2] chưa gõ gì mà danh sách rỗng thì nói RỖNG, không nói "không tìm thấy kết quả"', () => {
    render(
      <FKSelect label="Cán bộ" value="" onChange={vi.fn()} groups={[]} testId="o8" />, { wrapper: boc },
    );
    fireEvent.click(screen.getByTestId('o8-trigger'));
    expect(screen.getByTestId('o8-rong')).toBeInTheDocument();
  });

  it('[P3] aria-selected chỉ đánh dấu người ĐÃ CHỌN, không đánh dấu người đang tô', () => {
    render(
      <FKSelect label="Cán bộ" value="e" onChange={vi.fn()} groups={NHOM} testId="o9" />, { wrapper: boc },
    );
    fireEvent.click(screen.getByTestId('o9-trigger'));
    fireEvent.keyDown(screen.getByTestId('o9-search'), { key: 'ArrowDown' }); // tô người khác
    const daChon = screen.getAllByRole('option').filter((x) => x.getAttribute('aria-selected') === 'true');
    expect(daChon).toHaveLength(1);
    expect(daChon[0].textContent?.trim()).toBe('Nguyễn Văn E');
  });

  it('[P3] Enter khi CHƯA tô ai thì không tự chọn người đầu danh sách', () => {
    const doi = vi.fn();
    render(
      <FKSelect label="Cán bộ" value="" onChange={doi} groups={NHOM} testId="oA" />, { wrapper: boc },
    );
    fireEvent.click(screen.getByTestId('oA-trigger'));
    fireEvent.change(screen.getByTestId('oA-search'), { target: { value: 'Nguyễn' } });
    fireEvent.keyDown(screen.getByTestId('oA-search'), { key: 'Enter' });
    // Cán bộ gõ để LỌC rồi bấm Enter — tự chọn bừa người đầu là ghi tên người ấy lên Phiếu đề xuất.
    expect(doi).not.toHaveBeenCalled();
  });
});
