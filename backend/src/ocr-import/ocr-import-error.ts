import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stable wire codes for scan-image intake failures. The server sends the code, never display text: the UI
 * translates it, and a code can be tested for.
 */
export type OcrImportErrorCode =
  | 'OCR_SESSION_NOT_FOUND'
  | 'OCR_SESSION_CLOSED'
  | 'OCR_PAGE_DUPLICATE'
  | 'OCR_TOO_MANY_PAGES'
  | 'OCR_PAGE_NOT_FOUND'
  | 'OCR_PAGE_SET_MISMATCH'
  | 'OCR_FORBIDDEN'
  | 'OCR_FILE_MISSING'
  | 'OCR_ENTITY_MISMATCH'
  | 'OCR_ANALYSIS_NOT_FOUND'
  | 'OCR_NO_PAGES'
  | 'OCR_TRANSCRIPT_MISSING'
  | 'OCR_IMAGE_UNSUPPORTED'
  | 'OCR_IMAGE_TOO_LARGE'
  | 'OCR_IMAGE_UNREADABLE';

export class OcrImportError extends HttpException {
  constructor(
    readonly ocrCode: OcrImportErrorCode,
    status: HttpStatus,
    details: Record<string, unknown> = {},
  ) {
    super(
      {
        code: ocrCode,
        ...details,
        ...(Object.keys(details).length > 0 ? { details: [details] } : {}),
      },
      status,
    );
  }
}
