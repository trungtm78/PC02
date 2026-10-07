import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '@/lib/api';
import { useCaseFieldSchema } from '../useCaseFieldSchema';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
describe('CG06 published case field schema transport', () => {
  beforeEach(() => vi.clearAllMocks());
  it('loads the server pinned published revision and authorized values from the existing envelope', async () => {
    const schema = { id: 'v1', revision: 1, status: 'PUBLISHED', definition: { fields: [{ key: 'custom_note', label: 'Note', type: 'text', required: false }] }, values: { custom_note: 'visible' } };
    vi.mocked(api.get).mockResolvedValue({ data: { data: schema } });
    const { result } = renderHook(() => useCaseFieldSchema('c1'));
    await waitFor(() => expect(result.current.schema).toEqual(schema));
    expect(api.get).toHaveBeenCalledWith('/cases/c1/governance/field-schema');
  });
  it('returns a useful load error and never renders an unpublished definition', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useCaseFieldSchema('c1'));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.schema).toBeNull();
  });
  it('loads the authorized published default for a new case', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: null } });
    const { result } = renderHook(() => useCaseFieldSchema());
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/cases/governance/field-schema'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.schema).toBeNull();
  });
  it('does not retain another case schema while navigation is loading', async () => {
    const schema = { id: 'v1', revision: 1, status: 'PUBLISHED', definition: { fields: [] }, values: { private: 'case1' } };
    vi.mocked(api.get).mockResolvedValueOnce({ data: { data: schema } }).mockReturnValueOnce(new Promise(() => {}));
    const { result, rerender } = renderHook(({ id }) => useCaseFieldSchema(id), { initialProps: { id: 'c1' } });
    await waitFor(() => expect(result.current.schema?.id).toBe('v1'));
    rerender({ id: 'c2' });
    expect(result.current.schema).toBeNull();
    expect(result.current.loading).toBe(true);
  });
  it('does not accept a draft or invalid response as an editable schema', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { data: { id: 'draft', status: 'DRAFT', definition: { fields: [] } } } });
    const { result } = renderHook(() => useCaseFieldSchema('c1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.schema).toBeNull();
  });
});
