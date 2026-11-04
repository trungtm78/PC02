/**
 * The step a running reading job is on, shown to the officer while they wait. WIRE FORMAT: the browser compares these
 * strings, so never rename one without a migration for rows that may hold it.
 */
export const OCR_JOB_STAGE = {
  READING_PAGES: 'READING_PAGES',
  ANALYSING: 'ANALYSING',
} as const;

export type OcrJobStage = (typeof OCR_JOB_STAGE)[keyof typeof OCR_JOB_STAGE];
