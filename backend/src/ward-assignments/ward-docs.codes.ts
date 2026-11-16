/**
 * Error codes of the result files and of the request slip of a ward assignment request. WIRE FORMAT: the screen
 * translates them (`frontend/src/locales/wardAssignmentDocs.vi.ts`); never rename without changing the screen in the
 * same change.
 */
export const WARD_DOCS_ERROR = {
  /** A result file can be added or removed only while the request is approved ("Đã duyệt"). */
  FILES_NOT_APPROVED: 'WARD_FILES_NOT_APPROVED',
  FILE_NOT_FOUND: 'WARD_FILE_NOT_FOUND',
  FILE_REQUIRED: 'WARD_FILE_REQUIRED',
  /** The type, the extension or the content of the file is not one the document store takes. */
  FILE_TYPE_REFUSED: 'WARD_FILE_TYPE_REFUSED',
  FILE_TOO_LARGE: 'WARD_FILE_TOO_LARGE',
  /** The request already holds as many files as the document store allows for one record. */
  FILES_TOO_MANY: 'WARD_FILES_TOO_MANY',
  /** The file is on record but its bytes are missing or changed on the disk. */
  FILE_UNAVAILABLE: 'WARD_FILE_UNAVAILABLE',
  /** An issued request slip is not a result file: it is never removed. */
  FILE_IS_SLIP: 'WARD_FILE_IS_SLIP',

  SLIP_DECISION_NOT_FOUND: 'WARD_SLIP_DECISION_NOT_FOUND',
  /** The decision was revoked: no slip is issued for it any more (its slip, if any, is kept). */
  SLIP_DECISION_REVOKED: 'WARD_SLIP_DECISION_REVOKED',
  SLIP_NOT_ISSUED: 'WARD_SLIP_NOT_ISSUED',
  /** The slip of this decision was issued already, with another number than the one asked for. */
  SLIP_ALREADY_ISSUED: 'WARD_SLIP_ALREADY_ISSUED',
  SLIP_NUMBER_INVALID: 'WARD_SLIP_NUMBER_INVALID',
  /** Another slip of the same year carries this number. */
  SLIP_NUMBER_TAKEN: 'WARD_SLIP_NUMBER_TAKEN',
  SLIP_REASON_REQUIRED: 'WARD_SLIP_REASON_REQUIRED',
  SLIP_SIGNER_TOO_LONG: 'WARD_SLIP_SIGNER_TOO_LONG',
  /** No active template of the request slip: an administrator must publish one. */
  SLIP_TEMPLATE_MISSING: 'WARD_SLIP_TEMPLATE_MISSING',
} as const;

/** Audit actions of this lane (metadata only: never the content of a file or of a slip). WIRE FORMAT. */
export const WARD_DOCS_AUDIT = {
  FILE_ADDED: 'WARD_FILE_ADDED',
  FILE_REMOVED: 'WARD_FILE_REMOVED',
  SLIP_ISSUED: 'WARD_SLIP_ISSUED',
  SLIP_REISSUED: 'WARD_SLIP_REISSUED',
} as const;

/** The number series of the request slips: `<n>/PYC-PC02-Đ1`, yearly. */
export const WARD_SLIP_NUMBER_SERIES = 'PHIEU_YEU_CAU';
/** What follows the number on every slip of the series. */
export const WARD_SLIP_NUMBER_SUFFIX = '/PYC-PC02-Đ1';
/** The template of the slip in the document template platform (entity type `HO_SO_PHAN_CONG`). */
export const WARD_SLIP_TEMPLATE_CODE = 'PHIEU_YEU_CAU';
