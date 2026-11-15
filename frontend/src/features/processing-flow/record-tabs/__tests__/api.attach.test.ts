import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ api: { post, get: vi.fn(), delete: vi.fn() } }));

import { processingRecordApi } from '../api';

beforeEach(() => post.mockReset());

/**
 * The shared client defaults to `Content-Type: application/json`; axios then serialises a FormData as `{"file":{}}` and
 * the server receives no file. The upload must say it is multipart (found by Codex: every upload from the screen failed).
 */
describe('attaching a file to a report', () => {
  it('sends the file as multipart form data, in the field `file`', async () => {
    post.mockResolvedValue({ data: { id: 'd1' } });
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });

    await processingRecordApi.attach('PETITION', 'r 1', 's1', 'rp1', file);

    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/processing/records/PETITION/r%201/steps/s1/reports/rp1/attachments');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBe(file);
    expect(config).toEqual({ headers: { 'Content-Type': 'multipart/form-data' } });
  });
});
