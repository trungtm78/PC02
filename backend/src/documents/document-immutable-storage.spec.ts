import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { Readable } from 'node:stream';
import type { Request } from 'express';
import { immutableDocumentStorage } from './document-immutable-storage';
describe('CG11 upload storage never overwrites an existing original', () => {
  let root: string;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'pc02-upload-exclusive-'));
  });
  afterEach(async () => {
    if (!root.startsWith(join(tmpdir(), 'pc02-upload-exclusive-')))
      throw new Error('unsafe cleanup');
    await rm(root, { recursive: true, force: true });
  });
  function upload(
    name: string,
    destination = root,
    input = Readable.from(Buffer.from('new synthetic bytes')),
  ) {
    return new Promise<{ filename?: string; size?: number; path?: string }>(
      (resolve, reject) => {
        const file = {
          originalname: 'synthetic.bin',
          stream: input,
        } as Express.Multer.File;
        immutableDocumentStorage(destination, () => name)._handleFile(
          {} as Request,
          file,
          (error, result) =>
            error
              ? reject(
                  error instanceof Error ? error : new Error(String(error)),
                )
              : resolve(result ?? {}),
        );
      },
    );
  }
  it('refuses even a server filename collision and preserves existing bytes', async () => {
    await writeFile(
      join(root, 'original.bin'),
      Buffer.from('existing immutable bytes'),
      { flag: 'wx' },
    );
    await expect(upload('original.bin')).rejects.toMatchObject({ status: 409 });
    expect(await readFile(join(root, 'original.bin'))).toEqual(
      Buffer.from('existing immutable bytes'),
    );
  });
  it('failed stream removes only its newly allocated partial upload', async () => {
    const input = new Readable({
      read() {
        this.destroy(new Error('Synthetic input failure'));
      },
    });
    await expect(upload('partial.bin', root, input)).rejects.toMatchObject({
      status: 400,
    });
    await expect(readFile(join(root, 'partial.bin'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
  it('storage initialization failure is a validated upload error', async () => {
    const blocked = join(root, 'not-a-directory');
    await writeFile(blocked, Buffer.from('retained marker'), { flag: 'wx' });
    await expect(upload('fresh.bin', blocked)).rejects.toMatchObject({
      status: 400,
    });
    expect(await readFile(blocked)).toEqual(Buffer.from('retained marker'));
  });
  it('Multer rollback removes an allocated upload but never accepts a caller path', async () => {
    await upload('rollback.bin');
    const remove = (name: string) =>
      new Promise<unknown>((resolve) =>
        immutableDocumentStorage(root)._removeFile(
          {} as Request,
          { filename: name } as Express.Multer.File,
          (error) => resolve(error),
        ),
      );
    expect(await remove('rollback.bin')).toBeNull();
    await expect(readFile(join(root, 'rollback.bin'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await upload('keep.bin');
    expect(await remove('../keep.bin')).toMatchObject({ status: 400 });
    expect(await readFile(join(root, 'keep.bin'))).toEqual(
      Buffer.from('new synthetic bytes'),
    );
  });
  it('writes a newly allocated server filename with exact size', async () => {
    const result = await upload('fresh.bin');
    expect(result.filename).toBe('fresh.bin');
    expect(result.size).toBe(19);
    expect(await readFile(join(root, 'fresh.bin'))).toEqual(
      Buffer.from('new synthetic bytes'),
    );
  });
  it('rejects unsafe generated storage names before any file write', async () => {
    await expect(upload('../outside.bin')).rejects.toMatchObject({
      status: 400,
    });
  });
});
