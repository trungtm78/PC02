/**
 * Popup tạo nhanh mục danh mục phải nói ĐÚNG loại danh mục đang tạo.
 *
 * Popup này sinh ra cho ô "Đơn vị xử lý" nên mọi câu chữ viết cứng "đơn vị". Từ 14/09/2026 ô
 * "Loại thông tin" dùng chung popup — cán bộ gõ "Tố giác" mà popup hỏi "Tên đơn vị" là hỏi sai
 * thứ, và báo "Đơn vị này đã có" cho một loại thông tin thì đọc không hiểu.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { api } from '@/lib/api';
import { QuickCreateDirectoryModalProvider } from '../QuickCreateDirectoryModalProvider';
import {
  useQuickCreateDirectoryModalSafe,
  type QuickCreateDirectoryArgs,
} from '../useQuickCreateDirectoryModal';

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }));

function NutMo({ args }: { args: QuickCreateDirectoryArgs }) {
  const modal = useQuickCreateDirectoryModalSafe();
  return <button onClick={() => modal?.open(args)}>mở</button>;
}

function moPopup(args: QuickCreateDirectoryArgs) {
  render(
    <QuickCreateDirectoryModalProvider>
      <NutMo args={args} />
    </QuickCreateDirectoryModalProvider>,
  );
  fireEvent.click(screen.getByText('mở'));
}

describe('QuickCreateDirectoryModalProvider — câu chữ theo loại danh mục', () => {
  beforeEach(() => vi.mocked(api.post).mockReset());

  it('Loại thông tin: tiêu đề, nhãn và lỗi rỗng nói về loại thông tin', async () => {
    moPopup({ type: 'LOAI_THONG_TIN' });
    const popup = screen.getByTestId('quick-create-directory-modal');
    expect(popup).toHaveTextContent('Tạo loại thông tin');
    expect(popup).toHaveTextContent('Tên loại thông tin');
    expect(popup).not.toHaveTextContent(/đơn vị/i);

    fireEvent.click(screen.getByTestId('quick-create-directory-save'));
    expect(await screen.findByTestId('quick-create-directory-error')).toHaveTextContent(
      'Tên loại thông tin không được để trống',
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it('Loại thông tin đã có: báo và nút chọn nói về loại thông tin', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { name: 'Tố giác', daCoSan: true } } as never);
    moPopup({ type: 'LOAI_THONG_TIN', tenGoiY: 'to giac' });
    fireEvent.click(screen.getByTestId('quick-create-directory-save'));

    expect(await screen.findByTestId('quick-create-directory-da-co')).toHaveTextContent(
      'Loại thông tin này đã có trong danh mục với tên "Tố giác"',
    );
    expect(screen.getByTestId('quick-create-directory-use-existing')).toHaveTextContent(
      'Dùng loại thông tin đã có',
    );
    expect(api.post).toHaveBeenCalledWith('/directories/quick', { type: 'LOAI_THONG_TIN', name: 'to giac' });
  });

  it('Đơn vị: giữ nguyên câu chữ đơn vị xử lý', () => {
    moPopup({ type: 'DON_VI' });
    const popup = screen.getByTestId('quick-create-directory-modal');
    expect(popup).toHaveTextContent('Tạo đơn vị xử lý');
    expect(popup).toHaveTextContent('Tên đơn vị');
    expect(screen.getByTestId('quick-create-directory-name')).toHaveAttribute(
      'placeholder',
      'Ví dụ: Công an phường Bến Nghé',
    );
  });

  /** Loại chưa khai câu chữ riêng vẫn mở được, với câu chữ chung — không nói nhầm "đơn vị". */
  it('loại chưa khai câu chữ riêng dùng câu chữ chung', () => {
    moPopup({ type: 'LOAI_KHAC' });
    const popup = screen.getByTestId('quick-create-directory-modal');
    expect(popup).toHaveTextContent('Tạo mục danh mục');
    expect(popup).not.toHaveTextContent(/đơn vị/i);
  });

  it('tạo xong gọi onCreated với tên máy chủ trả về rồi đóng popup', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { name: 'Trình báo' } } as never);
    const onCreated = vi.fn();
    moPopup({ type: 'LOAI_THONG_TIN', tenGoiY: 'trình báo', onCreated });
    fireEvent.click(screen.getByTestId('quick-create-directory-save'));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith('Trình báo'));
    expect(screen.queryByTestId('quick-create-directory-modal')).toBeNull();
  });
});
