import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ResultsTab } from '../ResultsTab';
import { processingRecordApi } from '../api';
import { triggerDownload } from '@/features/document-templates/export.api';
import { processingFlow as L, errorText } from '@/locales/processingFlow.vi';
import { apiError } from '../../__tests__/fixtures';
import { ALL_STEP_PERMISSIONS, book, opinion, recFlow, recStep, report } from './fixtures';
import type { ReportAttachmentDto } from '../types';

vi.mock('../api', () => ({
  processingRecordApi: {
    get: vi.fn(),
    results: vi.fn(),
    submitReport: vi.fn(),
    editReport: vi.fn(),
    withdrawReport: vi.fn(),
    addOpinion: vi.fn(),
    withdrawOpinion: vi.fn(),
    decide: vi.fn(),
    attach: vi.fn(),
    removeAttachment: vi.fn(),
    downloadAttachment: vi.fn(),
  },
}));
vi.mock('@/features/document-templates/export.api', () => ({ triggerDownload: vi.fn() }));
vi.mock('../useCurrentUserId', () => ({ useCurrentUserId: () => 'u7' }));
const held = vi.hoisted(() => ({ value: null as string[] | null }));
vi.mock('@/hooks/usePermission', () => ({ usePermission: () => ({ permissions: held.value }) }));

const api = vi.mocked(processingRecordApi);
const A = L.recordTabs.results.attachments;

const file = (over: Partial<ReportAttachmentDto> = {}): ReportAttachmentDto => ({
  id: 'd1',
  fileName: 'Biên bản xác minh.pdf',
  size: 2 * 1024 * 1024,
  uploadedAt: '2026-12-05T02:00:00.000Z',
  uploaderName: 'Trần B',
  ...over,
});

/** The tab inside a form, as on the record screens: whatever the attachments do must never save the record. */
const saved = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
function renderTab() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <form onSubmit={saved}>
        <ResultsTab kind="PETITION" recordId="r1" />
      </form>
    </QueryClientProvider>,
  );
}

const pick = (input: HTMLElement, files: File[]) => fireEvent.change(input, { target: { files } });
const aFile = (name: string) => new File(['x'], name, { type: 'application/pdf' });

beforeEach(() => {
  vi.resetAllMocks();
  held.value = ALL_STEP_PERMISSIONS;
  api.get.mockResolvedValue(recFlow({}, [recStep({ stepKey: 'b', name: 'Xác minh' })]));
  api.results.mockResolvedValue(book([report({ attachments: [file()] })]));
});

describe('the files of a report', () => {
  it('lists each file under its report with its size, who attached it and when, and downloads it through the API', async () => {
    const response = { data: new Blob(['x']), headers: {} };
    api.downloadAttachment.mockResolvedValue(response as never);
    renderTab();
    const row = await screen.findByTestId('attachment-d1');
    expect(row).toHaveTextContent('Biên bản xác minh.pdf');
    expect(row).toHaveTextContent('2,0 MB');
    expect(row).toHaveTextContent('Trần B');

    fireEvent.click(screen.getByTestId('attachment-d1-download'));
    await waitFor(() => expect(api.downloadAttachment).toHaveBeenCalledWith('PETITION', 'r1', 'b', 'rp1', 'd1'));
    // The shared helper names the file from the header of the answer, the listed name only as its fallback.
    await waitFor(() => expect(vi.mocked(triggerDownload)).toHaveBeenCalledWith(response, 'Biên bản xác minh.pdf'));
    expect(saved).not.toHaveBeenCalled();
  });

  it('says so when a file cannot be downloaded', async () => {
    api.downloadAttachment.mockRejectedValue(apiError(404, 'ATTACHMENT_NOT_FOUND'));
    renderTab();
    fireEvent.click(await screen.findByTestId('attachment-d1-download'));
    expect(await screen.findByTestId('report-rp1-attachments-problem')).toHaveTextContent(A.downloadFailed('Biên bản xác minh.pdf'));
    expect(vi.mocked(triggerDownload)).not.toHaveBeenCalled();
  });

  it('the author sends several files one after another; each line says sent, or why it was refused, and the book is read again', async () => {
    const order: string[] = [];
    api.attach.mockImplementation((_kind, _id, _step, _report, sent: File) => {
      order.push(sent.name);
      return sent.name === 'b.pdf' ? Promise.reject(apiError(409, 'STEP_NOT_OPEN')) : Promise.resolve(file({ id: `new-${sent.name}`, fileName: sent.name }));
    });
    renderTab();
    const input = await screen.findByTestId('report-rp1-attachments-input');
    expect(input.closest('form')).toBe(document.querySelector('form')); // only the record's own form: none of its own
    expect(document.querySelectorAll('form')).toHaveLength(1);
    const before = api.results.mock.calls.length;

    pick(input, [aFile('a.pdf'), aFile('b.pdf'), aFile('c.pdf')]);
    await waitFor(() => expect(screen.getAllByTestId('report-rp1-attachments-line').map((el) => el.getAttribute('data-state'))).toEqual(['sent', 'failed', 'sent']));
    // One call per file, in the order chosen; the refused one did not stop the one after it.
    expect(order).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    expect(api.attach).toHaveBeenNthCalledWith(1, 'PETITION', 'r1', 'b', 'rp1', expect.objectContaining({ name: 'a.pdf' }));
    const lines = screen.getAllByTestId('report-rp1-attachments-line').map((el) => el.textContent);
    expect(lines).toEqual([A.sent('a.pdf'), A.failed('b.pdf', errorText('STEP_NOT_OPEN')), A.sent('c.pdf')]);
    await waitFor(() => expect(api.results.mock.calls.length).toBeGreaterThan(before));
    expect(saved).not.toHaveBeenCalled();
  });

  it('removing asks first, in the line itself; "no" changes nothing, "yes" removes and reads the book again', async () => {
    api.removeAttachment.mockResolvedValue({ id: 'd1' });
    renderTab();
    fireEvent.click(await screen.findByTestId('attachment-d1-remove'));
    expect(screen.getByTestId('attachment-d1')).toHaveTextContent(A.removeAsk('Biên bản xác minh.pdf'));
    fireEvent.click(screen.getByTestId('attachment-d1-remove-no'));
    expect(api.removeAttachment).not.toHaveBeenCalled();
    expect(screen.getByTestId('attachment-d1-remove')).toBeInTheDocument();

    const before = api.results.mock.calls.length;
    api.results.mockResolvedValue(book([report({ attachments: [] })]));
    fireEvent.click(screen.getByTestId('attachment-d1-remove'));
    fireEvent.click(screen.getByTestId('attachment-d1-remove-yes'));
    await waitFor(() => expect(api.removeAttachment).toHaveBeenCalledWith('PETITION', 'r1', 'b', 'rp1', 'd1'));
    await waitFor(() => expect(screen.queryByTestId('attachment-d1')).not.toBeInTheDocument());
    expect(api.results.mock.calls.length).toBeGreaterThan(before);
    expect(saved).not.toHaveBeenCalled();
  });

  it('a refused removal shows its sentence and keeps the file', async () => {
    api.removeAttachment.mockRejectedValue(apiError(409, 'STEP_NOT_OPEN'));
    renderTab();
    fireEvent.click(await screen.findByTestId('attachment-d1-remove'));
    fireEvent.click(screen.getByTestId('attachment-d1-remove-yes'));
    expect(await screen.findByTestId('report-rp1-attachments-problem')).toHaveTextContent(errorText('STEP_NOT_OPEN'));
    expect(screen.getByTestId('attachment-d1')).toBeInTheDocument();
  });

  it.each([
    ['somebody else wrote the report', () => book([report({ authorId: 'u9', attachments: [file()] })]), {}],
    ['the step is done', () => book([report({ attachments: [file()] })]), { status: 'DONE' as const, doneAt: '2026-12-06T00:00:00.000Z' }],
    ['the report was withdrawn', () => book([report({ withdrawnAt: '2026-12-06T00:00:00.000Z', attachments: [file()] })]), {}],
    ['the report was answered', () => book([report({ answered: true, attachments: [file()] })], [opinion({ reportId: 'rp1' })]), {}],
  ])('download only when %s: the file is listed, nothing to add or remove', async (_why, results, stepOver) => {
    api.get.mockResolvedValue(recFlow({}, [recStep({ stepKey: 'b', name: 'Xác minh', ...stepOver })]));
    api.results.mockResolvedValue(results());
    renderTab();
    const toggle = await screen.findByTestId('results-step-b-toggle');
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle);
    expect(await screen.findByTestId('attachment-d1-download')).toBeInTheDocument();
    expect(screen.queryByTestId('attachment-d1-remove')).not.toBeInTheDocument();
    expect(screen.queryByTestId('report-rp1-attachments-input')).not.toBeInTheDocument();
  });

  it('a report with no file shows nothing to a reader, and the box to add one to its author', async () => {
    api.results.mockResolvedValue(book([report({ id: 'mine', attachments: [] }), report({ id: 'theirs', authorId: 'u9', attachments: [] })]));
    renderTab();
    expect(await screen.findByTestId('report-mine-attachments-input')).toBeInTheDocument();
    expect(screen.queryByTestId('report-theirs-attachments')).not.toBeInTheDocument();
  });
});
