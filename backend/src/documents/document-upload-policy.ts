import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import * as fs from 'fs';
import * as path from 'path';
import { immutableDocumentStorage } from './document-immutable-storage';

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, readonly string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.txt': ['text/plain'],
  '.mp3': ['audio/mpeg'],
  '.wav': ['audio/wav', 'audio/vnd.wave', 'audio/x-wav'],
  '.mp4': ['video/mp4'],
  '.avi': ['video/x-msvideo', 'video/vnd.avi'],
  '.mov': ['video/quicktime'],
  '.wmv': ['video/x-ms-wmv', 'video/x-ms-asf'],
};

export const ALLOWED_UPLOAD_MIMES = new Set(
  Object.values(MIME_BY_EXTENSION).flat(),
);

export function validateUploadedDocument(
  file: { originalname: string; mimetype: string; size: number },
  detectedMime: string | undefined,
  documentType: string | undefined,
): void {
  const extension = path.extname(file.originalname).toLowerCase();
  const accepted = MIME_BY_EXTENSION[extension];
  if (!accepted?.includes(file.mimetype)) {
    throw new BadRequestException(
      'Định dạng file không khớp với tên hoặc Content-Type',
    );
  }
  if (
    file.mimetype !== 'text/plain' &&
    !accepted.includes(detectedMime ?? '')
  ) {
    throw new BadRequestException(
      'Nội dung file không khớp định dạng khai báo',
    );
  }
  const mediaKind = file.mimetype.startsWith('audio/')
    ? 'AM_THANH'
    : file.mimetype.startsWith('video/')
      ? 'VIDEO'
      : null;
  if (
    mediaKind &&
    ['AM_THANH', 'VIDEO'].includes(documentType ?? '') &&
    documentType !== mediaKind
  ) {
    throw new BadRequestException(
      'Loại tài liệu không khớp nội dung ghi âm hoặc ghi hình',
    );
  }
  const limit =
    mediaKind && documentType === mediaKind
      ? MAX_MEDIA_BYTES
      : MAX_DOCUMENT_BYTES;
  if (file.size > limit) {
    throw new BadRequestException('Dung lượng file vượt giới hạn');
  }
}

// file-type cannot detect text/plain (no magic bytes): it passes on the Content-Type whitelist and the extension.
const MAGIC_BYTE_BYPASS = new Set(['text/plain']);

/**
 * How EVERY route that takes a document receives the file (the documents module and the attachments of a step report):
 * the immutable storage, the size ceiling, the Content-Type whitelist.
 */
export function documentUploadOptions(): MulterOptions {
  return {
    storage: immutableDocumentStorage(),
    limits: { fileSize: MAX_MEDIA_BYTES },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_UPLOAD_MIMES.has(file.mimetype)) cb(null, true);
      else cb(new BadRequestException('Loại file không được hỗ trợ'), false);
    },
  };
}

/**
 * The ONE check of a file multer has written, for every upload route: a file is there, its magic bytes agree with the
 * declared type (the Content-Type header is the sender's word), the extension, the type and the size limits hold.
 * A refused file is removed from the disk before the refusal is thrown.
 */
export async function assertUploadedDocument(
  file:
    | { path: string; originalname: string; mimetype: string; size: number }
    | undefined,
  documentType: string | undefined,
): Promise<void> {
  if (!file) throw new BadRequestException('File upload là bắt buộc');
  try {
    const detected = MAGIC_BYTE_BYPASS.has(file.mimetype)
      ? undefined
      : await (await import('file-type')).fileTypeFromFile(file.path);
    validateUploadedDocument(file, detected?.mime, documentType);
  } catch (error) {
    fs.rmSync(file.path, { force: true });
    throw error;
  }
}

/**
 * The name the person gave the file. The multipart parser reads a file name as latin1, so a name sent as UTF-8
 * ("Báo cáo.pdf") arrives as "BÃ¡o cÃ¡o.pdf". Read back as UTF-8 when that gives valid text; a name that was truly
 * latin1 (its bytes are not valid UTF-8), or one that already holds characters beyond latin1, is kept as it came.
 */
export function uploadedFileName(originalname: string): string {
  if ([...originalname].some((char) => char.charCodeAt(0) > 0xff)) return originalname;
  const decoded = Buffer.from(originalname, 'latin1').toString('utf8');
  return decoded.includes('�') ? originalname : decoded;
}
