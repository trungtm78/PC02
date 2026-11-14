import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '@/lib/api';
import { customReportPreviewKey, reportViewsApi } from '../api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

describe('reportViewsApi', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.post).mockResolvedValue({ data: { id: 'v1' } });
  });

  it('archive sends the revision the screen holds in the body', async () => {
    await reportViewsApi.archive('v1', 4);
    expect(api.post).toHaveBeenCalledWith('/bao-cao-dong/views/v1/archive', { expectedRevision: 4 });
  });

  it('restore sends the revision the screen holds in the body', async () => {
    await reportViewsApi.restore('v1', 7);
    expect(api.post).toHaveBeenCalledWith('/bao-cao-dong/views/v1/restore', { expectedRevision: 7 });
  });

  it('the preview of an open period and that of a closed one are two different answers', () => {
    expect(customReportPreviewKey('p1', 'OPEN', 'r')).not.toEqual(customReportPreviewKey('p1', 'FINALIZED', 'r'));
  });
});
