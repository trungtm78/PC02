import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TabMediaBoSung } from '../tabs';

describe('Case media tab', () => {
  it('stages actual bytes with the selected recording date and omits fake view actions', () => {
    const upload = vi.fn();
    render(<TabMediaBoSung mediaFiles={[]} onUpload={upload} onDelete={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Ngày ghi/), { target: { value: '2026-09-20' } });
    const file = new File(['audio'], 'interview.wav', { type: 'audio/wav' });
    fireEvent.change(screen.getByTestId('media-upload-input'), { target: { files: [file] } });
    expect(upload).toHaveBeenCalledWith(file, '2026-09-20');
    expect(screen.queryByRole('button', { name: /xem/i })).not.toBeInTheDocument();
  });

  it('shows stored media with a working download action and hides write controls in read-only mode', () => {
    const download = vi.fn();
    const stored = {
      id: 'document-1', name: 'interview.mp3', type: 'audio/mpeg', size: '2 MB',
      uploadDate: '20/09/2026', uploader: 'Officer', recordDate: '2026-09-18',
    };
    render(<TabMediaBoSung mediaFiles={[stored]} onUpload={vi.fn()} onDelete={vi.fn()} onDownload={download} chiXem />);
    fireEvent.click(screen.getByRole('button', { name: 'Tải xuống' }));
    expect(download).toHaveBeenCalledWith('document-1');
    expect(screen.queryByRole('button', { name: 'Xóa' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('media-upload-input')).not.toBeInTheDocument();
    expect(screen.getByText(/2026-09-18/)).toBeInTheDocument();
  });

  it('blocks unsupported and oversized media before staging', () => {
    const upload = vi.fn();
    render(<TabMediaBoSung mediaFiles={[]} onUpload={upload} onDelete={vi.fn()} />);
    const input = screen.getByTestId('media-upload-input');
    fireEvent.change(input, { target: { files: [new File(['x'], 'bad.exe')] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Định dạng tệp không được hỗ trợ');
    const huge = new File(['x'], 'huge.mp4', { type: 'video/mp4' });
    Object.defineProperty(huge, 'size', { value: 100 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [huge] } });
    expect(screen.getByRole('alert')).toHaveTextContent('Tệp vượt quá 100 MB');
    expect(upload).not.toHaveBeenCalled();
  });
});
