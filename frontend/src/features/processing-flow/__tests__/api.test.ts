import { describe, it, expect, vi, beforeEach } from 'vitest';

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: http }));

import { processingCalendarApi, processingFlowApi } from '../api';

beforeEach(() => {
  vi.resetAllMocks();
  for (const m of Object.values(http)) m.mockResolvedValue({ data: { ok: true } });
});

describe('the flow routes', () => {
  it('lists with the archive switch and an optional record kind', async () => {
    await processingFlowApi.list({ includeArchived: true });
    expect(http.get).toHaveBeenCalledWith('/processing-flows', { params: { includeArchived: true } });
    await processingFlowApi.list({ includeArchived: false, recordKind: 'CASE' });
    expect(http.get).toHaveBeenLastCalledWith('/processing-flows', { params: { recordKind: 'CASE' } });
  });

  it('returns the body, not the axios response', async () => {
    http.get.mockResolvedValueOnce({ data: [{ id: 'f1' }] });
    await expect(processingFlowApi.list({ includeArchived: false })).resolves.toEqual([{ id: 'f1' }]);
  });

  it('deletes with the revision and the typed name in the query', async () => {
    await processingFlowApi.remove('f1', 4, 'Tố cáo');
    expect(http.delete).toHaveBeenCalledWith('/processing-flows/f1', { params: { expectedRevision: 4, confirmName: 'Tố cáo' } });
  });

  it('archives and restores with the revision in the body', async () => {
    await processingFlowApi.archive('f1', 4);
    expect(http.post).toHaveBeenLastCalledWith('/processing-flows/f1/archive', { expectedRevision: 4 });
    await processingFlowApi.restore('f1', 5);
    expect(http.post).toHaveBeenLastCalledWith('/processing-flows/f1/restore', { expectedRevision: 5 });
  });

  it('replaces the steps of a draft with the revision of the VERSION', async () => {
    await processingFlowApi.saveSteps('f1', 'v2', [], 7);
    expect(http.put).toHaveBeenCalledWith('/processing-flows/f1/versions/v2/steps', { steps: [], expectedRevision: 7 });
  });

  it('drops a draft with the revision in the query (required by the server)', async () => {
    await processingFlowApi.deleteDraft('f1', 'v2', 7);
    expect(http.delete).toHaveBeenCalledWith('/processing-flows/f1/versions/v2', { params: { expectedRevision: 7 } });
  });

  it('publishes with the revision of the version', async () => {
    await processingFlowApi.publish('f1', 'v2', 7);
    expect(http.post).toHaveBeenCalledWith('/processing-flows/f1/versions/v2/publish', { expectedRevision: 7 });
  });

  it('verifies and un-verifies the legal basis of a step WITH the revision of the version', async () => {
    await processingFlowApi.verifyLegal('f1', 'v2', 's 1', 7);
    expect(http.post).toHaveBeenLastCalledWith('/processing-flows/f1/versions/v2/steps/s%201/verify-legal', { expectedRevision: 7 });
    await processingFlowApi.unverifyLegal('f1', 'v2', 's1', 7);
    expect(http.post).toHaveBeenLastCalledWith('/processing-flows/f1/versions/v2/steps/s1/unverify-legal', { expectedRevision: 7 });
  });

  it('creates a new draft with no body', async () => {
    await processingFlowApi.createDraft('f1');
    expect(http.post).toHaveBeenCalledWith('/processing-flows/f1/versions');
  });

  it('sets the bindings with the revision of the flow', async () => {
    await processingFlowApi.setBindings('f1', ['d1'], ['TO_CAO'], 3);
    expect(http.put).toHaveBeenCalledWith('/processing-flows/f1/bindings', { directoryIds: ['d1'], deadlineGroups: ['TO_CAO'], expectedRevision: 3 });
  });

  it('previews the schedule without a revision (it writes nothing)', async () => {
    await processingFlowApi.previewSchedule({ recordKind: 'CASE', steps: [] });
    expect(http.post).toHaveBeenCalledWith('/processing-flows/preview-schedule', { recordKind: 'CASE', steps: [] }, {});
  });

  it('lets the caller cancel a preview that is overtaken', async () => {
    const controller = new AbortController();
    await processingFlowApi.previewSchedule({ recordKind: 'CASE', steps: [] }, controller.signal);
    expect(http.post).toHaveBeenCalledWith('/processing-flows/preview-schedule', { recordKind: 'CASE', steps: [] }, { signal: controller.signal });
  });
});

describe('the calendar routes', () => {
  it('reads one year', async () => {
    await processingCalendarApi.get(2026);
    expect(http.get).toHaveBeenCalledWith('/processing-calendar/years/2026');
  });

  it('saves a year with expected in the body', async () => {
    const body = { weekendDays: [0, 6], days: [], expected: { id: 'y1', revision: 2 } };
    await processingCalendarApi.save(2026, body);
    expect(http.put).toHaveBeenCalledWith('/processing-calendar/years/2026', body);
  });

  it('confirms and un-confirms with expected {id, revision}', async () => {
    await processingCalendarApi.confirm(2026, { id: 'y1', revision: 2 });
    expect(http.post).toHaveBeenLastCalledWith('/processing-calendar/years/2026/confirm', { expected: { id: 'y1', revision: 2 } });
    await processingCalendarApi.unconfirm(2026, { id: 'y1', revision: 3 });
    expect(http.post).toHaveBeenLastCalledWith('/processing-calendar/years/2026/unconfirm', { expected: { id: 'y1', revision: 3 } });
  });

  it('deletes a year with id and revision in the query', async () => {
    await processingCalendarApi.remove(2026, { id: 'y1', revision: 2 });
    expect(http.delete).toHaveBeenCalledWith('/processing-calendar/years/2026', { params: { id: 'y1', revision: 2 } });
  });
});
