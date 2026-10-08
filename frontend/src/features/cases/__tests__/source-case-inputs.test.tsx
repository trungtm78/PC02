import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { ProsecuteModalProvider } from '@/features/_shared/modals/ProsecuteModalProvider';
import { useProsecuteModal } from '@/features/_shared/modals/ProsecuteModalContext';
import { ConvertPetitionModal } from '@/pages/petitions/ConvertPetitionModal';
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
const schema = { id: 'fields1', revision: 1, status: 'PUBLISHED', definition: { fields: [{ key: 'custom_confirmed', label: 'Xác nhận nguồn bổ sung', type: 'boolean', required: true }, { key: 'custom_count', label: 'Số lượng bổ sung', type: 'number', required: true }] }, values: {} };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.get).mockResolvedValue({ data: { data: schema } }); vi.mocked(api.post).mockResolvedValue({ data: { data: { case: { id: 'c1' } } } }); });
function OpenProsecute() { const modal = useProsecuteModal(); return <button onClick={() => modal.open({ recordId: 'i1', incidentName: 'Actual source', currentUpdatedAt: '2026-10-06T00:00:00Z' })}>Open prosecution</button>; }
it('supplies required typed fields and actual source version in Incident prosecution without coercing false/0', async () => {
  render(<ProsecuteModalProvider><OpenProsecute /></ProsecuteModalProvider>); fireEvent.click(screen.getByRole('button', { name: 'Open prosecution' })); fireEvent.change(screen.getByTestId('field-prosecution-decision'), { target: { value: 'Decision 1' } });
  await screen.findByLabelText('Xác nhận nguồn bổ sung'); fireEvent.click(screen.getByTestId('btn-confirm-prosecute')); expect(api.post).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Xác nhận nguồn bổ sung'), { target: { value: 'false' } }); fireEvent.change(screen.getByLabelText('Số lượng bổ sung'), { target: { value: '0' } }); fireEvent.click(screen.getByTestId('btn-confirm-prosecute'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/incidents/i1/prosecute', expect.objectContaining({ expectedUpdatedAt: '2026-10-06T00:00:00Z', caseCustomFields: { custom_confirmed: false, custom_count: 0 } })));
});
it('supplies the same required schema inputs during Petition to Case conversion', async () => {
  const submit = vi.fn().mockResolvedValue(undefined); render(<ConvertPetitionModal petitionUpdatedAt="2026-10-06T00:00:00Z" onClose={() => {}} onSubmitIncident={vi.fn()} onSubmitCase={submit} />); fireEvent.click(screen.getByTestId('convert-option-case'));
  fireEvent.change(screen.getByTestId('convert-case-name'), { target: { value: 'Actual case' } }); fireEvent.change(screen.getByTestId('convert-case-crime'), { target: { value: 'Verified crime' } }); fireEvent.change(screen.getByTestId('convert-case-jurisdiction'), { target: { value: 'Verified authority' } }); await screen.findByLabelText('Xác nhận nguồn bổ sung'); fireEvent.click(screen.getByTestId('convert-submit')); expect(submit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Xác nhận nguồn bổ sung'), { target: { value: 'false' } }); fireEvent.change(screen.getByLabelText('Số lượng bổ sung'), { target: { value: '0' } }); fireEvent.click(screen.getByTestId('convert-submit'));
  await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ expectedUpdatedAt: '2026-10-06T00:00:00Z', caseCustomFields: { custom_confirmed: false, custom_count: 0 } })));
});
