import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  transcripts: vi.fn(),
  saveTranscript: vi.fn(),
  pageImage: vi.fn(),
}));
vi.mock('../ocrApi', () => ({ ocrApi: api }));

import { ReviewPanel } from '../ReviewPanel';

const pages = [
  { id: 'p1', fileName: 'a.jpg' },
  { id: 'p2', fileName: 'b.jpg' },
];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.transcripts.mockResolvedValue({
    p1: { text: 'ĐƠN TỐ CÁO\nNguyễn Thị Hương', revision: 1, source: 'MODEL' },
    p2: { text: 'Trang hai', revision: 1, source: 'MODEL' },
  });
  api.pageImage.mockResolvedValue(new Blob(['x'], { type: 'image/jpeg' }));
  api.saveTranscript.mockResolvedValue({ revision: 2 });
  URL.createObjectURL = vi.fn(() => 'blob:scan');
  URL.revokeObjectURL = vi.fn();
});

const show = (onReanalyse = vi.fn()) => {
  render(<ReviewPanel sessionId="s1" pages={pages} onReanalyse={onReanalyse} />);
  return { onReanalyse };
};

describe('ReviewPanel', () => {
  it('shows the scan next to what the system read from it, for the chosen page', async () => {
    show();
    const box = (await screen.findByLabelText('Bản chép')) as HTMLTextAreaElement;
    expect(box.value).toContain('Nguyễn Thị Hương');
    await waitFor(() => expect(screen.getByAltText('Trang 1')).toBeTruthy());
    expect(api.pageImage).toHaveBeenCalledWith('s1', 'p1');

    fireEvent.click(screen.getByRole('button', { name: 'Trang 2' }));
    await waitFor(() => expect((screen.getByLabelText('Bản chép') as HTMLTextAreaElement).value).toBe('Trang hai'));
  });

  it('saving a correction stores it as the officer\'s and offers to analyse again', async () => {
    const { onReanalyse } = show();
    const box = await screen.findByLabelText('Bản chép');
    fireEvent.change(box, { target: { value: 'Nguyễn Thị Hường' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu bản sửa' }));
    await waitFor(() => expect(api.saveTranscript).toHaveBeenCalledWith('s1', 'p1', 'Nguyễn Thị Hường'));

    fireEvent.click(await screen.findByRole('button', { name: 'Phân tích lại từ bản chép' }));
    expect(onReanalyse).toHaveBeenCalled();
  });

  it('does not offer to analyse again until something was corrected', async () => {
    show();
    await screen.findByLabelText('Bản chép');
    expect(screen.queryByRole('button', { name: 'Phân tích lại từ bản chép' })).toBeNull();
  });

  it('marks a page whose text came from the officer', async () => {
    api.transcripts.mockResolvedValue({
      p1: { text: 'đã sửa', revision: 2, source: 'OFFICER' },
      p2: { text: 'x', revision: 1, source: 'MODEL' },
    });
    show();
    expect(await screen.findByText('Đã sửa bởi cán bộ')).toBeTruthy();
  });

  it('says so when the image cannot be shown', async () => {
    api.pageImage.mockRejectedValue(new Error('x'));
    show();
    expect(await screen.findByText('Không tải được ảnh trang này.')).toBeTruthy();
  });
});
