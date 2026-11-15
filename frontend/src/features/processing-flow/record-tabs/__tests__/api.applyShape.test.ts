import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ api: { post, get: vi.fn() } }));

import { processingRecordApi } from '../api';
import { explainError } from '../../errors';

/** `apply` and `reapply` answer `{ outcome, flow }`, not the flow itself (the other writes answer the flow). */
const FLOW = { id: 'rf1', revision: 6, steps: [] };

beforeEach(() => post.mockReset());

describe('apply / reapply answer a wrapper, the tabs cache the flow inside it', () => {
  it('apply returns the flow of the wrapper', async () => {
    post.mockResolvedValue({ data: { outcome: 'APPLIED', flow: FLOW } });
    await expect(processingRecordApi.apply('PETITION', 'r1', { idempotencyKey: 'k' })).resolves.toBe(FLOW);
  });

  it('apply of a record that already has a flow returns that flow', async () => {
    post.mockResolvedValue({ data: { outcome: 'ALREADY_APPLIED', flow: FLOW } });
    await expect(processingRecordApi.apply('PETITION', 'r1')).resolves.toBe(FLOW);
  });

  it('reapply returns the flow of the wrapper', async () => {
    post.mockResolvedValue({ data: { outcome: 'APPLIED', flow: FLOW } });
    await expect(processingRecordApi.reapply('PETITION', 'r1', { expectedRevision: 5 })).resolves.toBe(FLOW);
  });

  it('an outcome with no flow (nothing fits, record finished) is a refusal, not a cached null', async () => {
    for (const outcome of ['NO_FLOW', 'RECORD_FINISHED', 'RECORD_GONE', 'NO_PUBLISHED_VERSION']) {
      post.mockResolvedValue({ data: { outcome, flow: null } });
      const failure = await processingRecordApi.apply('PETITION', 'r1').then(
        () => null,
        (err: unknown) => err,
      );
      expect(failure).not.toBeNull();
      const explained = explainError(failure);
      // A deterministic refusal: the same key must not be reused as if the write might have landed.
      expect(explained.status).toBe(409);
      expect(explained.message).not.toBe('');
    }
  });
});
