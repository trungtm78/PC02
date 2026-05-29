import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { UploadStorageService } from './upload-storage.service';
import { computeSha256 } from './hostile-xlsx-guard';

describe('UploadStorageService', () => {
  let tmpDir: string;
  let service: UploadStorageService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pc02-xlsx-storage-'));
    process.env.XLSX_IMPORT_STORAGE_DIR = tmpDir;
    service = new UploadStorageService();
  });

  afterEach(() => {
    delete process.env.XLSX_IMPORT_STORAGE_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('persists a buffer keyed by sha', async () => {
    const buf = Buffer.from('hello xlsx world');
    const sha = computeSha256(buf);
    const target = await service.writeImmutable(sha, buf);
    expect(fs.existsSync(target)).toBe(true);
    expect(target.endsWith(`${sha}.xlsx`)).toBe(true);
    expect(fs.readFileSync(target)).toEqual(buf);
  });

  it('exists() returns true after write, false before', async () => {
    const buf = Buffer.from('a');
    const sha = computeSha256(buf);
    expect(service.exists(sha)).toBe(false);
    await service.writeImmutable(sha, buf);
    expect(service.exists(sha)).toBe(true);
  });

  it('is idempotent — second writeImmutable with same content is a no-op', async () => {
    const buf = Buffer.from('identical content');
    const sha = computeSha256(buf);
    const target1 = await service.writeImmutable(sha, buf);
    const stat1 = fs.statSync(target1);
    // Sleep tiny bit to ensure mtime would differ if rewritten
    await new Promise((r) => setTimeout(r, 10));
    const target2 = await service.writeImmutable(sha, buf);
    const stat2 = fs.statSync(target2);
    expect(target1).toBe(target2);
    expect(stat2.mtimeMs).toBe(stat1.mtimeMs); // not rewritten
  });

  it('rejects path-traversal-shaped fake SHAs', () => {
    expect(() => service.resolvePathFromSha('../../../etc/passwd')).toThrow(/Invalid SHA256/);
    expect(() => service.resolvePathFromSha('not-a-hex-sha')).toThrow(/Invalid SHA256/);
    expect(() => service.resolvePathFromSha('a'.repeat(63))).toThrow(/Invalid SHA256/); // wrong length
  });

  it('writes file read-only on POSIX', async () => {
    if (process.platform === 'win32') {
      // chmod 0o444 is best-effort on Windows; skip strict check
      return;
    }
    const buf = Buffer.from('readonly check');
    const sha = computeSha256(buf);
    const target = await service.writeImmutable(sha, buf);
    const mode = fs.statSync(target).mode & 0o777;
    expect(mode).toBe(0o444);
  });
});
