import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { ONhapGoiY } from '../ONhapGoiY';

Element.prototype.scrollIntoView = vi.fn();

type G = { ten: string; soLan: number };
const GOI_Y: G[] = [
  { ten: 'Trần Thị A', soLan: 29 },
  { ten: 'Trần Văn B', soLan: 7 },
  { ten: 'Trần Văn C', soLan: 2 },
];

function Chu({ tim = async () => GOI_Y }: { tim?: (q: string) => Promise<G[]> }) {
  const [v, setV] = useState('');
  return (
    <>
      <ONhapGoiY<G>
        value={v}
        onChange={setV}
        timGoiY={tim}
        khoa={(g) => g.ten}
        nhan={(g) => g.ten}
        hien={(g) => <span>{g.ten}</span>}
        testId="o"
        doTre={5}
      />
      <output data-testid="cha">{v}</output>
    </>
  );
}

const o = () => screen.getByTestId('o');

async function gonVaMoDanhSach(chu = 'tran') {
  fireEvent.change(o(), { target: { value: chu } });
  await waitFor(() => expect(screen.getByTestId('o-goi-y')).toBeInTheDocument());
}

describe('ONhapGoiY — bàn phím', () => {
  beforeEach(() => vi.clearAllMocks());

  it('ô là combobox kiểu autocomplete; aria-expanded theo trạng thái danh sách', async () => {
    render(<Chu />);
    expect(o().getAttribute('role')).toBe('combobox');
    expect(o().getAttribute('aria-autocomplete')).toBe('list');
    expect(o().getAttribute('aria-expanded')).toBe('false');
    expect(o().hasAttribute('aria-controls')).toBe(false);
    await gonVaMoDanhSach();
    expect(o().getAttribute('aria-expanded')).toBe('true');
    expect(o().getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id);
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('↓ tô gợi ý đầu, aria-activedescendant trỏ đúng; ↓↓ rồi Enter điền gợi ý thứ ba', async () => {
    render(<Chu />);
    await gonVaMoDanhSach();
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    const opts = screen.getAllByRole('option');
    expect(o().getAttribute('aria-activedescendant')).toBe(opts[0].id);
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    fireEvent.keyDown(o(), { key: 'Enter' });
    expect(screen.getByTestId('cha')).toHaveTextContent('Trần Văn C');
    expect(screen.queryByTestId('o-goi-y')).not.toBeInTheDocument();
  });

  it('↑ từ chưa tô nhảy xuống gợi ý cuối', async () => {
    render(<Chu />);
    await gonVaMoDanhSach();
    fireEvent.keyDown(o(), { key: 'ArrowUp' });
    expect(o().getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[2].id);
  });

  /**
   * Đây là ô CHỮ TỰ DO: cán bộ gõ một cái tên chưa từng có và bấm Enter. Enter mà chưa tô gợi ý nào
   * phải đi tiếp như trước (gửi form), không bị nuốt, và chữ đã gõ phải còn nguyên.
   */
  it('Enter khi CHƯA tô gợi ý nào: KHÔNG bị chặn, chữ đã gõ giữ nguyên', async () => {
    render(<Chu />);
    await gonVaMoDanhSach('tên mới hoàn toàn');
    const khongBiChan = fireEvent.keyDown(o(), { key: 'Enter' });
    expect(khongBiChan).toBe(true);
    expect(screen.getByTestId('cha')).toHaveTextContent('tên mới hoàn toàn');
  });

  it('Enter khi ĐÃ tô gợi ý thì bị chặn (không gửi form) và điền gợi ý', async () => {
    render(<Chu />);
    await gonVaMoDanhSach();
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    const khongBiChan = fireEvent.keyDown(o(), { key: 'Enter' });
    expect(khongBiChan).toBe(false);
    expect(screen.getByTestId('cha')).toHaveTextContent('Trần Thị A');
  });

  it('Escape đóng danh sách và giữ chữ đã gõ; ↓ mở lại danh sách đã có', async () => {
    render(<Chu />);
    await gonVaMoDanhSach();
    fireEvent.keyDown(o(), { key: 'Escape' });
    expect(screen.queryByTestId('o-goi-y')).not.toBeInTheDocument();
    expect(screen.getByTestId('cha')).toHaveTextContent('tran');
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    expect(screen.getByTestId('o-goi-y')).toBeInTheDocument();
  });

  it('Tab đóng danh sách và KHÔNG chặn mặc định (tiêu điểm đi tiếp sang ô kế)', async () => {
    render(<Chu />);
    await gonVaMoDanhSach();
    const khongBiChan = fireEvent.keyDown(o(), { key: 'Tab' });
    expect(khongBiChan).toBe(true);
    expect(screen.queryByTestId('o-goi-y')).not.toBeInTheDocument();
  });

  it('danh sách đóng và chưa có gợi ý: ↓ và Enter không bị chặn, không làm gì', async () => {
    render(<Chu tim={async () => []} />);
    fireEvent.change(o(), { target: { value: 'abc' } });
    await new Promise((r) => setTimeout(r, 30));
    expect(fireEvent.keyDown(o(), { key: 'ArrowDown' })).toBe(true);
    expect(fireEvent.keyDown(o(), { key: 'Enter' })).toBe(true);
    expect(screen.getByTestId('cha')).toHaveTextContent('abc');
  });

  it('đang gõ dấu tiếng Việt (isComposing) thì ↓ và Enter bị bỏ qua', async () => {
    render(<Chu />);
    await gonVaMoDanhSach();
    fireEvent.keyDown(o(), { key: 'ArrowDown', isComposing: true });
    expect(o().getAttribute('aria-activedescendant')).toBeNull();
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    fireEvent.keyDown(o(), { key: 'Enter', isComposing: true });
    expect(screen.getByTestId('cha')).toHaveTextContent('tran');
  });

  it('gợi ý mới về thì bỏ tô — Enter không chọn nhầm dòng cũ', async () => {
    let lan = 0;
    const tim = vi.fn(async () => (++lan === 1 ? GOI_Y : [{ ten: 'Lê Văn D', soLan: 1 }]));
    render(<Chu tim={tim} />);
    await gonVaMoDanhSach('tran');
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    fireEvent.change(o(), { target: { value: 'le' } });
    await waitFor(() => expect(screen.getByTestId('o-goi-y')).toHaveTextContent('Lê Văn D'));
    expect(o().getAttribute('aria-activedescendant')).toBeNull();
    fireEvent.keyDown(o(), { key: 'Enter' });
    expect(screen.getByTestId('cha')).toHaveTextContent('le');
  });

  it('bấm chuột vào gợi ý vẫn điền như trước (mouseDown)', async () => {
    render(<Chu />);
    await gonVaMoDanhSach();
    fireEvent.mouseDown(screen.getAllByRole('option')[1]);
    expect(screen.getByTestId('cha')).toHaveTextContent('Trần Văn B');
  });

  /**
   * LỖI do Codex bắt: tô một gợi ý, gõ sang tên khác rồi bấm Enter trước khi lượt tìm mới (hoãn 300 ms)
   * trả về — gợi ý cũ ghi đè chữ vừa gõ và chặn gửi form. Phải bỏ tô NGAY khi chữ đổi.
   */
  it('tô gợi ý rồi gõ tên khác, Enter khi lượt tìm mới chưa về: giữ chữ vừa gõ, không bị gợi ý cũ ghi đè', async () => {
    const tim = vi.fn(
      (q: string) => new Promise<G[]>((r) => setTimeout(() => r(q === 'tran' ? GOI_Y : []), q === 'tran' ? 0 : 200)),
    );
    render(<Chu tim={tim} />);
    await gonVaMoDanhSach('tran');
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    expect(o().getAttribute('aria-activedescendant')).not.toBeNull();
    fireEvent.change(o(), { target: { value: 'Lê Hoàng' } });
    const khongBiChan = fireEvent.keyDown(o(), { key: 'Enter' });
    expect(screen.getByTestId('cha')).toHaveTextContent('Lê Hoàng');
    // Không còn gợi ý nào đang tô nên Enter đi tiếp (gửi form) như với mọi ô chữ tự do.
    expect(khongBiChan).toBe(true);
  });

  it('cùng bộ gợi ý trả về sau khi gõ thêm chữ: dòng tô cũ cũng đã bị bỏ', async () => {
    render(<Chu />);
    await gonVaMoDanhSach('tran');
    fireEvent.keyDown(o(), { key: 'ArrowDown' });
    fireEvent.change(o(), { target: { value: 'tran ' } });
    await waitFor(() => expect(screen.getByTestId('o-goi-y')).toBeInTheDocument());
    expect(o().getAttribute('aria-activedescendant')).toBeNull();
    fireEvent.keyDown(o(), { key: 'Enter' });
    expect(screen.getByTestId('cha')).toHaveTextContent('tran');
  });

  it('Escape khi danh sách đang mở KHÔNG lọt ra ngoài (không đóng cửa sổ chứa ô)', async () => {
    const ngoai = vi.fn();
    document.addEventListener('keydown', ngoai);
    try {
      render(<Chu />);
      await gonVaMoDanhSach();
      fireEvent.keyDown(o(), { key: 'Escape' });
      expect(screen.queryByTestId('o-goi-y')).not.toBeInTheDocument();
      expect(ngoai).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', ngoai);
    }
  });

  it('Escape khi danh sách ĐÃ đóng đi tiếp bình thường (để cửa sổ chứa ô tự đóng)', async () => {
    const ngoai = vi.fn();
    document.addEventListener('keydown', ngoai);
    try {
      render(<Chu />);
      fireEvent.keyDown(o(), { key: 'Escape' });
      expect(ngoai).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', ngoai);
    }
  });
});
