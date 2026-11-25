/**
 * Machine codes of the "wards in charge" part of the team screen. The server never sends a sentence: the screen
 * translates these (frontend/src/locales/teams.vi.ts, `wardCharges.errors` / `wardCharges.import.issues`).
 */
export const WARD_CHARGE_ERROR = {
  /** 409: one or more wards are in charge of ANOTHER team; `details` lists every one ({ wardId, wardName, teamId, teamName }). */
  ALREADY_CHARGED: 'TEAM_WARD_ALREADY_CHARGED',
  /** 400: an id that is not a ward of the directory, or not an active one; `details` lists the ids. */
  WARD_INVALID: 'TEAM_WARD_INVALID',
  /** 400: the body is not `{ wardIds: string[] }`. */
  BODY_INVALID: 'TEAM_WARD_BODY_INVALID',
  /** 409: only an ACTIVE team that is not a ward unit (wardId = null) can be in charge of wards. */
  MANAGER_INVALID: 'TEAM_WARD_MANAGER_INVALID',
  /** 409: the team is in charge of wards; it cannot be archived (or become a ward unit) before they are removed. */
  HAS_CHARGES: 'TEAM_HAS_WARD_CHARGES',
  /** 400: the upload is missing, too large, not an xlsx, or does not have the template's layout. */
  IMPORT_FILE_INVALID: 'TEAM_WARD_IMPORT_FILE_INVALID',
  /** 404: the preview token is unknown, expired, or belongs to another person. */
  IMPORT_TOKEN_INVALID: 'TEAM_WARD_IMPORT_TOKEN_INVALID',
  /** 409: the preview has errors; nothing is written. */
  IMPORT_HAS_ERRORS: 'TEAM_WARD_IMPORT_HAS_ERRORS',
} as const;

/** Per-row findings of an import preview. Errors block the confirm; warnings do not. */
export const WARD_CHARGE_IMPORT_ISSUE = {
  TEAM_NOT_FOUND: 'TEAM_NOT_FOUND',
  TEAM_NOT_MANAGER: 'TEAM_NOT_MANAGER',
  TEAM_TWICE: 'TEAM_TWICE',
  WARD_NOT_FOUND: 'WARD_NOT_FOUND',
  WARD_TWICE: 'WARD_TWICE',
  WARD_CHARGED_OUTSIDE_FILE: 'WARD_CHARGED_OUTSIDE_FILE',
  COUNT_MISMATCH: 'COUNT_MISMATCH',
} as const;

export const WARD_CHARGE_AUDIT = {
  REPLACED: 'TEAM_WARD_CHARGES_REPLACED',
  IMPORTED: 'TEAM_WARD_CHARGES_IMPORTED',
} as const;

/** The province whose wards the import file names (the directory's PROVINCE code). */
export const WARD_CHARGE_PROVINCE_CODE = 'HCM';

/** The ward team level on the team screen ("Phường/Xã"). */
export const WARD_TEAM_LEVEL = 2;

/** Upload cap of the import: the real file is 12 rows (about 10 KB). */
export const WARD_CHARGE_IMPORT_MAX_BYTES = 1024 * 1024;

/** How long a preview may wait for its confirm. */
export const WARD_CHARGE_PREVIEW_TTL_MS = 30 * 60 * 1000;

/** The header of the template, column by column (the real file's column B has a trailing space). */
export const WARD_CHARGE_IMPORT_HEADERS = ['STT', 'Đơn vị thuộc PC02', 'Công an cấp phường/xã tương ứng', 'Số lượng phường/xã'] as const;
