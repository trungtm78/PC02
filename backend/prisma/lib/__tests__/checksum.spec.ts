import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { createHash } from 'crypto';
import {
  verifyChecksum,
  ChecksumMismatchError,
  ChecksumFileMissingError,
  computeChecksum,
} from '../checksum';

describe('checksum utility (v0.34.0.0)', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'pc02-checksum-test-'));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('verifyChecksum passes when SHA256 matches', () => {
    const content = 'hello world';
    const filePath = path.join(tmpDir, 'pass.txt');
    const shaPath = path.join(tmpDir, 'pass.txt.sha256');
    writeFileSync(filePath, content);
    const expected = createHash('sha256').update(content).digest('hex');
    writeFileSync(shaPath, expected);

    expect(() => verifyChecksum(filePath, shaPath)).not.toThrow();
  });

  it('verifyChecksum allows .sha256 file to have trailing newline + filename suffix', () => {
    const content = 'world';
    const filePath = path.join(tmpDir, 'suffix.txt');
    const shaPath = path.join(tmpDir, 'suffix.txt.sha256');
    writeFileSync(filePath, content);
    const expected = createHash('sha256').update(content).digest('hex');
    writeFileSync(shaPath, `${expected}  suffix.txt\n`);

    expect(() => verifyChecksum(filePath, shaPath)).not.toThrow();
  });

  it('verifyChecksum throws ChecksumMismatchError when SHA256 differs', () => {
    const filePath = path.join(tmpDir, 'mismatch.txt');
    const shaPath = path.join(tmpDir, 'mismatch.txt.sha256');
    writeFileSync(filePath, 'real content');
    writeFileSync(shaPath, '0'.repeat(64));

    expect(() => verifyChecksum(filePath, shaPath)).toThrow(ChecksumMismatchError);
  });

  it('verifyChecksum throws ChecksumFileMissingError when target file missing', () => {
    const filePath = path.join(tmpDir, 'missing.txt'); // does not exist
    const shaPath = path.join(tmpDir, 'missing.txt.sha256');
    writeFileSync(shaPath, '0'.repeat(64));

    expect(() => verifyChecksum(filePath, shaPath)).toThrow(ChecksumFileMissingError);
  });

  it('verifyChecksum throws ChecksumFileMissingError when .sha256 file missing', () => {
    const filePath = path.join(tmpDir, 'no-sha.txt');
    const shaPath = path.join(tmpDir, 'no-sha.txt.sha256'); // does not exist
    writeFileSync(filePath, 'data');

    expect(() => verifyChecksum(filePath, shaPath)).toThrow(ChecksumFileMissingError);
  });

  it('computeChecksum returns SHA256 hex matching crypto', () => {
    const content = Buffer.from('test content');
    const filePath = path.join(tmpDir, 'compute.txt');
    writeFileSync(filePath, content);

    const expected = createHash('sha256').update(content).digest('hex');
    expect(computeChecksum(filePath)).toBe(expected);
  });
});
