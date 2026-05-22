/**
 * SHA256 checksum verification for signed dataset files.
 * v0.34.0.0: Used by seedAdminUnits to verify v2024-1279.json + .sha256 match.
 * Fail-loud: throws on missing file, missing checksum, or mismatch.
 */

import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';

export class ChecksumMismatchError extends Error {
  constructor(filePath: string, expected: string, actual: string) {
    super(
      `Checksum mismatch for ${filePath}\n` +
        `  Expected: ${expected}\n` +
        `  Actual:   ${actual}`,
    );
    this.name = 'ChecksumMismatchError';
  }
}

export class ChecksumFileMissingError extends Error {
  constructor(path: string) {
    super(`Required file not found: ${path}`);
    this.name = 'ChecksumFileMissingError';
  }
}

/**
 * Verify file checksum matches expected SHA256 in companion .sha256 file.
 * @throws ChecksumFileMissingError if either file is missing
 * @throws ChecksumMismatchError if checksums differ
 */
export function verifyChecksum(filePath: string, checksumPath: string): void {
  if (!existsSync(filePath)) {
    throw new ChecksumFileMissingError(filePath);
  }
  if (!existsSync(checksumPath)) {
    throw new ChecksumFileMissingError(checksumPath);
  }

  const content = readFileSync(filePath);
  const expected = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
  const actual = createHash('sha256').update(content).digest('hex');

  if (actual !== expected) {
    throw new ChecksumMismatchError(filePath, expected, actual);
  }
}

/**
 * Compute SHA256 hex of file contents.
 */
export function computeChecksum(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}
