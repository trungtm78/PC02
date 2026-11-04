import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ api: { post, get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

import { ocrApi } from '../ocrApi';

describe('ocrApi.uploadPage', () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ data: { page: { id: 'p1' }, pageSetRevision: 1 } });
  });

  it('sends the scan as multipart form data under the field name the server reads', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'scan.jpg', { type: 'image/jpeg' });
    await ocrApi.uploadPage('s1', file);

    const [url, body, config] = post.mock.calls[0] as [string, FormData, { headers?: Record<string, string> }];
    expect(url).toBe('/ocr/sessions/s1/pages');
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('file') as File).name).toBe('scan.jpg');
    // The shared client defaults to JSON, which the server would read as "no file": the request must say multipart.
    expect(config?.headers?.['Content-Type']).toBe('multipart/form-data');
  });
});
