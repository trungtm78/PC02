import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { OcrImportError } from '../ocr-import-error';

export interface ImageStorageOptions {
  rootDir?: string;
  maxBytes?: number;
}

export interface StoredOriginal {
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  /** Relative to the storage root. */
  originalPath: string;
}

export interface DerivedImage {
  buffer: Buffer;
  mediaType: 'image/jpeg';
  widthPx: number;
  heightPx: number;
  /** What was done to the original, recorded so the derived copy can always be reproduced from it. */
  transforms: string;
}

/** Long edge of the copy sent to a provider: enough to read small handwriting, small enough to keep the cost down. */
const MAX_EDGE_PX = 2500;
const JPEG_QUALITY = 85;
/** Refuse images that would need an enormous amount of memory to decode (a "decompression bomb"). */
const MAX_PIXELS = 100_000_000;
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

const EXTENSION: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Identifies JPEG, PNG and WebP by their magic bytes. Anything else, HEIC included, is not accepted. */
export function sniffImage(bytes: Buffer): { mimeType: string } | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { mimeType: 'image/jpeg' };
  }
  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mimeType: 'image/png' };
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return { mimeType: 'image/webp' };
  }
  return null;
}

/**
 * Keeps the scans.
 *
 * The ORIGINAL is stored byte for byte and never re-encoded: its hash is the evidence of what the officer uploaded,
 * and a re-read can always start again from it. The copy sent to a provider is DERIVED from it: rotated as the EXIF
 * says, shrunk, and stripped of every EXIF block (a phone photo carries the GPS position of where it was taken).
 * Paths are kept relative to the root and every access is checked to stay inside it.
 */
@Injectable()
export class ImageStorageService {
  private readonly root: string;
  private readonly maxBytes: number;

  constructor(@Optional() options?: ImageStorageOptions) {
    this.root = path.resolve(
      options?.rootDir ??
        process.env.OCR_UPLOAD_DIR ??
        path.join(process.cwd(), 'uploads', 'ocr'),
    );
    this.maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  }

  async saveOriginal(
    sessionId: string,
    bytes: Buffer,
  ): Promise<StoredOriginal> {
    if (!SAFE_SEGMENT.test(sessionId)) {
      throw new OcrImportError('OCR_SESSION_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (bytes.length > this.maxBytes) {
      throw new OcrImportError(
        'OCR_IMAGE_TOO_LARGE',
        HttpStatus.PAYLOAD_TOO_LARGE,
        {
          limitBytes: this.maxBytes,
        },
      );
    }
    const sniffed = sniffImage(bytes);
    if (!sniffed)
      throw new OcrImportError(
        'OCR_IMAGE_UNSUPPORTED',
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );

    let width: number | undefined;
    let height: number | undefined;
    try {
      ({ width, height } = await sharp(bytes, { failOn: 'error' }).metadata());
    } catch {
      throw new OcrImportError(
        'OCR_IMAGE_UNREADABLE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (!width || !height) {
      throw new OcrImportError(
        'OCR_IMAGE_UNREADABLE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (width * height > MAX_PIXELS) {
      throw new OcrImportError(
        'OCR_IMAGE_TOO_LARGE',
        HttpStatus.PAYLOAD_TOO_LARGE,
        {
          limitPixels: MAX_PIXELS,
        },
      );
    }

    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const relative = path.join(
      sessionId,
      `${sha256}.${EXTENSION[sniffed.mimeType]}`,
    );
    const absolute = this.resolve(relative);
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    try {
      // 'wx': never overwrite. Read-only afterwards: an original is not edited.
      await fs.promises.writeFile(absolute, bytes, { flag: 'wx', mode: 0o444 });
    } catch (error) {
      // The same bytes uploaded again are already stored: that is fine, and it is the same record.
      if ((error as { code?: string }).code !== 'EEXIST') throw error;
    }
    return {
      sha256,
      mimeType: sniffed.mimeType,
      sizeBytes: bytes.length,
      originalPath: relative,
    };
  }

  /** The copy to send to a provider. Never touches the stored original. */
  async deriveForProvider(original: Buffer): Promise<DerivedImage> {
    try {
      const { data, info } = await sharp(original, {
        failOn: 'error',
        limitInputPixels: MAX_PIXELS,
      })
        .rotate() // apply the EXIF orientation, so the model sees the page upright
        .resize({
          width: MAX_EDGE_PX,
          height: MAX_EDGE_PX,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' }) // JPEG has no transparency
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer({ resolveWithObject: true });
      // sharp writes no metadata unless asked to, so no EXIF (and no GPS) survives.
      return {
        buffer: data,
        mediaType: 'image/jpeg',
        widthPx: info.width,
        heightPx: info.height,
        transforms: `rotate(exif);resize(max ${MAX_EDGE_PX}px);flatten(white);jpeg(q${JPEG_QUALITY});strip-metadata`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/pixel limit/i.test(message)) {
        throw new OcrImportError(
          'OCR_IMAGE_TOO_LARGE',
          HttpStatus.PAYLOAD_TOO_LARGE,
          {
            limitPixels: MAX_PIXELS,
          },
        );
      }
      throw new OcrImportError(
        'OCR_IMAGE_UNREADABLE',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  async read(relativePath: string): Promise<Buffer> {
    const absolute = this.tryResolve(relativePath);
    if (!absolute)
      throw new OcrImportError('OCR_PAGE_NOT_FOUND', HttpStatus.NOT_FOUND);
    try {
      return await fs.promises.readFile(absolute);
    } catch {
      throw new OcrImportError('OCR_PAGE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
  }

  /** Writes a derived copy next to its original. Returns the relative path. */
  async saveDerived(
    sessionId: string,
    sha256: string,
    derived: DerivedImage,
  ): Promise<string> {
    if (!SAFE_SEGMENT.test(sessionId) || !SAFE_SEGMENT.test(sha256)) {
      throw new OcrImportError('OCR_PAGE_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    const relative = path.join(sessionId, `${sha256}.derived.jpg`);
    const absolute = this.resolve(relative);
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    await fs.promises.writeFile(absolute, derived.buffer);
    return relative;
  }

  /** Deletes files, skipping any already gone and any path that points outside the storage root. */
  async deleteFiles(relativePaths: readonly string[]): Promise<number> {
    let removed = 0;
    for (const relative of relativePaths) {
      const absolute = this.tryResolve(relative);
      if (!absolute) continue;
      try {
        await fs.promises.chmod(absolute, 0o666); // originals are read-only
        await fs.promises.unlink(absolute);
        removed += 1;
      } catch (error) {
        if ((error as { code?: string }).code !== 'ENOENT') throw error;
      }
    }
    return removed;
  }

  private tryResolve(relative: string): string | null {
    const absolute = path.resolve(this.root, relative);
    return absolute.startsWith(this.root + path.sep) ? absolute : null;
  }

  private resolve(relative: string): string {
    const absolute = this.tryResolve(relative);
    if (!absolute)
      throw new OcrImportError('OCR_PAGE_NOT_FOUND', HttpStatus.NOT_FOUND);
    return absolute;
  }
}
