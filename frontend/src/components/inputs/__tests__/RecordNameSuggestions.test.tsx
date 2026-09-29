import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordNameSuggestions } from '../RecordNameSuggestions';

const get = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...args: unknown[]) => get(...args) } }));

function Controlled({ kind }: { kind: 'incident' | 'delegation' }) {
  const [value, setValue] = useState('');
  return <RecordNameSuggestions kind={kind} value={value} onChange={setValue} testId="record-name" />;
}

describe('RecordNameSuggestions', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: [{ name: 'Trần Văn An', count: 3 }] });
  });

  it('uses the incident endpoint and leaves a newly typed name editable', async () => {
    render(<Controlled kind="incident" />);
    fireEvent.change(screen.getByTestId('record-name'), { target: { value: 'new name' } });
    expect(screen.getByTestId('record-name')).toHaveValue('new name');
    await waitFor(() => expect(get).toHaveBeenCalledWith('/incidents/name-suggestions', { params: { q: 'new name' } }));
  });

  it('isolates delegation suggestions by server case type', async () => {
    render(<Controlled kind="delegation" />);
    fireEvent.change(screen.getByTestId('record-name'), { target: { value: 'tran' } });
    await waitFor(() => expect(get).toHaveBeenCalledWith('/cases/name-suggestions', {
      params: { q: 'tran', caseType: 'UY_THAC_DIEU_TRA' },
    }));
    expect(await screen.findByText('Trần Văn An')).toBeInTheDocument();
  });
});
