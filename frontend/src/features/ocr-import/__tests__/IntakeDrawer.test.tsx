import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IntakeDrawer, type IntakeDrawerProps } from '../IntakeDrawer';

const page = (id: string, fileName: string) => ({
  id,
  sha256: id,
  mimeType: 'image/jpeg',
  sizeBytes: 3,
  createdAt: '2026-11-03T00:00:00Z',
  previewUrl: 'blob:x',
  fileName,
});

const baseIntake = (over: Partial<IntakeDrawerProps['intake']> = {}): IntakeDrawerProps['intake'] => ({
  sessionId: 's1',
  pages: [page('p1', 'trang-1.jpg'), page('p2', 'trang-2.jpg')],
  uploading: false,
  uploadErrors: [],
  phase: 'IDLE',
  errorCode: null,
  analysis: null,
  addFiles: vi.fn(() => Promise.resolve()),
  movePage: vi.fn(() => Promise.resolve()),
  removePage: vi.fn(() => Promise.resolve()),
  read: vi.fn(() => Promise.resolve()),
  cancel: vi.fn(() => Promise.resolve()),
  ...over,
});

const show = (intake = baseIntake(), onClose = vi.fn()) => {
  render(<IntakeDrawer open onClose={onClose} intake={intake} />);
  return { intake, onClose };
};

const readButton = () =>
  screen.getByRole('button', { name: 'Đọc và điền vào form' }) as HTMLButtonElement;

describe('IntakeDrawer', () => {
  it('renders nothing while closed', () => {
    render(<IntakeDrawer open={false} onClose={vi.fn()} intake={baseIntake()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lists the pages in order, numbered', () => {
    show();
    expect(screen.getByText('Trang 1')).toBeTruthy();
    expect(screen.getByText('trang-2.jpg')).toBeTruthy();
  });

  it('hands chosen files to the intake', () => {
    const { intake } = show(baseIntake({ pages: [], sessionId: null }));
    const input = screen.getByTestId('ocr-file-input') as HTMLInputElement;
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(intake.addFiles).toHaveBeenCalledWith([file]);
  });

  it('starts a reading from the stored scans', () => {
    const { intake } = show();
    fireEvent.click(readButton());
    expect(intake.read).toHaveBeenCalledWith('READ');
  });

  it('cannot read without pages', () => {
    show(baseIntake({ pages: [], sessionId: null }));
    expect(readButton().disabled).toBe(true);
  });

  it('cannot start another reading while one is running, and says it is running', () => {
    show(baseIntake({ phase: 'READING' }));
    expect(screen.getByText(/Đang đọc và phân tích/)).toBeTruthy();
    expect(readButton().disabled).toBe(true);
  });

  it('moves and removes pages', () => {
    const { intake } = show();
    fireEvent.click(screen.getAllByRole('button', { name: 'Chuyển xuống' })[0]);
    expect(intake.movePage).toHaveBeenCalledWith('p1', 1);
    fireEvent.click(screen.getAllByRole('button', { name: 'Bỏ trang này' })[1]);
    expect(intake.removePage).toHaveBeenCalledWith('p2');
  });

  it('shows an error by its code, translated', () => {
    show(baseIntake({ phase: 'ERROR', errorCode: 'LLM_BUDGET_EXHAUSTED' }));
    expect(screen.getByRole('alert').textContent).toContain('Ngân sách đọc ảnh của tháng đã hết');
  });

  it('shows a refused file by name and reason', () => {
    show(baseIntake({ uploadErrors: [{ name: 'x.heic', code: 'OCR_IMAGE_UNSUPPORTED' }] }));
    expect(screen.getByText(/x\.heic/)).toBeTruthy();
    expect(screen.getByText(/Định dạng ảnh chưa hỗ trợ/)).toBeTruthy();
  });

  it('after a reading, shows the summary and the points to recheck, never calling it proof', () => {
    show(
      baseIntake({
        phase: 'DONE',
        analysis: {
          id: 'a',
          entity: 'PETITION',
          pageSetRevision: 1,
          inputFingerprint: 'f',
          cleaned: { summary: 'Bà Hương tố cáo ông Bình lừa đảo.' },
          issues: [{ code: 'QUOTE_NOT_FOUND' }, { code: 'ID_BIRTH_YEAR_MISMATCH' }],
          projection: { fills: [], skips: [] },
          promptVersions: {},
        },
      }),
    );
    expect(screen.getByText('Bà Hương tố cáo ông Bình lừa đảo.')).toBeTruthy();
    expect(screen.getByText(/2 điểm hệ thống nghi ngờ/)).toBeTruthy();
    expect(screen.getByText(/Kiểm tra tự động, không thay việc đọc/)).toBeTruthy();
  });

  it('cancel deletes the uploaded scans, close only hides the drawer', () => {
    const { intake, onClose } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ và xoá ảnh đã tải' }));
    expect(intake.cancel).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(onClose).toHaveBeenCalled();
  });
});
