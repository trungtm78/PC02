/**
 * Pure rules of the "File chính thức" panel of a closed period: which file is the current one, what each row offers,
 * and whether the list is still waiting for the server to finish making the file. No React, no network.
 */
import type { OfficialFileView } from './types';

/** The query key of a period's list of official files: the panel reads it, the page refreshes it after a closing. */
export const officialFilesKey = (periodId: string): string[] => ['dynamic-reports', 'official-files', periodId];

/** The name a download falls back to when the server sends none. */
export const OFFICIAL_FILE_FALLBACK_NAME = 'file-chinh-thuc.xlsx';

/** How often the list is asked again while the file is being made, and for how long. */
export const OFFICIAL_FILE_POLL_EVERY_MS = 3_000;
export const OFFICIAL_FILE_POLL_FOR_MS = 30_000;

export interface OfficialFileRow {
  file: OfficialFileView;
  /** The file in force: the newest READY one. */
  current: boolean;
  /** A file exists behind this row (everything but a failed making). */
  downloadable: boolean;
  /** "Tạo lại" is offered here: on the current file, and on a failure nothing newer has made good. */
  canRemake: boolean;
  /** Making it again replaces a good file, so the person is asked first. */
  remakeNeedsConfirm: boolean;
  /** No longer in force (replaced, or void because the period was reopened): drawn muted. */
  muted: boolean;
}

/** The file in force: the newest READY one (the server sends the list newest first). */
export function currentOfficialFile(files: readonly OfficialFileView[]): OfficialFileView | null {
  return files.find((f) => f.status === 'READY') ?? null;
}

/** The server has an answer for this closing: a file, or a failure. Until then the file is still being made. */
export function isOfficialFileSettled(files: readonly OfficialFileView[]): boolean {
  return files.some((f) => f.status === 'READY' || f.status === 'FAILED');
}

/**
 * The delay before the list is asked again, or false to stop asking: stop once the list could not be loaded (the
 * error line has its own retry), once there is a file or a failure, or once the waiting time is over.
 */
export function officialFilePollDelay(
  files: readonly OfficialFileView[] | undefined,
  waitingOver: boolean,
  everyMs: number = OFFICIAL_FILE_POLL_EVERY_MS,
): number | false {
  if (files === undefined || waitingOver) return false;
  return isOfficialFileSettled(files) ? false : everyMs;
}

/**
 * The rows as the panel lists them: the current file on top, then the rest newest first. A failed making offers
 * "Tạo lại" only while it is newer than the current file (an old failure a later making already made good is history).
 */
export function officialFileRows(files: readonly OfficialFileView[]): OfficialFileRow[] {
  const current = currentOfficialFile(files);
  const currentIndex = current ? files.indexOf(current) : files.length;
  const firstFailedIndex = files.findIndex((f) => f.status === 'FAILED');
  const rows = files.map((file, index): OfficialFileRow => {
    const isCurrent = file === current;
    const liveFailure = file.status === 'FAILED' && index === firstFailedIndex && index < currentIndex;
    return {
      file,
      current: isCurrent,
      downloadable: file.status !== 'FAILED',
      canRemake: isCurrent || liveFailure,
      remakeNeedsConfirm: isCurrent,
      muted: file.status === 'SUPERSEDED' || file.status === 'VOID',
    };
  });
  return [...rows.filter((r) => r.current), ...rows.filter((r) => !r.current)];
}
