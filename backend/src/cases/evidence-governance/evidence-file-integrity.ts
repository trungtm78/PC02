import type { FileHandle } from 'node:fs/promises';
import { lstat, open, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute } from 'node:path';
import { BadRequestException, ConflictException } from '@nestjs/common';

export interface VerifiedEvidenceFile {
  handle: FileHandle;
  sha256: string;
  byteLength: number;
}

export async function openEvidenceFile(
  root: string,
  filename: string,
  expectedHash?: string,
): Promise<VerifiedEvidenceFile> {
  if (
    typeof filename !== 'string' ||
    !filename ||
    filename === '.' ||
    filename === '..' ||
    /[\\/:]/.test(filename) ||
    filename.includes('\0')
  ) {
    throw new BadRequestException('Invalid server filename');
  }
  const realRoot = await realpath(root);
  const fullPath = resolve(realRoot, filename);
  const entry = await lstat(fullPath);
  if (entry.isSymbolicLink())
    throw new ConflictException('Evidence symbolic links are forbidden');
  if (!entry.isFile())
    throw new BadRequestException('Evidence must be a regular file');
  const resolved = await realpath(fullPath);
  const child = relative(realRoot, resolved);
  if (child.startsWith('..') || isAbsolute(child))
    throw new BadRequestException('Invalid server filename');
  const handle = await open(
    fullPath,
    constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const before = await handle.stat();
    if (!before.isFile())
      throw new BadRequestException('Evidence must be a regular file');
    if (before.dev !== entry.dev || before.ino !== entry.ino)
      throw new ConflictException('Evidence integrity changed while opening');
    const hash = createHash('sha256');
    let byteLength = 0;
    for await (const chunk of handle.createReadStream({
      start: 0,
      autoClose: false,
    })) {
      hash.update(chunk as Buffer);
      byteLength += (chunk as Buffer).length;
    }
    const after = await handle.stat();
    const sha256 = hash.digest('hex');
    if (
      before.size !== byteLength ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.ctimeMs !== before.ctimeMs ||
      (expectedHash !== undefined && sha256 !== expectedHash)
    ) {
      throw new ConflictException('Evidence integrity verification failed');
    }
    return { handle, sha256, byteLength };
  } catch (error) {
    await handle.close();
    throw error;
  }
}
