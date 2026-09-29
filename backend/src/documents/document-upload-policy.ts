import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

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
