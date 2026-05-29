/**
 * v0.47 PR5 — Immutable raw upload storage.
 *
 * Every uploaded xlsx lives forever (legal retention) keyed by SHA256.
 * Files are written read-only (0o444) so a compromised app cannot tamper
 * with audit evidence. Identical content uploaded twice maps to a single
 * file and a single XlsxImportLog row (idempotency).
 *
 * Storage layout: uploads/xlsx-imports/{sha256}.xlsx
 * Override via XLSX_IMPORT_STORAGE_DIR env for tests.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadStorageService {
  private readonly logger = new Logger(UploadStorageService.name);
  private readonly storageDir: string;

  constructor() {
    const override = process.env.XLSX_IMPORT_STORAGE_DIR;
    if (override && override.length > 0) {
      this.storageDir = override;
    } else {
      this.storageDir = path.join(process.cwd(), 'uploads', 'xlsx-imports');
    }
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  /**
   * Returns the canonical path for a SHA — used both for idempotency
   * lookup and as the storage target.
   */
  resolvePathFromSha(sha: string): string {
    // SHA is hex-validated upstream (computeSha256 returns 64-char hex).
    // We keep an extra guard here in case of misuse — file system writes
    // with arbitrary input should never be reachable.
    if (!/^[0-9a-f]{64}$/.test(sha)) {
      throw new Error(`Invalid SHA256 (must be 64-char hex): ${sha}`);
    }
    return path.join(this.storageDir, `${sha}.xlsx`);
  }

  /**
   * Idempotency check.
   */
  exists(sha: string): boolean {
    return fs.existsSync(this.resolvePathFromSha(sha));
  }

  /**
   * Persist a buffer atomically with read-only permissions.
   * If a file already exists at the target SHA, this is a no-op
   * (identical content — SHA is a content fingerprint).
   */
  async writeImmutable(sha: string, buffer: Buffer): Promise<string> {
    const target = this.resolvePathFromSha(sha);
    if (fs.existsSync(target)) {
      this.logger.debug(`xlsx import dedupe hit — sha=${sha.slice(0, 12)}…`);
      return target;
    }
    // Write to a tmp neighbour then rename — atomic on POSIX, best-effort
    // on Windows (fs.rename overwrites if target appeared mid-write, which
    // is fine because content is identical by SHA).
    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    await fs.promises.writeFile(tmp, buffer);
    await fs.promises.rename(tmp, target);
    try {
      await fs.promises.chmod(target, 0o444);
    } catch (err) {
      // chmod on Windows is best-effort; do not fail the upload.
      this.logger.warn(
        `chmod 0o444 failed on ${target} — file is still persisted (Windows POSIX semantics).`,
      );
    }
    return target;
  }
}
