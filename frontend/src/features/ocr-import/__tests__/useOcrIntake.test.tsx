import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OcrAnalysisView, OcrJobView, OcrPageView } from '../ocrApi';

const api = vi.hoisted(() => ({
  openSession: vi.fn(),
  uploadPage: vi.fn(),
  reorder: vi.fn(),
  removePage: vi.fn(),
  read: vi.fn(),
  job: vi.fn(),
  analysis: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock('../ocrApi', () => ({ ocrApi: api }));

import { errorCodeOf, useOcrIntake } from '../useOcrIntake';

const page = (id: string): OcrPageView => ({
  id,
  sha256: id,
  mimeType: 'image/jpeg',
  sizeBytes: 3,
  createdAt: '2026-11-03T00:00:00Z',
});

const job = (
  state: OcrJobView['state'],
  lastErrorCode: string | null = null,
  stage: OcrJobView['stage'] = null,
): OcrJobView => ({
  id: 'j1',
  kind: 'READ',
  state,
  attempts: 1,
  lastErrorCode,
  stage,
  createdAt: '2026-11-03T00:00:00Z',
  finishedAt: null,
});

const analysis = (): OcrAnalysisView => ({
  id: 'ana-1',
  entity: 'PETITION',
  pageSetRevision: 1,
  inputFingerprint: 'fp',
  cleaned: {},
  issues: [],
  projection: { fills: [], skips: [] },
  promptVersions: {},
});

const file = (name: string) => new File([name], name, { type: 'image/jpeg' });

const setup = (onAnalysis = vi.fn()) =>
  renderHook(() =>
    useOcrIntake({ entity: 'PETITION', onAnalysis, pollMs: 5 }),
  );

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.openSession.mockResolvedValue({ id: 's1', entity: 'PETITION' });
  let n = 0;
  api.uploadPage.mockImplementation(() => {
    n += 1;
    return Promise.resolve({ page: page(`p${n}`), pageSetRevision: n });
  });
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

describe('errorCodeOf', () => {
  it('reads the stable code the server sent, nothing else', () => {
    expect(errorCodeOf({ response: { data: { code: 'OCR_IMAGE_UNSUPPORTED' } } })).toBe(
      'OCR_IMAGE_UNSUPPORTED',
    );
    expect(errorCodeOf({ response: { status: 413, data: {} } })).toBe('HTTP_413');
    expect(errorCodeOf(new Error('Network Error'))).toBe('NETWORK');
  });
});

describe('useOcrIntake', () => {
  it('opens one session for the whole bundle and uploads each file on its own', async () => {
    const { result } = setup();
    await act(() => result.current.addFiles([file('a.jpg'), file('b.jpg')]));
    expect(api.openSession).toHaveBeenCalledTimes(1);
    expect(api.openSession).toHaveBeenCalledWith('PETITION');
    expect(api.uploadPage).toHaveBeenCalledTimes(2);
    expect(result.current.pages.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(result.current.sessionId).toBe('s1');
  });

  it('a PDF becomes one page per PDF page, shown without a preview image and named after its file', async () => {
    api.uploadPage.mockReset();
    api.uploadPage.mockResolvedValueOnce({
      page: page('q1'),
      pages: [page('q1'), page('q2'), page('q3')],
      pageSetRevision: 3,
    });
    const { result } = setup();
    const pdf = new File(['%PDF-'], 'don.pdf', { type: 'application/pdf' });
    await act(() => result.current.addFiles([pdf]));
    expect(result.current.pages.map((p) => p.id)).toEqual(['q1', 'q2', 'q3']);
    expect(result.current.pages.map((p) => p.fileName)).toEqual(['don.pdf · trang 1', 'don.pdf · trang 2', 'don.pdf · trang 3']);
    expect(result.current.pages.every((p) => p.previewUrl === null)).toBe(true);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('a file the server refuses is reported by its code and does not stop the others', async () => {
    api.uploadPage
      .mockRejectedValueOnce({ response: { data: { code: 'OCR_IMAGE_UNSUPPORTED' } } })
      .mockResolvedValueOnce({ page: page('p9'), pageSetRevision: 1 });
    const { result } = setup();
    await act(() => result.current.addFiles([file('x.heic'), file('ok.jpg')]));
    expect(result.current.pages.map((p) => p.id)).toEqual(['p9']);
    expect(result.current.uploadErrors).toEqual([{ name: 'x.heic', code: 'OCR_IMAGE_UNSUPPORTED' }]);
  });

  it('moving a page up sends the whole new order', async () => {
    api.reorder.mockResolvedValue({ pageSetRevision: 3 });
    const { result } = setup();
    await act(() => result.current.addFiles([file('a'), file('b'), file('c')]));
    await act(() => result.current.movePage('p3', -1));
    expect(api.reorder).toHaveBeenCalledWith('s1', ['p1', 'p3', 'p2']);
    expect(result.current.pages.map((p) => p.id)).toEqual(['p1', 'p3', 'p2']);
  });

  it('removing a page tells the server and drops it from the list', async () => {
    api.removePage.mockResolvedValue({ pageSetRevision: 3 });
    const { result } = setup();
    await act(() => result.current.addFiles([file('a'), file('b')]));
    await act(() => result.current.removePage('p1'));
    expect(api.removePage).toHaveBeenCalledWith('s1', 'p1');
    expect(result.current.pages.map((p) => p.id)).toEqual(['p2']);
  });

  it('reads, follows the job until it is done, then hands the analysis to the form', async () => {
    const onAnalysis = vi.fn();
    api.read.mockResolvedValue({ id: 'j1', deduplicated: false });
    api.job
      .mockResolvedValueOnce(job('QUEUED'))
      .mockResolvedValueOnce(job('RUNNING'))
      .mockResolvedValue(job('SUCCEEDED'));
    api.analysis.mockResolvedValue(analysis());
    const { result } = setup(onAnalysis);
    await act(() => result.current.addFiles([file('a')]));

    await act(() => result.current.read('READ'));
    await waitFor(() => expect(result.current.phase).toBe('DONE'));

    expect(api.read).toHaveBeenCalledWith('s1', 'READ');
    expect(onAnalysis).toHaveBeenCalledWith('s1', analysis());
    expect(result.current.analysis?.id).toBe('ana-1');
  });

  it('follows the step the server reports while the job runs, and when the reading was asked for', async () => {
    api.read.mockResolvedValue({ id: 'j1', deduplicated: false });
    // Each later answer waits for the test, so every step can be looked at while it is the current one.
    const open: Array<() => void> = [];
    const hold = () => new Promise<void>((resolve) => open.push(resolve));
    api.job
      .mockResolvedValueOnce(job('RUNNING', null, 'READING_PAGES'))
      .mockImplementationOnce(async () => {
        await hold();
        return job('RUNNING', null, 'ANALYSING');
      })
      .mockImplementation(async () => {
        await hold();
        return job('SUCCEEDED');
      });
    api.analysis.mockResolvedValue(analysis());
    const { result } = setup();
    await act(() => result.current.addFiles([file('a')]));
    const before = Date.now();

    // `read` only returns when the job ends, so it is started without waiting for it.
    let reading: Promise<void> = Promise.resolve();
    act(() => {
      reading = result.current.read('READ');
    });
    await waitFor(() => expect(result.current.stage).toBe('READING_PAGES'));
    expect(result.current.startedAt).toBeGreaterThanOrEqual(before);
    expect(result.current.readMode).toBe('READ');

    await act(async () => open.shift()?.());
    await waitFor(() => expect(result.current.stage).toBe('ANALYSING'));

    await act(async () => {
      await waitFor(() => expect(open.length).toBe(1));
      open.shift()?.();
    });
    await act(() => reading);
    expect(result.current.phase).toBe('DONE');
  });

  it('a new reading forgets the step of the previous one', async () => {
    api.read.mockResolvedValue({ id: 'j1', deduplicated: false });
    api.job.mockResolvedValueOnce(job('RUNNING', null, 'ANALYSING')).mockResolvedValue(job('SUCCEEDED'));
    api.analysis.mockResolvedValue(analysis());
    const { result } = setup();
    await act(() => result.current.addFiles([file('a')]));
    await act(() => result.current.read('ANALYSE'));
    await waitFor(() => expect(result.current.phase).toBe('DONE'));
    expect(result.current.readMode).toBe('ANALYSE');

    // The second reading never ends here; cancelling it stops the polling.
    api.cancel.mockResolvedValue(undefined);
    api.job.mockResolvedValue(job('QUEUED'));
    act(() => {
      void result.current.read('READ');
    });
    expect(result.current.stage).toBeNull();
    expect(result.current.readMode).toBe('READ');
    await act(() => result.current.cancel());
  });

  it('a failed job ends in an error carrying its code, and fills nothing', async () => {
    const onAnalysis = vi.fn();
    api.read.mockResolvedValue({ id: 'j1', deduplicated: false });
    api.job.mockResolvedValue(job('FAILED', 'LLM_BUDGET_EXHAUSTED'));
    const { result } = setup(onAnalysis);
    await act(() => result.current.addFiles([file('a')]));
    await act(() => result.current.read('READ'));
    await waitFor(() => expect(result.current.phase).toBe('ERROR'));
    expect(result.current.errorCode).toBe('LLM_BUDGET_EXHAUSTED');
    expect(onAnalysis).not.toHaveBeenCalled();
  });

  it('refuses to start a reading with no pages', async () => {
    const { result } = setup();
    await act(() => result.current.read('READ'));
    expect(api.read).not.toHaveBeenCalled();
  });

  it('reset forgets the session here but leaves the server copy alone (it belongs to a saved record)', async () => {
    const { result } = setup();
    await act(() => result.current.addFiles([file('a')]));
    act(() => result.current.reset());
    expect(api.cancel).not.toHaveBeenCalled();
    expect(result.current.sessionId).toBeNull();
    expect(result.current.pages).toEqual([]);
    // a new bundle opens a new session
    await act(() => result.current.addFiles([file('b')]));
    expect(api.openSession).toHaveBeenCalledTimes(2);
  });

  it('files chosen while the session is still being opened all go into the same session', async () => {
    let release: (v: unknown) => void = () => undefined;
    api.openSession.mockReset();
    api.openSession.mockImplementation(
      () => new Promise((resolve) => (release = resolve)),
    );
    const { result } = setup();
    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.addFiles([file('a')]);
      second = result.current.addFiles([file('b')]);
    });
    release({ id: 's1', entity: 'PETITION' });
    await act(async () => {
      await Promise.all([first, second]);
    });
    expect(api.openSession).toHaveBeenCalledTimes(1);
    expect(api.uploadPage.mock.calls.map((c) => c[0])).toEqual(['s1', 's1']);
  });

  it('an upload that finishes after cancel is dropped: it does not join the next bundle', async () => {
    let finish: (v: unknown) => void = () => undefined;
    api.uploadPage.mockReset();
    api.uploadPage.mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
    api.cancel.mockResolvedValue(undefined);
    const { result } = setup();
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.addFiles([file('old')]);
    });
    await waitFor(() => expect(api.uploadPage).toHaveBeenCalled());
    await act(() => result.current.cancel());
    finish({ page: page('late'), pageSetRevision: 1 });
    await act(async () => {
      await pending;
    });
    expect(result.current.pages).toEqual([]);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('a reading that ends after reset does not hand its analysis to the form', async () => {
    const onAnalysis = vi.fn();
    api.read.mockResolvedValue({ id: 'j1', deduplicated: false });
    api.job.mockResolvedValue(job('SUCCEEDED'));
    api.analysis.mockResolvedValue(analysis());
    const { result } = setup(onAnalysis);
    await act(() => result.current.addFiles([file('a')]));
    act(() => {
      void result.current.read('READ');
    });
    act(() => result.current.reset());
    await new Promise((r) => setTimeout(r, 40));
    expect(onAnalysis).not.toHaveBeenCalled();
  });

  it('tells the screen when the session ends, by cancel or by reset', async () => {
    const onEnded = vi.fn();
    api.cancel.mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useOcrIntake({ entity: 'PETITION', onAnalysis: vi.fn(), pollMs: 5, onSessionEnded: onEnded }),
    );
    await act(() => result.current.addFiles([file('a')]));
    await act(() => result.current.cancel());
    expect(onEnded).toHaveBeenCalledTimes(1);
    await act(() => result.current.addFiles([file('b')]));
    act(() => result.current.reset());
    expect(onEnded).toHaveBeenCalledTimes(2);
  });

  it('cancelling deletes the session on the server and starts over', async () => {
    api.cancel.mockResolvedValue(undefined);
    const { result } = setup();
    await act(() => result.current.addFiles([file('a')]));
    await act(() => result.current.cancel());
    expect(api.cancel).toHaveBeenCalledWith('s1');
    expect(result.current.sessionId).toBeNull();
    expect(result.current.pages).toEqual([]);
  });
});
