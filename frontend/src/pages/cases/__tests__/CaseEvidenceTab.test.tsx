/**
 * CaseEvidenceTab — the first read path for evidence.
 *
 * Evidence rows have been written by the case-creation form since it shipped,
 * and nothing ever read them back: there was no `include: { evidences }`
 * anywhere in the codebase, so an officer could record seized items and never
 * see them again. These tests lock in that the tab actually shows them, and
 * that the write paths do not repeat the failure modes found elsewhere in this
 * codebase (a failed load presented as an empty list, an error reported as
 * success).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { apiState, postSpy, putSpy, deleteSpy } = vi.hoisted(() => ({
  apiState: {
    items: [] as unknown[],
    listShouldFail: false,
  },
  postSpy: vi.fn(() => Promise.resolve({ data: { success: true } })),
  putSpy: vi.fn(() => Promise.resolve({ data: { success: true } })),
  deleteSpy: vi.fn(() => Promise.resolve({ data: { success: true } })),
}));

function axiosError(status: number, message: string) {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: {
      status,
      data: { success: false, error: { code: 'ERROR', message, details: [] } },
    },
  });
}

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(() =>
      apiState.listShouldFail
        ? Promise.reject(axiosError(403, 'Không có quyền xem vật chứng'))
        : Promise.resolve({ data: { success: true, data: apiState.items } }),
    ),
    post: postSpy,
    put: putSpy,
    delete: deleteSpy,
  },
}));

import { CaseEvidenceTab } from '../CaseEvidenceTab';

const KNIFE = {
  id: 'ev-1',
  code: 'VC-001',
  name: 'Dao Thái Lan',
  quantity: 1,
  unit: 'cái',
  storageLocation: 'Kho A',
  receivedDate: '2026-03-04T00:00:00.000Z',
  status: 'THU_GIU',
  evidenceType: 'vũ khí',
};

describe('CaseEvidenceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiState.items = [KNIFE];
    apiState.listShouldFail = false;
  });

  it('shows evidence recorded against the case', async () => {
    render(<CaseEvidenceTab caseId="case-1" />);

    expect(await screen.findByTestId('evidence-row-ev-1')).toBeInTheDocument();
    expect(screen.getByText('VC-001')).toBeInTheDocument();
    expect(screen.getByText('Dao Thái Lan')).toBeInTheDocument();
    expect(screen.getByText('Kho A')).toBeInTheDocument();
    // Status renders its Vietnamese label, not the wire value.
    expect(screen.getByText('Đang thu giữ')).toBeInTheDocument();
    expect(screen.getByText(/Vật chứng \(1\)/)).toBeInTheDocument();
  });

  it('distinguishes an empty case from a failed load', async () => {
    apiState.items = [];
    render(<CaseEvidenceTab caseId="case-1" />);

    expect(await screen.findByTestId('evidence-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('evidence-error')).not.toBeInTheDocument();
  });

  it('surfaces a load failure instead of showing an empty list', async () => {
    apiState.listShouldFail = true;
    render(<CaseEvidenceTab caseId="case-1" />);

    expect(await screen.findByTestId('evidence-error')).toHaveTextContent(
      'Không có quyền xem vật chứng',
    );
    // An error must not be presented as "no evidence recorded".
    expect(screen.queryByTestId('evidence-empty')).not.toBeInTheDocument();
  });

  it('creates evidence against the current case', async () => {
    render(<CaseEvidenceTab caseId="case-1" />);
    await screen.findByTestId('evidence-row-ev-1');

    fireEvent.click(screen.getByTestId('add-evidence-btn'));
    fireEvent.change(screen.getByTestId('evidence-code'), {
      target: { value: 'VC-002' },
    });
    fireEvent.change(screen.getByTestId('evidence-name'), {
      target: { value: 'Điện thoại' },
    });
    fireEvent.click(screen.getByTestId('save-evidence-btn'));

    await waitFor(() => expect(postSpy).toHaveBeenCalledTimes(1));
    const [url, body] = postSpy.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe('/evidences');
    expect(body).toMatchObject({
      code: 'VC-002',
      name: 'Điện thoại',
      caseId: 'case-1',
      status: 'THU_GIU',
    });
  });

  it('refuses to submit without a code and name', async () => {
    render(<CaseEvidenceTab caseId="case-1" />);
    await screen.findByTestId('evidence-row-ev-1');

    fireEvent.click(screen.getByTestId('add-evidence-btn'));
    fireEvent.click(screen.getByTestId('save-evidence-btn'));

    expect(await screen.findByTestId('evidence-form-error')).toBeInTheDocument();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('edits through PUT and never sends caseId', async () => {
    render(<CaseEvidenceTab caseId="case-1" />);
    await screen.findByTestId('evidence-row-ev-1');

    fireEvent.click(screen.getByTestId('edit-evidence-ev-1'));
    fireEvent.change(screen.getByTestId('evidence-name'), {
      target: { value: 'Dao gấp' },
    });
    fireEvent.click(screen.getByTestId('save-evidence-btn'));

    await waitFor(() => expect(putSpy).toHaveBeenCalledTimes(1));
    const [url, body] = putSpy.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(url).toBe('/evidences/ev-1');
    expect(body.name).toBe('Dao gấp');
    // Re-filing evidence into another case is not an edit — the DTO omits it.
    expect(body).not.toHaveProperty('caseId');
  });

  it('sends null, not undefined, when an optional field is cleared', async () => {
    // `undefined` is dropped during JSON serialisation and the backend only
    // writes keys that are `!== undefined` — so a cleared field would keep its
    // old value while the UI reported success.
    render(<CaseEvidenceTab caseId="case-1" />);
    await screen.findByTestId('evidence-row-ev-1');

    fireEvent.click(screen.getByTestId('edit-evidence-ev-1'));
    const storage = screen.getByDisplayValue('Kho A');
    fireEvent.change(storage, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('save-evidence-btn'));

    await waitFor(() => expect(putSpy).toHaveBeenCalledTimes(1));
    const [, body] = putSpy.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(body.storageLocation).toBeNull();
    expect('storageLocation' in body).toBe(true);
  });

  it('keeps the form open and shows the server message when saving fails', async () => {
    postSpy.mockRejectedValueOnce(
      axiosError(409, 'Mã vật chứng "VC-002" đã tồn tại trong vụ án này') as never,
    );
    render(<CaseEvidenceTab caseId="case-1" />);
    await screen.findByTestId('evidence-row-ev-1');

    fireEvent.click(screen.getByTestId('add-evidence-btn'));
    fireEvent.change(screen.getByTestId('evidence-code'), {
      target: { value: 'VC-002' },
    });
    fireEvent.change(screen.getByTestId('evidence-name'), {
      target: { value: 'Điện thoại' },
    });
    fireEvent.click(screen.getByTestId('save-evidence-btn'));

    expect(await screen.findByTestId('evidence-form-error')).toHaveTextContent(
      'đã tồn tại trong vụ án này',
    );
    expect(screen.getByTestId('evidence-form')).toBeInTheDocument();
  });

  it('asks before deleting, and does nothing if the user declines', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<CaseEvidenceTab caseId="case-1" />);
    await screen.findByTestId('evidence-row-ev-1');

    fireEvent.click(screen.getByTestId('delete-evidence-ev-1'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('soft deletes when the user confirms', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CaseEvidenceTab caseId="case-1" />);
    await screen.findByTestId('evidence-row-ev-1');

    fireEvent.click(screen.getByTestId('delete-evidence-ev-1'));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('/evidences/ev-1'));
    confirmSpy.mockRestore();
  });
});
