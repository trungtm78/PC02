import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { ONhapGoiY } from '../ONhapGoiY';

type G = { ten: string; soLan: number };

function Chu({ tim, banDau = '' }: { tim: (q: string) => Promise<G[]>; banDau?: string }) {
  const [v, setV] = useState(banDau);
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
        doTre={10}
      />
      {/* Ô soi: thứ mà form cha THẬT SỰ đang giữ. */}
      <output data-testid="cha">{v}</output>
    </>
  );
}

describe('ONhapGoiY — ô chữ tự do có gợi ý', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  /**
   * LỖI ĐÃ VẤP, 22/09/2026. Bản đầu giữ chữ trong một ô đệm rồi chốt lúc RỜI Ô. Cán bộ gõ tên
   * rồi bấm thẳng nút Lưu thì chữ chưa chốt: form báo thiếu ô bắt buộc và không gọi máy chủ,
   * trong khi tên đang hiện rõ trên màn. Mười hai ca kiểm của form Đơn thư đỏ vì đúng chuyện này.
   */
  it('gõ xong là form cha CÓ NGAY giá trị — không đợi rời ô', async () => {
    render(<Chu tim={async () => []} />);
    fireEvent.change(screen.getByTestId('o'), { target: { value: 'Nguyễn Văn A' } });
    expect(screen.getByTestId('cha')).toHaveTextContent('Nguyễn Văn A');
  });

  it('gõ tên CHƯA TỪNG CÓ vẫn giữ nguyên — không ép chọn từ gợi ý', async () => {
    render(<Chu tim={async () => [{ ten: 'Trần Thị A', soLan: 9 }]} />);
    fireEvent.change(screen.getByTestId('o'), { target: { value: 'Tên hoàn toàn mới' } });
    await waitFor(() => expect(screen.getByTestId('o-goi-y')).toBeInTheDocument());
    expect(screen.getByTestId('cha')).toHaveTextContent('Tên hoàn toàn mới');
  });

  it('chọn một gợi ý → điền đúng chữ của gợi ý ấy', async () => {
    render(<Chu tim={async () => [{ ten: 'Trần Thị A', soLan: 29 }]} />);
    fireEvent.change(screen.getByTestId('o'), { target: { value: 'tran' } });
    await waitFor(() => expect(screen.getByTestId('o-goi-y')).toBeInTheDocument());
    fireEvent.mouseDown(screen.getByRole('button', { name: /Trần Thị A/ }));
    expect(screen.getByTestId('cha')).toHaveTextContent('Trần Thị A');
  });

  it('gợi ý HỎNG không chặn nhập liệu', async () => {
    render(<Chu tim={async () => { throw new Error('mạng hỏng'); }} />);
    fireEvent.change(screen.getByTestId('o'), { target: { value: 'abc' } });
    await new Promise((r) => setTimeout(r, 40));
    expect(screen.getByTestId('cha')).toHaveTextContent('abc');
    expect(screen.queryByTestId('o-goi-y')).not.toBeInTheDocument();
  });

  it('xoá trắng ô → đóng danh sách, không hỏi máy chủ', async () => {
    const tim = vi.fn(async () => [{ ten: 'Trần Thị A', soLan: 1 }]);
    render(<Chu tim={tim} />);
    fireEvent.change(screen.getByTestId('o'), { target: { value: 'tran' } });
    await waitFor(() => expect(screen.getByTestId('o-goi-y')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('o'), { target: { value: '' } });
    expect(screen.queryByTestId('o-goi-y')).not.toBeInTheDocument();
    expect(tim).toHaveBeenCalledTimes(1);
  });

  /**
   * Lượt gõ cũ về sau sẽ đè danh sách của lượt mới: cán bộ gõ "tran van", lượt "tran" về muộn
   * và danh sách quay lại kết quả của "tran". Không đo được bằng mắt, chỉ lộ khi mạng chậm.
   */
  it('kết quả của lượt gõ CŨ về muộn KHÔNG đè danh sách của lượt mới', async () => {
    const tim = vi.fn((q: string) =>
      q === 'tran'
        ? new Promise<G[]>((r) => setTimeout(() => r([{ ten: 'CŨ', soLan: 1 }]), 120))
        : Promise.resolve([{ ten: 'MỚI', soLan: 1 }]),
    );
    render(<Chu tim={tim} />);
    fireEvent.change(screen.getByTestId('o'), { target: { value: 'tran' } });
    await new Promise((r) => setTimeout(r, 20));
    fireEvent.change(screen.getByTestId('o'), { target: { value: 'tran van' } });
    await waitFor(() => expect(screen.getByTestId('o-goi-y')).toHaveTextContent('MỚI'));
    await new Promise((r) => setTimeout(r, 160));
    expect(screen.getByTestId('o-goi-y')).toHaveTextContent('MỚI');
    expect(screen.getByTestId('o-goi-y')).not.toHaveTextContent('CŨ');
  });

  /**
   * Bản đầu `return` sớm ở nhánh ô rỗng mà chưa tăng số lượt, nên lượt đang bay của chữ vừa xoá
   * về sau vẫn qua phép kiểm và mở lại danh sách: cán bộ xoá trắng ô rồi gợi ý TỰ BẬT LẠI.
   */
  it('xoá trắng ô rồi kết quả cũ về muộn → danh sách KHÔNG tự bật lại', async () => {
    const tim = vi.fn(
      () => new Promise<G[]>((r) => setTimeout(() => r([{ ten: 'Trần Thị A', soLan: 1 }]), 80)),
    );
    render(<Chu tim={tim} />);
    fireEvent.change(screen.getByTestId('o'), { target: { value: 'tran' } });
    await new Promise((r) => setTimeout(r, 30));
    fireEvent.change(screen.getByTestId('o'), { target: { value: '' } });
    await new Promise((r) => setTimeout(r, 120));
    expect(screen.queryByTestId('o-goi-y')).not.toBeInTheDocument();
  });

  it('chọn xong một gợi ý rồi kết quả cũ về muộn → danh sách KHÔNG mở lại', async () => {
    let lan = 0;
    const tim = vi.fn(
      () =>
        new Promise<G[]>((r) =>
          setTimeout(() => r([{ ten: `T${++lan}`, soLan: 1 }]), lan === 0 ? 0 : 80),
        ),
    );
    render(<Chu tim={tim} />);
    fireEvent.change(screen.getByTestId('o'), { target: { value: 'tran' } });
    await waitFor(() => expect(screen.getByTestId('o-goi-y')).toBeInTheDocument());
    fireEvent.mouseDown(screen.getByRole('button', { name: /T1/ }));
    expect(screen.queryByTestId('o-goi-y')).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByTestId('o-goi-y')).not.toBeInTheDocument();
  });

  it('hẹn giờ được dọn khi tháo component — không gọi mạng trên component đã tháo', async () => {
    const tim = vi.fn(async () => []);
    const { unmount } = render(<Chu tim={tim} />);
    fireEvent.change(screen.getByTestId('o'), { target: { value: 'abc' } });
    unmount();
    await new Promise((r) => setTimeout(r, 40));
    expect(tim).not.toHaveBeenCalled();
  });
});
