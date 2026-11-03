import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Difference } from '../useOcrReread';
import { RereadSection, type RereadSectionProps } from '../RereadSection';

const diff = (field: string, current: string, proposed: string, orange = false): Difference => ({
  field,
  current,
  proposed,
  orange,
  quote: orange ? 'câu trích dẫn' : null,
});

const make = (over: Partial<RereadSectionProps['reread']> = {}): RereadSectionProps['reread'] => ({
  phase: 'IDLE',
  errorCode: null,
  differences: [],
  sameCount: 0,
  appliedCount: 0,
  start: vi.fn(() => Promise.resolve()),
  apply: vi.fn(),
  skip: vi.fn(),
  close: vi.fn(() => Promise.resolve()),
  ...over,
});

const show = (reread: RereadSectionProps['reread'], available = true) =>
  render(
    <RereadSection
      available={available}
      reread={reread}
      captionOf={(field) => `Nhãn ${field}`}
    />,
  );

describe('RereadSection', () => {
  it('is not offered when the feature is off for this user', () => {
    show(make(), false);
    expect(screen.queryByRole('button', { name: 'Đọc lại từ ảnh scan' })).toBeNull();
  });

  it('starts a re-read from its button', () => {
    const reread = make();
    show(reread);
    fireEvent.click(screen.getByRole('button', { name: 'Đọc lại từ ảnh scan' }));
    expect(reread.start).toHaveBeenCalled();
  });

  it('says it is reading, and cannot be started twice meanwhile', () => {
    show(make({ phase: 'READING' }));
    expect(screen.getByRole('status').textContent).toContain('Đang đọc');
    expect((screen.getByRole('button', { name: 'Đọc lại từ ảnh scan' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('lists each difference with the current value, the value from the image, and a button to use it', () => {
    const reread = make({
      phase: 'DONE',
      sameCount: 3,
      differences: [diff('senderName', 'Nguyen Thi Huong', 'Nguyễn Thị Hương'), diff('senderIdNumber', '', '079190012345', true)],
    });
    show(reread);
    expect(screen.getByText('3 ô khớp với ảnh')).toBeTruthy();
    expect(screen.getByText('Nhãn senderName')).toBeTruthy();
    expect(screen.getByText('Nguyen Thi Huong')).toBeTruthy();
    expect(screen.getByText('Nguyễn Thị Hương')).toBeTruthy();
    // an empty current value is shown as empty, not as a blank cell
    expect(screen.getByText('(trống)')).toBeTruthy();
    expect(screen.getByText(/câu trích dẫn/)).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Dùng giá trị từ ảnh' })[1]);
    expect(reread.apply).toHaveBeenCalledWith('senderIdNumber');
    fireEvent.click(screen.getAllByRole('button', { name: 'Giữ giá trị hiện tại' })[0]);
    expect(reread.skip).toHaveBeenCalledWith('senderName');
  });

  it('tells the officer that applying only changes the open form, and that saving is theirs to do', () => {
    show(make({ phase: 'DONE', differences: [diff('a', 'x', 'y')] }));
    expect(screen.getByText(/chưa lưu/)).toBeTruthy();
  });

  it('says when nothing differs', () => {
    show(make({ phase: 'DONE', sameCount: 5, differences: [] }));
    expect(screen.getByText('Mọi ô đọc được đều khớp với hồ sơ.')).toBeTruthy();
  });

  it('shows an error by its code, translated', () => {
    show(make({ phase: 'ERROR', errorCode: 'OCR_NO_PAGES' }));
    expect(screen.getByRole('alert').textContent).toContain('Chưa có trang nào');
  });

  it('closing deletes the temporary copy', () => {
    const reread = make({ phase: 'DONE', differences: [] });
    show(reread);
    fireEvent.click(screen.getByRole('button', { name: 'Đóng so sánh' }));
    expect(reread.close).toHaveBeenCalled();
  });
});
