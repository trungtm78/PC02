import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { api } from '@/lib/api';
import { ResultFiles } from '../ResultFiles';
import { RequestSlipButton } from '../RequestSlipButton';
import { fileNameFrom } from '../../api/docs';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));
const mGet = vi.mocked(api.get);
const mPost = vi.mocked(api.post);
const mDelete = vi.mocked(api.delete);

/** An error as the server sends it: `{ error: { code, details } }`. */
function serverError(status: number, code: string) {
  const headers = new AxiosHeaders();
  return new AxiosError('x', String(status), { headers } as never, undefined, {
    status,
    statusText: '',
    headers,
    config: { headers } as never,
    data: { error: { code, details: [] } },
  });
}

const FILE = {
  id: 'f1',
  originalName: 'Báo cáo kết quả.pdf',
  mimeType: 'application/pdf',
  size: 2048,
  createdAt: '2026-11-16T03:00:00.000Z',
  uploadedBy: { id: 'u1', firstName: 'Văn A', lastName: 'Nguyễn', username: 'a' },
};

beforeEach(() => {
  mGet.mockReset();
  mPost.mockReset();
  mDelete.mockReset();
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
});

describe('fileNameFrom', () => {
  it('reads the UTF-8 name first, then the plain one, else the fallback', () => {
    expect(fileNameFrom(`attachment; filename="a"; filename*=UTF-8''${encodeURIComponent('Phiếu yêu cầu.docx')}`, 'f')).toBe('Phiếu yêu cầu.docx');
    expect(fileNameFrom(`attachment; filename="${encodeURIComponent('Báo cáo.pdf')}"`, 'f')).toBe('Báo cáo.pdf');
    expect(fileNameFrom(undefined, 'f.docx')).toBe('f.docx');
  });
});

describe('ResultFiles', () => {
  it('lists the files; a reader (canWrite=false) sees no upload and no remove', async () => {
    mGet.mockResolvedValue({ data: [FILE] } as never);
    render(<ResultFiles assignmentId="wa1" canWrite={false} />);
    expect(await screen.findByText('Báo cáo kết quả.pdf')).toBeTruthy();
    expect(mGet).toHaveBeenCalledWith('/ward-assignments/wa1/files');
    expect(screen.queryByText('Tải tệp lên')).toBeNull();
    expect(screen.queryByLabelText('Gỡ Báo cáo kết quả.pdf')).toBeNull();
  });

  it('uploads with the multipart field "file", then lists again; a refusal shows the translated code', async () => {
    mGet.mockResolvedValue({ data: [] } as never);
    mPost.mockRejectedValueOnce(serverError(409, 'WARD_FILES_NOT_APPROVED'));
    render(<ResultFiles assignmentId="wa1" canWrite />);
    await screen.findByText('Chưa có tệp kết quả nào.');
    const input = screen.getByTestId('ward-file-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'kq.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByText('Chỉ thêm hoặc gỡ tệp kết quả khi hồ sơ đã duyệt.')).toBeTruthy();
    const [url, body] = mPost.mock.calls[0];
    expect(url).toBe('/ward-assignments/wa1/files');
    expect((body as FormData).get('file')).toBeInstanceOf(File);

    mPost.mockResolvedValueOnce({ data: FILE } as never);
    mGet.mockResolvedValue({ data: [FILE] } as never);
    fireEvent.change(input, { target: { files: [new File(['x'], 'kq.pdf', { type: 'application/pdf' })] } });
    expect(await screen.findByText('Báo cáo kết quả.pdf')).toBeTruthy();
  });

  it('removes only after the confirm', async () => {
    mGet.mockResolvedValue({ data: [FILE] } as never);
    mDelete.mockResolvedValue({ data: { id: 'f1' } } as never);
    render(<ResultFiles assignmentId="wa1" canWrite />);
    fireEvent.click(await screen.findByLabelText('Gỡ Báo cáo kết quả.pdf'));
    expect(mDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
    mGet.mockResolvedValue({ data: [] } as never);
    fireEvent.click(screen.getByText('Gỡ tệp'));
    await waitFor(() => expect(mDelete).toHaveBeenCalledWith('/ward-assignments/wa1/files/f1'));
    expect(await screen.findByText('Chưa có tệp kết quả nào.')).toBeTruthy();
  });

  it('a list that fails to load says so (not "no files") and offers to retry', async () => {
    mGet.mockRejectedValueOnce(serverError(500, 'X'));
    render(<ResultFiles assignmentId="wa1" canWrite={false} />);
    expect(await screen.findByText('Không tải được danh sách tệp. Hãy thử lại.')).toBeTruthy();
    expect(screen.queryByText('Chưa có tệp kết quả nào.')).toBeNull();
  });

  it('downloads under the server\'s name', async () => {
    mGet.mockResolvedValueOnce({ data: [FILE] } as never);
    mGet.mockResolvedValueOnce({ data: new Blob(['x']), headers: { 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent('Báo cáo kết quả.pdf')}` } } as never);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<ResultFiles assignmentId="wa1" canWrite={false} />);
    fireEvent.click(await screen.findByLabelText('Tải về Báo cáo kết quả.pdf'));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(mGet).toHaveBeenLastCalledWith('/ward-assignments/wa1/files/f1/download', { responseType: 'blob' });
    click.mockRestore();
  });
});

describe('RequestSlipButton', () => {
  const DECISION = { id: 'd1', kind: 'RETURN', slipYear: 2026, slipNumber: '1949A/PYC-PC02-Đ1', slipIssuedAt: '2026-11-16T03:00:00Z', slipDocumentId: 'doc1', signers: null };

  it('not issued, no right to issue: says so, offers nothing', () => {
    render(<RequestSlipButton assignmentId="wa1" decisionId="d1" slipNumber={null} canIssue={false} />);
    expect(screen.getByText('Chưa phát hành phiếu.')).toBeTruthy();
    expect(screen.queryByText('Phát hành phiếu yêu cầu')).toBeNull();
  });

  it('issues with a number written by hand and the signers given, then shows the number and the download', async () => {
    mPost.mockResolvedValue({ data: DECISION } as never);
    const onChanged = vi.fn();
    render(<RequestSlipButton assignmentId="wa1" decisionId="d1" slipNumber={null} canIssue onChanged={onChanged} />);
    fireEvent.click(screen.getByText('Phát hành phiếu yêu cầu'));
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: 1949A'), { target: { value: ' 1949A ' } });
    fireEvent.change(screen.getByLabelText('Ban chỉ huy Đội'), { target: { value: 'Trung tá Hoàng Công Việt' } });
    fireEvent.click(screen.getByText('Phát hành'));
    await waitFor(() =>
      expect(mPost).toHaveBeenCalledWith('/ward-assignments/wa1/decisions/d1/slip', { slipNumber: '1949A', signers: { chiHuyDoi: 'Trung tá Hoàng Công Việt' } }),
    );
    expect(await screen.findByText('Phiếu số 1949A/PYC-PC02-Đ1')).toBeTruthy();
    expect(screen.getByText('Tải phiếu')).toBeTruthy();
    expect(onChanged).toHaveBeenCalledWith(DECISION);
  });

  it('a number already used is told in words', async () => {
    mPost.mockRejectedValue(serverError(409, 'WARD_SLIP_NUMBER_TAKEN'));
    render(<RequestSlipButton assignmentId="wa1" decisionId="d1" slipNumber={null} canIssue />);
    fireEvent.click(screen.getByText('Phát hành phiếu yêu cầu'));
    fireEvent.click(screen.getByText('Phát hành'));
    expect(await screen.findByText('Số phiếu này đã dùng trong năm.')).toBeTruthy();
  });

  it('reissue needs a reason and sends it', async () => {
    mPost.mockResolvedValue({ data: DECISION } as never);
    render(<RequestSlipButton assignmentId="wa1" decisionId="d1" slipNumber="1949A/PYC-PC02-Đ1" canIssue />);
    fireEvent.click(screen.getByText('Phát hành lại'));
    const confirm = screen.getAllByText('Phát hành lại').find((el) => el.closest('form')) as HTMLButtonElement;
    expect((confirm.closest('button') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Lý do phát hành lại (bắt buộc)'), { target: { value: 'Sửa tên chỉ huy' } });
    fireEvent.click(confirm);
    await waitFor(() => expect(mPost).toHaveBeenCalledWith('/ward-assignments/wa1/decisions/d1/slip/reissue', { reason: 'Sửa tên chỉ huy' }));
  });

  it('a reader downloads the stored slip; no issue, no reissue', async () => {
    mGet.mockResolvedValue({ data: new Blob(['x']), headers: {} } as never);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<RequestSlipButton assignmentId="wa1" decisionId="d1" slipNumber="5/PYC-PC02-Đ1" canIssue={false} />);
    expect(screen.queryByText('Phát hành lại')).toBeNull();
    fireEvent.click(screen.getByText('Tải phiếu'));
    await waitFor(() => expect(mGet).toHaveBeenCalledWith('/ward-assignments/wa1/decisions/d1/slip', { responseType: 'blob' }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    click.mockRestore();
  });
});
