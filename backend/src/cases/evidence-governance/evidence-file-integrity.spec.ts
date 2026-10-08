import { mkdtemp, writeFile, rm, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { openEvidenceFile } from './evidence-file-integrity';

describe('CG11 original file integrity', () => {
  let root: string;
  const bytes = Buffer.from('synthetic immutable original');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pc02-evidence-'));
    await writeFile(join(root, 'original.bin'), bytes, { flag: 'wx' });
  });
  afterEach(async () => {
    // Only the resolved private directory created by this test is removed.
    if (!root.startsWith(join(tmpdir(), 'pc02-evidence-')))
      throw new Error('unsafe cleanup');
    await rm(root, { recursive: true, force: true });
  });
  it('streams exact hash and retains the verified handle for hydration', async () => {
    const file = await openEvidenceFile(root, 'original.bin', sha256);
    try {
      expect(file.sha256).toBe(sha256);
      expect(file.byteLength).toBe(bytes.length);
      const chunks: Buffer[] = [];
      for await (const chunk of file.handle.createReadStream({
        start: 0,
        autoClose: false,
      }))
        chunks.push(chunk as Buffer);
      expect(Buffer.concat(chunks)).toEqual(bytes);
    } finally {
      await file.handle.close();
    }
  });
  it('rejects a one-byte change', async () => {
    const altered = Buffer.from(bytes);
    altered[0] ^= 1;
    await writeFile(join(root, 'original.bin'), altered);
    await expect(
      openEvidenceFile(root, 'original.bin', sha256),
    ).rejects.toThrow('integrity');
  });
  it.each([
    '../outside.bin',
    '/absolute.bin',
    'C:\\outside.bin',
    'dir/original.bin',
    'dir\\original.bin',
    '',
  ])('rejects caller storage paths: %s', async (filename) => {
    await expect(openEvidenceFile(root, filename)).rejects.toThrow('filename');
  });
  it('rejects a directory as an original file', async () => {
    await mkdir(join(root, 'directory'));
    await expect(openEvidenceFile(root, 'directory')).rejects.toThrow(
      'regular file',
    );
  });
  it('rejects symlink originals without following them', async () => {
    await symlink(join(root, 'original.bin'), join(root, 'link.bin'));
    await expect(openEvidenceFile(root, 'link.bin')).rejects.toThrow(
      'symbolic',
    );
  });
});
