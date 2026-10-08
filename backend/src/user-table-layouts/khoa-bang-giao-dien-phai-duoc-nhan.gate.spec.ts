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
 * The scan needs LITERAL keys, so a call whose key is a variable / template string is itself a failure: it would hide an
 * unlisted key from this gate.
 *
 * Reads the frontend as text: the two are separate TypeScript projects.
 */
const GOC = path.resolve(__dirname, '../../..', 'frontend', 'src');

/** A call of either hook, with an optional generic argument list, up to the opening parenthesis. */
const LOI_GOI = /\buse(?:BoCucCot|MatDoDong)\s*(?:<[^>()]*>)?\(/g;
/** The same call when its first argument is a plain string literal. */
const GOI_HANG = /\buse(?:BoCucCot|MatDoDong)\s*(?:<[^>()]*>)?\(\s*(['"])([^'"`$\\]+)\1/g;

export function quetKhoaBang(chu: string): { khoa: string[]; khongPhaiHang: number } {
  const khoa = [...chu.matchAll(GOI_HANG)].map((m) => m[2]);
  // Declarations (`function useMatDoDong(tableKey: string)`) are not calls.
  const goi = [...chu.matchAll(LOI_GOI)].filter((m) => !/\bfunction\s+$/.test(chu.slice(Math.max(0, (m.index ?? 0) - 12), m.index)));
  return { khoa, khongPhaiHang: goi.length - khoa.length };
}

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

interface Dung {
  khoa: string;
  tep: string;
}

function duyetFrontend(): { dung: Dung[]; khongPhaiHang: string[] } {
  const dung: Dung[] = [];
  const khongPhaiHang: string[] = [];
  for (const f of tepNguon(GOC)) {
    const tep = path.relative(GOC, f).replace(/\\/g, '/');
    const r = quetKhoaBang(fs.readFileSync(f, 'utf8'));
    for (const k of r.khoa) dung.push({ khoa: k, tep });
    if (r.khongPhaiHang > 0) khongPhaiHang.push(`${tep} (${r.khongPhaiHang})`);
  }
  return { dung, khongPhaiHang };
}

describe('the scanner itself (a gate that cannot go red proves nothing)', () => {
  it('reads literal keys, with or without a generic argument', () => {
    expect(quetKhoaBang(`const a = useBoCucCot('cases', columns); const [m, d] = useMatDoDong("utdt");`).khoa).toEqual(['cases', 'utdt']);
    expect(quetKhoaBang(`useBoCucCot<Row>('petitions', cols)`).khoa).toEqual(['petitions']);
  });

  it('flags a variable key, a template string and a call with no literal', () => {
    expect(quetKhoaBang(`useBoCucCot(key, columns)`).khongPhaiHang).toBe(1);
    expect(quetKhoaBang('useMatDoDong(`x-${id}`)').khongPhaiHang).toBe(1);
    expect(quetKhoaBang(`useBoCucCot(TABLE_KEY, c); useMatDoDong('ok')`).khongPhaiHang).toBe(1);
  });

  it('does not mistake the hook declaration for a call', () => {
    expect(quetKhoaBang(`export function useMatDoDong(tableKey: string): [MatDo] { return x; }`)).toEqual({ khoa: [], khongPhaiHang: 0 });
  });
});

describe('every table key used by the frontend is accepted by the server', () => {
  const { dung, khongPhaiHang } = duyetFrontend();

  it('the scan sees the known screens (a scan that sees nothing proves nothing)', () => {
    const khoa = new Set(dung.map((d) => d.khoa));
    for (const k of ['petitions', 'incidents', 'cases', 'comprehensive', 'utdt']) expect(khoa.has(k)).toBe(true);
    expect(dung.length).toBeGreaterThanOrEqual(10);
  });

  it('no call passes a key the scan cannot read (variable / template string)', () => {
    expect(khongPhaiHang).toEqual([]);
  });

  it.each([...new Set(dung.map((d) => d.khoa))])('"%s" is in BANG_HOP_LE', (khoa) => {
    const tep = dung.filter((d) => d.khoa === khoa).map((d) => d.tep);
    expect({ khoa, trongDanhSach: BANG_HOP_LE.has(khoa), tep }).toEqual({ khoa, trongDanhSach: true, tep });
  });

  it('the allow-list has no entry the frontend never uses (stale keys hide typos)', () => {
    const dungSet = new Set(dung.map((d) => d.khoa));
    expect([...BANG_HOP_LE].filter((k) => !dungSet.has(k))).toEqual([]);
  });
});
