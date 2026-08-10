/**
 * D2 / ND-16. The suspect, victim and witness screens only listed. `POST
 * /subjects` existed and the only way to reach it was the case form, so an
 * officer who needed to add a witness to a file already opened had nowhere to
 * do it.
 *
 * The case picker is a picker, not an id box, on purpose: the backend refuses a
 * `caseId` outside the caller's team (ND-18), so typing another unit's id ends
 * in a 403 after the whole form has been filled in. Offering only cases the
 * user can read moves that refusal to before the typing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const auth = vi.hoisted(() => ({
  granted: [
    { action: 'read', subject: 'Subject' },
    { action: 'write', subject: 'Subject' },
  ] as { action: string; subject: string }[],
}));

vi.mock('@/stores/auth.store', () => ({
  authStore: {
    getUser: vi.fn(() => ({ email: 'o@t.local', role: 'OFFICER', permissions: auth.granted })),
    getProfileRaw: vi.fn(() => null),
    onTokenChanged: vi.fn(() => () => {}),
  },
}));

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));

import { api } from '@/lib/api';
import { SubjectCreatePage } from '../SubjectCreatePage';

const CASE = { id: 'c-1', caseCode: 'VA-2026-00001', name: 'Vụ án thử nghiệm' };

beforeEach(() => {
  vi.clearAllMocks();
  auth.granted = [
    { action: 'read', subject: 'Subject' },
    { action: 'write', subject: 'Subject' },
  ];
  vi.mocked(api.get).mockResolvedValue({ data: { data: [CASE] } });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
});

function renderPage(type = 'WITNESS') {
  return render(
    <MemoryRouter>
      <SubjectCreatePage subjectType={type} />
    </MemoryRouter>,
  );
}

async function fillValid() {
  fireEvent.focus(screen.getByTestId('case-search'));
  fireEvent.click(await screen.findByTestId('case-option-c-1'));
  fireEvent.change(screen.getByTestId('field-fullName'), { target: { value: 'Nguyễn Văn C' } });
  fireEvent.change(screen.getByTestId('field-dateOfBirth'), { target: { value: '1990-05-12' } });
  fireEvent.change(screen.getByTestId('field-idNumber'), { target: { value: '079090001234' } });
  fireEvent.change(screen.getByTestId('field-address'), { target: { value: 'Số 5 Lê Lợi' } });
}

describe('SubjectCreatePage', () => {
  it('creates the subject against the chosen case', async () => {
    renderPage('WITNESS');
    await fillValid();
    fireEvent.click(screen.getByTestId('btn-save-subject'));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/subjects', {
        fullName: 'Nguyễn Văn C',
        dateOfBirth: '1990-05-12',
        gender: 'MALE',
        idNumber: '079090001234',
        address: 'Số 5 Lê Lợi',
        phone: undefined,
        caseId: 'c-1',
        type: 'WITNESS',
      }),
    );
  });

  it('will not save without a case', async () => {
    // Every subject belongs to a case. A subject with no parent has no scope,
    // which means nobody can see it and nobody owns it.
    renderPage();
    fireEvent.change(screen.getByTestId('field-fullName'), { target: { value: 'Nguyễn Văn C' } });
    fireEvent.change(screen.getByTestId('field-dateOfBirth'), { target: { value: '1990-05-12' } });
    fireEvent.change(screen.getByTestId('field-idNumber'), { target: { value: '079090001234' } });
    fireEvent.change(screen.getByTestId('field-address'), { target: { value: 'Số 5 Lê Lợi' } });

    expect(screen.getByTestId('btn-save-subject')).toBeDisabled();
  });

  it('rejects an id number that is not 9 or 12 digits', async () => {
    // The backend enforces this too; catching it here saves a round trip and
    // an error the user reads after the fact.
    renderPage();
    await fillValid();
    fireEvent.change(screen.getByTestId('field-idNumber'), { target: { value: '12345' } });

    expect(screen.getByTestId('btn-save-subject')).toBeDisabled();
  });

  it('offers only cases the user can read', async () => {
    renderPage();
    fireEvent.focus(screen.getByTestId('case-search'));
    await screen.findByTestId('case-option-c-1');

    const urls = vi.mocked(api.get).mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => u.startsWith('/cases'))).toBe(true);
  });

  it('says the empty picker means scope, not an empty system', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
    renderPage();
    fireEvent.focus(screen.getByTestId('case-search'));

    expect(await screen.findByTestId('case-empty')).toHaveTextContent('phạm vi của bạn');
  });

  it('reports a failed save and does not navigate away', async () => {
    vi.mocked(api.post).mockRejectedValue(
      Object.assign(new Error('boom'), {
        isAxiosError: true,
        response: { status: 403, data: { error: { message: 'Vụ án ngoài phạm vi', details: [] } } },
      }),
    );
    renderPage();
    await fillValid();
    fireEvent.click(screen.getByTestId('btn-save-subject'));

    expect(await screen.findByTestId('submit-error')).toHaveTextContent('ngoài phạm vi');
    expect(screen.getByTestId('subject-create-page')).toBeInTheDocument();
  });

  it('refuses the screen to someone who may not create', async () => {
    auth.granted = [{ action: 'read', subject: 'Subject' }];
    renderPage();

    expect(screen.getByTestId('subject-create-denied')).toBeInTheDocument();
  });
});
