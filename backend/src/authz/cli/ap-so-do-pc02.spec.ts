import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { outPathProblem, parseArgs, repoRootOf } from './ap-so-do-pc02';

describe('ap-so-do-pc02: arguments', () => {
  it('is a dry run unless --that is given', () => {
    expect(parseArgs([])).toEqual({ apply: false, outPath: null, actorUsername: null, undoMoveId: null });
    expect(parseArgs(['--that', '--ra', '/home/pc02/a.xlsx', '--nguoi-thuc-hien', 'admin'])).toEqual({
      apply: true, outPath: '/home/pc02/a.xlsx', actorUsername: 'admin', undoMoveId: null,
    });
    expect(parseArgs(['--hoan-tac', 'move-1', '--nguoi-thuc-hien', 'admin'])).toMatchObject({ apply: false, undoMoveId: 'move-1' });
  });

  it('a flag with its value missing is not mistaken for the next flag', () => {
    expect(parseArgs(['--ra', '--that'])).toMatchObject({ apply: true, outPath: null });
  });
});

describe('ap-so-do-pc02: where the passwords may be written', () => {
  const outside = mkdtempSync(join(tmpdir(), 'so-do-out-'));
  const repo = mkdtempSync(join(tmpdir(), 'so-do-repo-'));
  afterAll(() => {
    rmSync(outside, { recursive: true, force: true });
    rmSync(repo, { recursive: true, force: true });
  });

  it('the checkout is the folder that holds backend', () => {
    expect(repoRootOf(join('C:', 'x', 'checkout', 'backend', 'dist', 'src', 'authz', 'cli'))).toBe(join('C:', 'x', 'checkout'));
  });

  it('outside the repository, a new .xlsx: accepted', () => {
    expect(outPathProblem(join(outside, 'tai-khoan.xlsx'), repo)).toBeNull();
  });

  it('inside the repository, an existing file, another kind of file, a folder that is not there: refused', () => {
    expect(outPathProblem(join(repo, 'tai-khoan.xlsx'), repo)).toMatch(/kho mã/);
    writeFileSync(join(outside, 'co-roi.xlsx'), 'x');
    expect(outPathProblem(join(outside, 'co-roi.xlsx'), repo)).toMatch(/đã có/);
    expect(outPathProblem(join(outside, 'tai-khoan.csv'), repo)).toMatch(/xlsx/);
    expect(outPathProblem(join(outside, 'khong-co', 'a.xlsx'), repo)).toMatch(/không có/);
  });
});
