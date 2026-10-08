import * as fs from 'fs';
import * as path from 'path';
import { BANG_HOP_LE } from './user-table-layouts.service';

/**
 * GATE: every table key the frontend hands to `useBoCucCot(...)` / `useMatDoDong(...)` must be in the server allow-list.
 *
 * `kiemBang` answers 400 to any key outside `BANG_HOP_LE`. A screen using an unlisted key looks fine (the optimistic UI
 * flips instantly) but nothing is ever saved: the column layout and the row density snap back on the next load. Found by
 * the monkey run of 09/10/2026 on the "Ủy thác điều tra" list (`utdt`): every density click was a 400.
 *
 * Reads the frontend as text: the two are separate TypeScript projects.
 */
const GOC = path.resolve(__dirname, '../../..', 'frontend', 'src');

function tepNguon(dir: string): string[] {
  const ra: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue;
      ra.push(...tepNguon(p));
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      ra.push(p);
    }
  }
  return ra;
}

/** Literal keys passed to the two hooks, with the file that passes them. */
function khoaDangDung(): { khoa: string; tep: string }[] {
  const ra: { khoa: string; tep: string }[] = [];
  const re = /use(?:BoCucCot|MatDoDong)\(\s*['"]([^'"]+)['"]/g;
  for (const f of tepNguon(GOC)) {
    const chu = fs.readFileSync(f, 'utf8');
    for (const m of chu.matchAll(re)) ra.push({ khoa: m[1], tep: path.relative(GOC, f).replace(/\\/g, '/') });
  }
  return ra;
}

describe('every table key used by the frontend is accepted by the server', () => {
  const dung = khoaDangDung();

  it('the scan sees the known screens (a scan that sees nothing proves nothing)', () => {
    const khoa = new Set(dung.map((d) => d.khoa));
    for (const k of ['petitions', 'incidents', 'cases', 'comprehensive', 'utdt']) expect(khoa.has(k)).toBe(true);
    expect(dung.length).toBeGreaterThanOrEqual(10);
  });

  it.each([...new Set(dung.map((d) => d.khoa))])('"%s" is in BANG_HOP_LE', (khoa) => {
    const tep = dung.filter((d) => d.khoa === khoa).map((d) => d.tep);
    expect({ khoa, trongDanhSach: BANG_HOP_LE.has(khoa), tep }).toEqual({ khoa, trongDanhSach: true, tep });
  });

  it('the allow-list has no entry the frontend never uses (stale keys hide typos)', () => {
    const dungSet = new Set(dung.map((d) => d.khoa));
    const thua = [...BANG_HOP_LE].filter((k) => !dungSet.has(k));
    expect(thua).toEqual([]);
  });
});
