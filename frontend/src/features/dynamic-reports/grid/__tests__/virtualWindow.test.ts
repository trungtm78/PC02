import { describe, expect, it } from 'vitest';
import { planRows, shouldVirtualize, VIRTUALIZE_ABOVE_CELLS } from '../virtualWindow';
import type { RowSegment } from '../virtualWindow';

/**
 * A sheet of tens of thousands of cells cannot be drawn whole: only the rows around the viewport are, with a
 * single spacer row standing in for each stretch that is skipped. The plan has to keep the table honest — total
 * height unchanged, frozen rows always present, a merged block never cut in two, the row the cursor is on always
 * there so the keyboard never walks into a row that does not exist.
 */

const rows = (n: number, h = 20) => Array.from({ length: n }, () => h);

function drawn(segments: RowSegment[]): number[] {
  return segments.flatMap((s) => (s.kind === 'rows' ? Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i) : []));
}
function total(segments: RowSegment[], heights: number[]): number {
  return segments.reduce(
    (sum, s) =>
      sum + (s.kind === 'gap' ? s.height : heights.slice(s.from, s.to + 1).reduce((a, b) => a + b, 0)),
    0,
  );
}

describe('shouldVirtualize', () => {
  it('only a large sheet is windowed — a normal template is drawn whole, exactly as before', () => {
    expect(shouldVirtualize(100, 20)).toBe(false);
    expect(shouldVirtualize(258, 3)).toBe(false);
    expect(shouldVirtualize(Math.ceil(VIRTUALIZE_ABOVE_CELLS / 20) + 1, 20)).toBe(true);
  });
});

describe('planRows', () => {
  it('draws the rows in view plus an overscan, with a gap before and after', () => {
    const heights = rows(1000);
    const plan = planRows({ heights, frozen: 0, scrollTop: 10_000, viewport: 400, overscan: 200, blocks: [], keep: [] });
    const d = drawn(plan);
    expect(d[0]).toBe(490); // 10 000 - 200 → row 490
    expect(d[d.length - 1]).toBe(529); // 10 400 + 200 → row 529
    expect(plan[0]).toMatchObject({ kind: 'gap' });
    expect(plan[plan.length - 1]).toMatchObject({ kind: 'gap' });
  });

  it('the page keeps its full height: gaps + drawn rows add up to the whole sheet', () => {
    const heights = [...rows(300), 55, ...rows(699)];
    const plan = planRows({ heights, frozen: 2, scrollTop: 4000, viewport: 600, overscan: 300, blocks: [], keep: [] });
    expect(total(plan, heights)).toBe(heights.reduce((a, b) => a + b, 0));
  });

  it('the frozen rows are always drawn, whatever the scroll', () => {
    const plan = planRows({ heights: rows(1000), frozen: 3, scrollTop: 15_000, viewport: 400, overscan: 100, blocks: [], keep: [] });
    expect(drawn(plan).slice(0, 3)).toEqual([0, 1, 2]);
  });

  it('a merged block that reaches into the window is drawn whole, from its first row to its last', () => {
    // rows 40..60 are one block; the window starts at 50 and ends at 70.
    const plan = planRows({
      heights: rows(200),
      frozen: 0,
      scrollTop: 1000,
      viewport: 400,
      overscan: 0,
      blocks: [{ top: 40, bottom: 60 }],
      keep: [],
    });
    const d = drawn(plan);
    expect(d[0]).toBe(40);
    expect(d).toContain(60);
  });

  it('extending for one block can pull in the next: a chain of overlapping blocks is followed to its end', () => {
    const plan = planRows({
      heights: rows(200),
      frozen: 0,
      scrollTop: 1000,
      viewport: 100,
      overscan: 0,
      blocks: [
        { top: 40, bottom: 52 },
        { top: 30, bottom: 41 },
      ],
      keep: [],
    });
    expect(drawn(plan)[0]).toBe(30);
  });

  it('a row that must stay (the one with the cursor) is drawn even far from the window, apart from it', () => {
    const plan = planRows({ heights: rows(1000), frozen: 0, scrollTop: 0, viewport: 300, overscan: 0, blocks: [], keep: [700] });
    const d = drawn(plan);
    expect(d).toContain(700);
    expect(d).not.toContain(500);
    expect(total(plan, rows(1000))).toBe(20_000);
  });

  it('a kept row inside a block keeps the whole block', () => {
    const plan = planRows({ heights: rows(1000), frozen: 0, scrollTop: 0, viewport: 100, overscan: 0, blocks: [{ top: 600, bottom: 610 }], keep: [605] });
    const d = drawn(plan);
    for (let r = 600; r <= 610; r++) expect(d).toContain(r);
  });

  it('a window at the very top or bottom has a gap on one side only', () => {
    const heights = rows(500);
    const top = planRows({ heights, frozen: 0, scrollTop: 0, viewport: 200, overscan: 0, blocks: [], keep: [] });
    expect(top[0]).toMatchObject({ kind: 'rows', from: 0 });
    const bottom = planRows({ heights, frozen: 0, scrollTop: 99_999, viewport: 200, overscan: 0, blocks: [], keep: [] });
    expect(bottom[bottom.length - 1]).toMatchObject({ kind: 'rows', to: 499 });
  });

  it('a sheet shorter than the window is one run of rows with no gap', () => {
    const plan = planRows({ heights: rows(10), frozen: 0, scrollTop: 0, viewport: 5000, overscan: 500, blocks: [], keep: [] });
    expect(plan).toEqual([{ kind: 'rows', from: 0, to: 9 }]);
  });

  it('no rows, no plan', () => {
    expect(planRows({ heights: [], frozen: 0, scrollTop: 0, viewport: 400, overscan: 100, blocks: [], keep: [] })).toEqual([]);
  });

  it('a negative or oversized scroll position is clamped, never an error', () => {
    const heights = rows(100);
    expect(drawn(planRows({ heights, frozen: 0, scrollTop: -500, viewport: 100, overscan: 0, blocks: [], keep: [] }))[0]).toBe(0);
    expect(() => planRows({ heights, frozen: 0, scrollTop: 1e9, viewport: 100, overscan: 0, blocks: [], keep: [] })).not.toThrow();
  });

  it('segments are in order and never overlap', () => {
    const heights = rows(1000);
    const plan = planRows({ heights, frozen: 4, scrollTop: 8000, viewport: 500, overscan: 150, blocks: [{ top: 395, bottom: 405 }], keep: [900, 2] });
    let next = 0;
    for (const s of plan) {
      if (s.kind === 'rows') {
        expect(s.from).toBeGreaterThanOrEqual(next);
        next = s.to + 1;
      }
    }
  });
});
