/**
 * PR2 — stage-then-upload tài liệu khi TẠO MỚI đơn thư.
 * Core: stage file ở create → uploadAll(petitionId) POST /documents tới id MỚI; upload-fail
 * một phần GIỮ file lỗi trong queue + nút "Thử lại" re-upload (không mất staged file).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, createEvent } from '@testing-library/react';
import { createRef } from 'react';
import { api } from '@/lib/api';
import { PetitionCreateDocumentsStage, type PetitionStageHandle } from '../PetitionCreateDocumentsStage';

const posted: Array<{ petitionId: string | null; name: string | null }> = [];
let failNames: Set<string>;

vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn((_url: string, fd: FormData) => {
      const file = fd.get('file') as File | null;
      const name = file?.name ?? null;
      posted.push({ petitionId: fd.get('petitionId') as string | null, name });
      if (name && failNames.has(name)) return Promise.reject(new Error('boom'));
      return Promise.resolve({ data: { success: true, data: { id: 'doc-' + name } } });
    }),
  },
}));
vi.mock('@/lib/api-errors', () => ({ extractApiError: () => ({ message: 'Upload thất bại' }) }));
vi.mock('@/hooks/useCatalog', () => ({
  useCatalog: () => ({ options: [{ code: 'VAN_BAN', label: 'Văn bản' }] }),
}));

function stageFile(testid: string, name: string) {
  const input = screen.getByTestId(testid) as HTMLInputElement;
  const file = new File(['x'], name, { type: 'application/pdf' });
  const ev = createEvent.change(input, { target: { files: [file] } });
  fireEvent(input, ev);
}

beforeEach(() => {
  posted.length = 0;
  failNames = new Set();
  vi.mocked(api.post).mockClear();
});

describe('PetitionCreateDocumentsStage (PR2)', () => {
  it('uploadAll POST /documents tới petitionId mới cho mọi file đã stage', async () => {
    const ref = createRef<PetitionStageHandle>();
    render(<PetitionCreateDocumentsStage ref={ref} />);
    stageFile('stage-file-input', 'a.pdf');
    stageFile('stage-file-input', 'b.pdf');
    await screen.findByText('a.pdf');
    expect(ref.current!.hasStaged()).toBe(true);

    const res = await ref.current!.uploadAll('pet-NEW');
    expect(res).toEqual({ uploaded: 2, failed: [] });
    expect(posted).toEqual([
      { petitionId: 'pet-NEW', name: 'a.pdf' },
      { petitionId: 'pet-NEW', name: 'b.pdf' },
    ]);
    // upload hết → hasStaged false
    await waitFor(() => expect(ref.current!.hasStaged()).toBe(false));
  });

  it('upload-fail một phần: GIỮ file lỗi trong queue, nút Thử lại re-upload', async () => {
    const ref = createRef<PetitionStageHandle>();
    render(<PetitionCreateDocumentsStage ref={ref} />);
    stageFile('stage-file-input', 'ok.pdf');
    stageFile('stage-file-input', 'bad.pdf');
    await screen.findByText('bad.pdf');

    failNames = new Set(['bad.pdf']);
    const res = await ref.current!.uploadAll('pet-NEW');
    expect(res.uploaded).toBe(1);
    expect(res.failed.length).toBe(1);
    // file lỗi vẫn còn trong queue; file ok đã bị loại
    await waitFor(() => expect(ref.current!.hasStaged()).toBe(true));
    expect(screen.queryByText('ok.pdf')).not.toBeInTheDocument();
    expect(screen.getByText('bad.pdf')).toBeInTheDocument();
    await screen.findByTestId('stage-error');

    // Thử lại: lần này không fail nữa
    failNames = new Set();
    posted.length = 0;
    fireEvent.click(screen.getByTestId('stage-retry'));
    await waitFor(() => expect(ref.current!.hasStaged()).toBe(false));
    expect(posted).toEqual([{ petitionId: 'pet-NEW', name: 'bad.pdf' }]);
  });
});
