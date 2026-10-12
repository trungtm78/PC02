import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSubmissionEditor } from '../useSubmissionEditor';
import { dynamicReportsApi } from '../api';
import type { SubmissionView } from '../types';

vi.mock('../api', () => ({
  dynamicReportsApi: {
    saveSubmissionValues: vi.fn(),
    getSubmission: vi.fn(),
    submitSubmission: vi.fn(),
    validateForSubmit: vi.fn(),
    previewExcelImport: vi.fn(),
    applyExcelImport: vi.fn(),
  },
}));

const INITIAL = {
  assignmentId: 'a1',
  versionId: 'v1',
  state: 'DRAFT',
  revision: '3',
  values: { 'S!A1': { t: 'NUM', v: '5' } },
  fields: [],
  editable: true,
  effectiveLockAt: null,
} as unknown as SubmissionView;

const saved = (revision: string) => ({
  assignmentId: 'a1',
  revision,
  state: 'DRAFT',
  savedAt: '2026-10-12T00:00:00Z',
  serverTime: '2026-10-12T00:00:00Z',
  effectiveLockAt: null,
});

function setup() {
  return renderHook(() =>
    useSubmissionEditor({ assignmentId: 'a1', initial: INITIAL, refetch: async () => ({ data: INITIAL }) }),
  );
}

describe('useSubmissionEditor — the pieces the grid relies on', () => {
  beforeEach(() => vi.resetAllMocks());

  it('valueOf falls back to the server value until something is typed', () => {
    const { result } = setup();
    expect(result.current.valueOf('S!A1')).toBe('5');
    expect(result.current.valueOf('S!B2')).toBe('');
    act(() => result.current.handleChange('S!A1', '9'));
    expect(result.current.valueOf('S!A1')).toBe('9');
    expect(result.current.peekValue('S!A1')).toBe('9');
  });

  it('applyValues marks every key dirty and saves them in ONE request at the acknowledged revision', async () => {
    vi.mocked(dynamicReportsApi.saveSubmissionValues).mockResolvedValue(saved('4') as never);
    const { result } = setup();
    await act(async () => {
      result.current.applyValues({ 'S!A1': '7', 'S!B2': '8', 'S!C3': '' });
    });
    expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledTimes(1);
    expect(dynamicReportsApi.saveSubmissionValues).toHaveBeenCalledWith(
      'a1',
      { 'S!A1': '7', 'S!B2': '8', 'S!C3': null }, // a blank is sent as null
      '3',
      expect.any(String),
    );
    expect(result.current.revision).toBe('4');
    expect(result.current.saveStatus).toBe('saved');
  });

  it('two actions in the same tick are saved together; a later one is saved at the revision the first returned', async () => {
    vi.mocked(dynamicReportsApi.saveSubmissionValues)
      .mockResolvedValueOnce(saved('4') as never)
      .mockResolvedValueOnce(saved('5') as never);
    const { result } = setup();
    await act(async () => {
      result.current.applyValues({ 'S!A1': '1' });
      result.current.applyValues({ 'S!B2': '2' });
    });
    // Both were dirty before the queue ran: one request carries both.
    expect(vi.mocked(dynamicReportsApi.saveSubmissionValues).mock.calls).toHaveLength(1);
    expect(vi.mocked(dynamicReportsApi.saveSubmissionValues).mock.calls[0][1]).toEqual({ 'S!A1': '1', 'S!B2': '2' });

    await act(async () => {
      result.current.applyValues({ 'S!C3': '3' });
    });
    const calls = vi.mocked(dynamicReportsApi.saveSubmissionValues).mock.calls;
    expect(calls.map((c) => c[2])).toEqual(['3', '4']);
  });

  it('reportProblem shows a message without sending anything', () => {
    const { result } = setup();
    act(() => result.current.reportProblem('Ô A1: sai'));
    expect(result.current.saveStatus).toBe('error');
    expect(result.current.saveError).toBe('Ô A1: sai');
    expect(dynamicReportsApi.saveSubmissionValues).not.toHaveBeenCalled();
  });

  it('a failed save keeps the typed text dirty so the next flush resends it', async () => {
    vi.mocked(dynamicReportsApi.saveSubmissionValues)
      .mockRejectedValueOnce({ isAxiosError: true, response: undefined, message: 'Network Error' })
      .mockResolvedValueOnce(saved('4') as never);
    const { result } = setup();
    await act(async () => {
      result.current.applyValues({ 'S!A1': '7' });
    });
    expect(result.current.saveStatus).toBe('error');
    await act(async () => {
      await result.current.flushAll();
    });
    expect(vi.mocked(dynamicReportsApi.saveSubmissionValues).mock.calls[1][1]).toEqual({ 'S!A1': '7' });
    expect(result.current.saveStatus).toBe('saved');
  });
});
