import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import { listTemplates, createTemplate } from '../api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
const mGet = vi.mocked(api.get);
const mPost = vi.mocked(api.post);

beforeEach(() => {
  mGet.mockReset();
  mPost.mockReset();
});

describe('document-templates api', () => {
  it('listTemplates: GET với query entityType (bỏ key undefined) + trả res.data trực tiếp', async () => {
    // [codex P1] controller trả array trực tiếp (không envelope {success,data}) như document-numbers.
    mGet.mockResolvedValue({ data: [{ id: 't1' }] } as never);
    const r = await listTemplates({ entityType: 'VU_AN' });
    expect(mGet).toHaveBeenCalledWith('/document-templates', { params: { entityType: 'VU_AN' } });
    expect(r).toEqual([{ id: 't1' }]);
  });

  it('createTemplate: POST multipart FormData', async () => {
    mPost.mockResolvedValue({ data: { id: 't1' } } as never);
    const fd = new FormData();
    await createTemplate(fd);
    expect(mPost).toHaveBeenCalledWith(
      '/document-templates',
      fd,
      expect.objectContaining({ headers: { 'Content-Type': 'multipart/form-data' } }),
    );
  });
});
