import { describe, expect, it } from 'vitest';
import {
  currentOfficialFile,
  isOfficialFileSettled,
  officialFilePollDelay,
  officialFileRows,
} from '../officialFile';
import type { OfficialFileStatus, OfficialFileView } from '../types';

function file(id: string, status: OfficialFileStatus, over: Partial<OfficialFileView> = {}): OfficialFileView {
  return {
    id,
    status,
    fileName: status === 'FAILED' ? null : `${id}.xlsx`,
    error: status === 'FAILED' ? 'boom' : null,
    createdAt: '2026-11-13T03:00:00.000Z',
    endedAt: null,
    ...over,
  };
}

describe('official file of a closed period — pure rules', () => {
  it('the current file is the newest READY one; none when nothing is ready', () => {
    const files = [file('f3', 'FAILED'), file('f2', 'READY'), file('f1', 'SUPERSEDED')];
    expect(currentOfficialFile(files)?.id).toBe('f2');
    expect(currentOfficialFile([file('f1', 'VOID')])).toBeNull();
    expect(currentOfficialFile([])).toBeNull();
  });

  it('the list is settled once it holds a file or a failure; old replaced or void files do not settle it', () => {
    expect(isOfficialFileSettled([])).toBe(false);
    expect(isOfficialFileSettled([file('f2', 'VOID'), file('f1', 'SUPERSEDED')])).toBe(false);
    expect(isOfficialFileSettled([file('f1', 'READY')])).toBe(true);
    expect(isOfficialFileSettled([file('f1', 'FAILED')])).toBe(true);
  });

  it('asks again only while nothing is settled, the waiting time is not over and the list did load', () => {
    expect(officialFilePollDelay([], false, 3000)).toBe(3000);
    expect(officialFilePollDelay([file('f1', 'VOID')], false, 3000)).toBe(3000);
    expect(officialFilePollDelay([file('f1', 'READY')], false, 3000)).toBe(false);
    expect(officialFilePollDelay([file('f1', 'FAILED')], false, 3000)).toBe(false);
    expect(officialFilePollDelay([], true, 3000)).toBe(false);
    // A list that could not be loaded is not "no file yet": no silent asking again behind the error line.
    expect(officialFilePollDelay(undefined, false, 3000)).toBe(false);
  });

  it('the current file is listed first, then the rest in the order the server sent (newest first)', () => {
    const rows = officialFileRows([file('f4', 'FAILED'), file('f3', 'READY'), file('f2', 'SUPERSEDED'), file('f1', 'VOID')]);
    expect(rows.map((r) => r.file.id)).toEqual(['f3', 'f4', 'f2', 'f1']);
    expect(rows.map((r) => r.current)).toEqual([true, false, false, false]);
  });

  it('every file but a failed one can be downloaded; replaced and void ones are muted', () => {
    const rows = officialFileRows([file('f4', 'FAILED'), file('f3', 'READY'), file('f2', 'SUPERSEDED'), file('f1', 'VOID')]);
    const byId = Object.fromEntries(rows.map((r) => [r.file.id, r]));
    expect(byId.f3).toMatchObject({ downloadable: true, muted: false });
    expect(byId.f4).toMatchObject({ downloadable: false, muted: false });
    expect(byId.f2).toMatchObject({ downloadable: true, muted: true });
    expect(byId.f1).toMatchObject({ downloadable: true, muted: true });
  });

  it('"Tạo lại" is on the current file (asking first) and on a failure newer than it (no question)', () => {
    const rows = officialFileRows([file('f4', 'FAILED'), file('f3', 'READY'), file('f2', 'SUPERSEDED')]);
    const byId = Object.fromEntries(rows.map((r) => [r.file.id, r]));
    expect(byId.f3).toMatchObject({ canRemake: true, remakeNeedsConfirm: true });
    expect(byId.f4).toMatchObject({ canRemake: true, remakeNeedsConfirm: false });
    expect(byId.f2.canRemake).toBe(false);
  });

  it('a failure that a later making already made good is history: no "Tạo lại" there', () => {
    const rows = officialFileRows([file('f3', 'READY'), file('f2', 'FAILED'), file('f1', 'FAILED')]);
    expect(rows.filter((r) => r.canRemake).map((r) => r.file.id)).toEqual(['f3']);
  });

  it('with several failures and no file, only the newest failure offers "Tạo lại"', () => {
    const rows = officialFileRows([file('f2', 'FAILED'), file('f1', 'FAILED')]);
    expect(rows.filter((r) => r.canRemake).map((r) => r.file.id)).toEqual(['f2']);
  });
});
