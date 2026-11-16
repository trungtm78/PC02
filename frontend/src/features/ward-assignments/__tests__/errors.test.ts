import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { explainWardError } from '../errors';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';

function axiosError(status: number, body: unknown): AxiosError {
  const headers = new AxiosHeaders();
  return new AxiosError('x', 'ERR', { headers }, null, { status, statusText: '', headers, config: { headers }, data: body });
}

describe('explainWardError', () => {
  it('words a code of the contract and marks a change made meanwhile as a conflict', () => {
    const e = explainWardError(axiosError(409, { error: { code: 'WARD_ASSIGNMENT_CHANGED', details: [] } }));
    expect(e.code).toBe('WARD_ASSIGNMENT_CHANGED');
    expect(e.conflict).toBe(true);
    expect(e.message).toBe(L.errors.WARD_ASSIGNMENT_CHANGED);
  });

  it('lists the fields an incomplete request still lacks, by their labels', () => {
    const e = explainWardError(
      axiosError(400, { error: { code: 'WARD_ASSIGNMENT_INCOMPLETE', details: [{ field: 'summary' }, { field: 'proposedInvestigatorId' }] } }),
    );
    expect(e.conflict).toBe(false);
    expect(e.missing).toEqual([L.form.fields.summary, L.form.fields.proposedInvestigator]);
  });

  it('falls back to a general sentence for a code it does not know, never to the server text', () => {
    const e = explainWardError(axiosError(500, { error: { code: 'SOMETHING', message: 'Internal', details: [] } }));
    expect(e.message).toBe(L.unknownError);
  });

  it('says the network is down when there was no answer', () => {
    const err = new AxiosError('Network Error', 'ERR_NETWORK');
    expect(explainWardError(err).message).toBe(L.networkError);
  });

  it('every code of the backend module has a sentence (no code reaches the person untranslated)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
    const src = readFileSync(resolve(root, 'backend/src/ward-assignments/ward-assignment.codes.ts'), 'utf8');
    const block = src.slice(src.indexOf('WARD_ERROR'), src.indexOf('} as const'));
    const codes = [...block.matchAll(/:\s*'([A-Z_]+)'/g)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(20);
    expect(codes.filter((c) => !L.errors[c])).toEqual([]);
  });
});
