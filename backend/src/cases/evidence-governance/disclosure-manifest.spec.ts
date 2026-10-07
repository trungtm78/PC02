import { createHash } from 'node:crypto';
import { manifestHash, verifyDisclosureBundle } from './disclosure-manifest';

describe('CG12 offline verification against trusted exact approval', () => {
  const bytes = Buffer.from('synthetic approved redacted derivative');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const manifest = {
    schemaVersion: 1,
    packetId: 'packet-1',
    caseId: 'case-1',
    revision: 2,
    recipientId: 'recipient',
    recipientPolicy: { download: true, grantRevision: 3 },
    purpose: 'review',
    basis: 'synthetic authorization',
    expiresAt: '2026-10-07T00:00:00.000Z',
    items: [
      {
        assetVersionId: 'asset-1',
        documentId: 'doc-1',
        sha256,
        byteLength: bytes.length,
        redaction: { approved: true },
        lineage: {
          parentVersionId: 'original-1',
          parentSha256: 'a'.repeat(64),
          tool: 'local',
          toolVersion: '1',
          sourceHash: 'a'.repeat(64),
        },
      },
    ],
  };
  const bundle = () => ({
    manifest,
    manifestHash: manifestHash(manifest),
    files: [{ assetVersionId: 'asset-1', base64: bytes.toString('base64') }],
    notice: 'Downloaded copies cannot be recalled by online revocation.',
  });
  it('verifies original exported bytes and exact externally trusted approval hash', () => {
    const result = verifyDisclosureBundle(bundle(), manifestHash(manifest));
    expect(result).toEqual({
      valid: true,
      manifestHash: manifestHash(manifest),
      itemCount: 1,
    });
    expect(manifestHash(manifest)).toMatch(/^[a-f0-9]{64}$/);
  });
  it('rejects one-byte tamper even when manifest is unchanged', () => {
    const altered = Buffer.from(bytes);
    altered[0] ^= 1;
    const bad = {
      ...bundle(),
      files: [
        { assetVersionId: 'asset-1', base64: altered.toString('base64') },
      ],
    };
    expect(() => verifyDisclosureBundle(bad, manifestHash(manifest))).toThrow(
      'integrity',
    );
  });
  it.each([
    'recipientId',
    'purpose',
    'basis',
    'expiresAt',
    'revision',
    'recipientPolicy',
    'items',
  ])('rejects revised %s with stale trusted approval', (key) => {
    const changed = { ...manifest, [key]: key === 'revision' ? 3 : 'tampered' };
    expect(() =>
      verifyDisclosureBundle(
        { ...bundle(), manifest: changed, manifestHash: manifestHash(changed) },
        manifestHash(manifest),
      ),
    ).toThrow('approval');
  });
  it('rejects missing, extra and duplicate bytes', () => {
    for (const files of [
      [],
      [...bundle().files, ...bundle().files],
      [...bundle().files, { assetVersionId: 'hidden', base64: 'AA==' }],
    ]) {
      expect(() =>
        verifyDisclosureBundle({ ...bundle(), files }, manifestHash(manifest)),
      ).toThrow();
    }
  });
  it('requires trusted hash supplied by verifier rather than trusting bundle self-report', () => {
    expect(() => verifyDisclosureBundle(bundle(), '')).toThrow('trusted');
  });
});
