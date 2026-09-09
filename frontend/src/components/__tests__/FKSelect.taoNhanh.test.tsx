import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FKSelect } from '../FKSelect';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

function boc(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const KHONG_CO = { data: { data: [] } };

describe('FKSelect — tìm trên máy chủ', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(KHONG_CO);
  });

  /**
   * Máy chủ chặn cứng limit ở 1.000, mà danh mục DON_VI sẽ có ~1.868 dòng. Lọc phía trình duyệt
   * trên một trang đã cắt là hỏng IM LẶNG: cán bộ gõ tên một đơn vị có thật mà ô tìm báo không
   * có, rồi tạo ra bản trùng.
   */
  it('gõ từ khoá → gửi search LÊN MÁY CHỦ, không lọc tại máy', async () => {
    boc(
      <FKSelect label="Đơn vị xử lý" directoryType="DON_VI" value="" onChange={() => {}} testId="dv" />,
    );
    fireEvent.click(screen.getByTestId('dv-trigger'));
    fireEvent.change(screen.getByTestId('dv-search'), { target: { value: 'Bàn Cờ' } });

    await waitFor(() => {
      const duong = (api.get as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
      expect(duong.some((d) => d.includes('search=B%C3%A0n+C%E1%BB%9D'))).toBe(true);
    });
  });
});

describe('FKSelect — tạo nhanh khi tìm không ra', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(KHONG_CO);
  });

  it('Enter khi 0 kết quả → gọi onCreateNew kèm chữ vừa gõ', async () => {
    const taoMoi = vi.fn();
    boc(
      <FKSelect
        label="Đơn vị xử lý"
        directoryType="DON_VI"
        value=""
        onChange={() => {}}
        testId="dv"
        canCreate
        onCreateNew={taoMoi}
      />,
    );
    fireEvent.click(screen.getByTestId('dv-trigger'));
    const o = screen.getByTestId('dv-search');
    fireEvent.change(o, { target: { value: 'Công an phường Mới' } });
    await waitFor(() => expect(screen.getByTestId('dv-khong-co-ket-qua')).toBeTruthy());
    fireEvent.keyDown(o, { key: 'Enter' });

    expect(taoMoi).toHaveBeenCalledWith('Công an phường Mới');
  });

  /**
   * Bộ gõ tiếng Việt dùng Enter để chốt chữ đang bỏ dấu. Bắt Enter thô sẽ bật hộp "tạo mới"
   * ngay giữa lúc cán bộ đang gõ — mỗi lần bỏ dấu một chữ.
   */
  it('Enter GIỮA LÚC bỏ dấu tiếng Việt → KHÔNG hỏi tạo mới', async () => {
    const taoMoi = vi.fn();
    boc(
      <FKSelect
        label="Đơn vị xử lý"
        directoryType="DON_VI"
        value=""
        onChange={() => {}}
        testId="dv"
        canCreate
        onCreateNew={taoMoi}
      />,
    );
    fireEvent.click(screen.getByTestId('dv-trigger'));
    const o = screen.getByTestId('dv-search');
    fireEvent.change(o, { target: { value: 'Công an phường Mớ' } });
    await waitFor(() => expect(screen.getByTestId('dv-khong-co-ket-qua')).toBeTruthy());

    // `isComposing` là dấu hiệu chuẩn của trình duyệt cho "đang trong bộ gõ".
    fireEvent.keyDown(o, { key: 'Enter', isComposing: true });
    expect(taoMoi).not.toHaveBeenCalled();

    // Nhả bộ gõ xong thì Enter mới có tác dụng.
    fireEvent.keyDown(o, { key: 'Enter' });
    expect(taoMoi).toHaveBeenCalledTimes(1);
  });

  it('chưa gõ gì mà nhấn Enter → không hỏi tạo mới', async () => {
    const taoMoi = vi.fn();
    boc(
      <FKSelect
        label="Đơn vị xử lý"
        directoryType="DON_VI"
        value=""
        onChange={() => {}}
        testId="dv"
        canCreate
        onCreateNew={taoMoi}
      />,
    );
    fireEvent.click(screen.getByTestId('dv-trigger'));
    fireEvent.keyDown(screen.getByTestId('dv-search'), { key: 'Enter' });
    expect(taoMoi).not.toHaveBeenCalled();
  });

  it('không bật canCreate thì Enter không gọi gì', async () => {
    const taoMoi = vi.fn();
    boc(
      <FKSelect
        label="Đơn vị xử lý"
        directoryType="DON_VI"
        value=""
        onChange={() => {}}
        testId="dv"
        onCreateNew={taoMoi}
      />,
    );
    fireEvent.click(screen.getByTestId('dv-trigger'));
    const o = screen.getByTestId('dv-search');
    fireEvent.change(o, { target: { value: 'Đơn vị nào đó' } });
    await waitFor(() => expect(screen.getByTestId('dv-khong-co-ket-qua')).toBeTruthy());
    fireEvent.keyDown(o, { key: 'Enter' });
    expect(taoMoi).not.toHaveBeenCalled();
  });
});
