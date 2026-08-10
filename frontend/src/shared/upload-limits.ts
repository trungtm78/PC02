/**
 * What the upload endpoint actually accepts.
 *
 * The media tab advertised "MP3, MP4, AVI, WAV, MOV, WMV — tối đa 100MB" and
 * validated against exactly that. The endpoint accepts `video/mp4` and
 * `audio/mpeg` only, at 10MB (`documents.controller.ts`), so a 60MB .MOV
 * passed every check the browser made and was then rejected by multer — after
 * the upload. The screen was not describing the system; it was describing
 * something nobody had built.
 *
 * WIRE FORMAT: these mirror `MAX_FILE_SIZE` and `ALLOWED_MIME_TYPES` in
 * `backend/src/documents/documents.controller.ts`. `upload-limits.test.ts`
 * reads that file and fails if the two drift, so this cannot silently go stale
 * the way the copy did.
 */

/** 10MB, matching the multer limit. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MAX_UPLOAD_LABEL = '10MB';

/** Extensions the endpoint's MIME allowlist admits, for the `accept` attribute. */
export const ALLOWED_MEDIA_EXTENSIONS = ['mp3', 'mp4'] as const;

/** Human-readable, for the hint under the drop zone. */
export const ALLOWED_MEDIA_LABEL = 'MP3, MP4';

/** Every extension the document endpoint admits, not just the media ones. */
export const ALLOWED_DOCUMENT_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'mp4',
  'mp3',
  'txt',
] as const;

/** `accept` attribute value for a file input, e.g. ".mp3,.mp4". */
export function acceptAttr(extensions: readonly string[]): string {
  return extensions.map((e) => `.${e}`).join(',');
}
