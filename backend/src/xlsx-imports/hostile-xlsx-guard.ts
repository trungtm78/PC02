/**
 * v0.47 PR5 — Hostile xlsx defense kit.
 *
 * Treat every uploaded workbook as adversarial. Synchronous validations run
 * BEFORE the parser touches the file, so a malicious upload cannot exhaust
 * memory, CPU, or the event loop. References:
 *   - Codex final review #67 (compress ratio + sheet/row/cell caps + timeout + MIME magic-byte)
 *   - OWASP CSV Injection cheatsheet (formula stripping handled in parser, not here)
 *   - CVE history for exceljs/xml2js XXE
 */

import * as ExcelJS from 'exceljs';
import * as crypto from 'crypto';

export class HostileXlsxError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'HostileXlsxError';
  }
}

// Hard caps — keep generous enough for real BCA reports (15 đơn vị × ~5k rows max)
// but tight enough to reject malicious payloads.
export const XLSX_LIMITS = {
  /** Max compressed file size accepted from upload. */
  MAX_COMPRESSED_BYTES: 50 * 1024 * 1024, // 50 MB
  /** Reject if any single member uncompresses to more than this. */
  MAX_UNCOMPRESSED_BYTES: 500 * 1024 * 1024, // 500 MB
  /** Reject if total uncompressed / compressed ratio exceeds this (zip bomb). */
  MAX_COMPRESSION_RATIO: 100,
  /** Max worksheets per workbook. */
  MAX_SHEET_COUNT: 20,
  /** Max data rows per sheet. */
  MAX_ROWS_PER_SHEET: 100_000,
  /** Max length of any single cell string value. */
  MAX_CELL_LENGTH: 32_000,
  /** Parser hard timeout (ms). */
  PARSER_TIMEOUT_MS: 30_000,
} as const;

/**
 * MIME magic-byte check. xlsx files are ZIP archives starting with PK\x03\x04
 * (local file header signature). Rejects renamed binaries (e.g. .exe with
 * .xlsx extension) before exceljs touches them. We deliberately do NOT use
 * file-type the npm package — v22 is ESM-only which breaks ts-jest and
 * downgrading creates supply-chain noise. The xlsx-as-zip check is exact
 * and 4 bytes; nothing else needed at this layer (exceljs verifies the
 * inner xl/* structure during parse).
 */
export async function assertMagicBytes(buffer: Buffer): Promise<void> {
  if (buffer.length < 4) {
    throw new HostileXlsxError(
      'File quá nhỏ — không phải xlsx hợp lệ.',
      'INVALID_MIME',
    );
  }
  // PK\x03\x04 — ZIP local file header. xlsx is a zip container.
  // We also accept PK\x05\x06 (empty archive EOCD) and PK\x07\x08 (spanned),
  // though exceljs will reject those during parse if they're not real xlsx.
  const sig = buffer.slice(0, 4);
  const isZipLocalHeader =
    sig[0] === 0x50 && sig[1] === 0x4b && (sig[2] === 0x03 || sig[2] === 0x05 || sig[2] === 0x07);
  if (!isZipLocalHeader) {
    const hex = sig.toString('hex');
    throw new HostileXlsxError(
      `File không phải xlsx hợp lệ (signature: 0x${hex}).`,
      'INVALID_MIME',
    );
  }
}

/**
 * Reject files larger than MAX_COMPRESSED_BYTES.
 */
export function assertCompressedSize(buffer: Buffer): void {
  if (buffer.byteLength > XLSX_LIMITS.MAX_COMPRESSED_BYTES) {
    throw new HostileXlsxError(
      `Kích thước file vượt giới hạn (${buffer.byteLength} > ${XLSX_LIMITS.MAX_COMPRESSED_BYTES} bytes).`,
      'FILE_TOO_LARGE',
    );
  }
}

/**
 * Zip-bomb defense. Walks the central directory and sums uncompressed sizes
 * WITHOUT actually decompressing. If the ratio exceeds MAX_COMPRESSION_RATIO
 * or any single member uncompresses past MAX_UNCOMPRESSED_BYTES, reject.
 *
 * Implementation note: we use Node's zlib only to *probe* sizes via the zip
 * central directory parser embedded in exceljs's dep tree (yauzl pattern).
 * Here we do a simpler byte-level scan of the End-of-Central-Directory record
 * which is enough to refuse the most obvious bombs without unpacking.
 */
export function assertNoZipBomb(buffer: Buffer): void {
  // Find End-of-Central-Directory (EOCD) signature: 0x06054b50
  const eocdSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  let eocdOffset = -1;
  // EOCD lives in the last 65557 bytes of the file (22-byte fixed record + up to 65535-byte comment)
  const scanStart = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= scanStart; i--) {
    if (buffer.slice(i, i + 4).equals(eocdSig)) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) {
    throw new HostileXlsxError(
      'File xlsx hỏng — không tìm thấy EOCD signature.',
      'CORRUPT_ZIP',
    );
  }
  // Central directory size + offset at EOCD+12 and EOCD+16
  const cdSize = buffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
  if (cdOffset + cdSize > buffer.length) {
    throw new HostileXlsxError(
      'File xlsx hỏng — central directory offset không hợp lệ.',
      'CORRUPT_ZIP',
    );
  }
  // Walk central directory entries. Each starts with 0x02014b50.
  const cdEntrySig = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  let totalUncompressed = 0;
  let pos = cdOffset;
  const cdEnd = cdOffset + cdSize;
  while (pos < cdEnd - 46) {
    if (!buffer.slice(pos, pos + 4).equals(cdEntrySig)) break;
    // Uncompressed size at offset +24 in CD entry header
    const uncompressedSize = buffer.readUInt32LE(pos + 24);
    const fileNameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    if (uncompressedSize > XLSX_LIMITS.MAX_UNCOMPRESSED_BYTES) {
      throw new HostileXlsxError(
        `Zip-bomb defense — single member uncompresses to ${uncompressedSize} bytes (cap ${XLSX_LIMITS.MAX_UNCOMPRESSED_BYTES}).`,
        'ZIP_BOMB_MEMBER',
      );
    }
    totalUncompressed += uncompressedSize;
    pos += 46 + fileNameLen + extraLen + commentLen;
  }
  if (totalUncompressed === 0) return; // empty zip — let exceljs reject
  const ratio = totalUncompressed / buffer.length;
  if (ratio > XLSX_LIMITS.MAX_COMPRESSION_RATIO) {
    throw new HostileXlsxError(
      `Zip-bomb defense — compression ratio ${ratio.toFixed(1)} exceeds cap ${XLSX_LIMITS.MAX_COMPRESSION_RATIO}.`,
      'ZIP_BOMB_RATIO',
    );
  }
}

/**
 * After parse, walk the workbook and enforce sheet/row/cell limits.
 * Caller must run this BEFORE iterating staging rows; an oversized workbook
 * can still load via exceljs (it streams), but we refuse to process it.
 */
export function assertWorkbookLimits(workbook: ExcelJS.Workbook): void {
  if (workbook.worksheets.length > XLSX_LIMITS.MAX_SHEET_COUNT) {
    throw new HostileXlsxError(
      `Số sheet vượt giới hạn (${workbook.worksheets.length} > ${XLSX_LIMITS.MAX_SHEET_COUNT}).`,
      'TOO_MANY_SHEETS',
    );
  }
  for (const sheet of workbook.worksheets) {
    if (sheet.rowCount > XLSX_LIMITS.MAX_ROWS_PER_SHEET) {
      throw new HostileXlsxError(
        `Sheet "${sheet.name}" có ${sheet.rowCount} dòng vượt giới hạn ${XLSX_LIMITS.MAX_ROWS_PER_SHEET}.`,
        'TOO_MANY_ROWS',
      );
    }
  }
}

/**
 * Cell-level length enforcement, applied during parser iteration.
 * Truncates rather than throwing so a single oversized comment doesn't
 * abort the entire import — the truncated row is flagged in staging.
 */
export function clampCellLength(value: unknown): { value: unknown; truncated: boolean } {
  if (typeof value !== 'string') return { value, truncated: false };
  if (value.length <= XLSX_LIMITS.MAX_CELL_LENGTH) return { value, truncated: false };
  return {
    value: value.slice(0, XLSX_LIMITS.MAX_CELL_LENGTH),
    truncated: true,
  };
}

/**
 * Wrap an async parser operation in a timeout. If the operation exceeds
 * PARSER_TIMEOUT_MS, reject with a HostileXlsxError AND signal the wrapped
 * operation to abort via the AbortSignal passed to its argument.
 *
 * PR5 review finding (cross-model P1): without the AbortSignal, the wrapped
 * op kept running after reject — including subsequent prisma createMany calls
 * — letting a 31-second crafted parser stage rows under a FAILED log. The
 * caller is now responsible for checking signal.aborted between sheet boundaries.
 */
export async function withParserTimeout<T>(
  op: (signal: AbortSignal) => Promise<T>,
  ms: number = XLSX_LIMITS.PARSER_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      controller.abort();
      reject(
        new HostileXlsxError(
          `Parser timeout (${ms}ms exceeded).`,
          'PARSER_TIMEOUT',
        ),
      );
    }, ms);
    timer.unref?.();
    op(controller.signal).then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Throw an abort error if the given signal is aborted.
 * Use between long-running parser segments to short-circuit cleanly.
 */
export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new HostileXlsxError(
      'Parser aborted (timeout fired or caller cancelled).',
      'PARSER_ABORTED',
    );
  }
}

/**
 * Strip formula triggers from a cell value. Unlike escapeXlsxCell (PR4 export
 * defense), this is for IMPORT — we don't want to round-trip the apostrophe
 * into staging. Instead we coerce to literal text by removing the leading
 * trigger character entirely (and prepending nothing). Codex CRITICAL #4 #68.
 *
 * Whitespace-bypass defense (PR5 review finding): we normalise leading
 * whitespace + zero-width / format characters BEFORE the trigger check so
 * a payload like " =cmd" or " =cmd" (LibreOffice/strict-Excel parsers
 * trim before evaluating) can't slip past. The leading whitespace itself
 * is also stripped from the staging value.
 */
const IMPORT_FORMULA_TRIGGER = /^[=+\-@\t\r]/;
// All Unicode whitespace + common zero-width / bidi format characters that
// downstream re-exporters (LibreOffice, csv pipelines) strip before formula
// evaluation. Includes ASCII space/LF/VT/FF, NBSP, ZWSP, ZWNJ, ZWJ, ZWNBSP,
// LRM/RLM/LRE/RLE/PDF/LRO/RLO.
const LEADING_INVISIBLE = /^[\s ​‌‍⁠﻿‎‏‪-‮]+/;
export function stripImportFormula(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  // Strip leading invisible chars first, then check for a formula trigger.
  // The returned value never carries leading invisibles either — keeps
  // staging payloads canonical for the PR6 dry-run preview.
  const trimmed = value.replace(LEADING_INVISIBLE, '');
  if (IMPORT_FORMULA_TRIGGER.test(trimmed)) {
    return trimmed.replace(IMPORT_FORMULA_TRIGGER, '');
  }
  // If we stripped invisibles but no trigger was present, return the
  // canonical (invisibles removed) form so behaviour is consistent.
  return trimmed.length === value.length ? value : trimmed;
}

/**
 * Compute SHA256 hex digest. Used for dedupe + immutable filename.
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
