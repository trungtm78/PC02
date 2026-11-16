import { WardRuleError } from './ward-assignment.rules';
import { addMonths, decisionInForce, normaliseRequirements, resultDueFrom, returnRevocable, timeliness, vnDay } from './ward-review.rules';

/** Expected values from the owner's decisions of 16/11/2026 and the sheet "Diễn giải các column", not from the code. */
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('the deadline for the result: received + 2 months, on the calendar of Viet Nam', () => {
  it.each([
    ['2026-11-16', '2027-01-16'],
    ['2026-12-31', '2027-02-28'],
    ['2027-12-31', '2028-02-29'],
    ['2026-11-30', '2027-01-30'],
    ['2026-12-30', '2027-02-28'],
    ['2027-01-31', '2027-03-31'],
  ])('received %s -> due %s', (received, due) => {
    expect(resultDueFrom(day(received)).toISOString().slice(0, 10)).toBe(due);
  });

  it('adding months keeps whole days and works backwards too', () => {
    expect(addMonths(day('2026-03-31'), -1).toISOString().slice(0, 10)).toBe('2026-02-28');
    expect(addMonths(day('2026-01-15'), 12).toISOString().slice(0, 10)).toBe('2027-01-15');
  });

  it('"today" is the day in Viet Nam: 23:30 UTC on the 15th is already the 16th there', () => {
    expect(vnDay(new Date('2026-11-15T23:30:00Z')).toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect(vnDay(new Date('2026-11-15T16:59:59Z')).toISOString()).toBe('2026-11-15T00:00:00.000Z');
    expect(vnDay(new Date('2026-11-15T17:00:00Z')).toISOString()).toBe('2026-11-16T00:00:00.000Z');
  });
});

describe('on time or late', () => {
  it('completed on or before the deadline is on time; after it, late by whole days', () => {
    expect(timeliness(day('2027-01-09'), day('2027-01-16'))).toEqual({ onTime: true, lateDays: 0 });
    expect(timeliness(day('2027-01-16'), day('2027-01-16'))).toEqual({ onTime: true, lateDays: 0 });
    expect(timeliness(day('2027-01-19'), day('2027-01-16'))).toEqual({ onTime: false, lateDays: 3 });
  });
});

describe('the requirements of a request slip', () => {
  it('are kept in order, trimmed', () => {
    expect(normaliseRequirements(['  Ghi lời khai bổ sung ', 'Trích xuất camera'])).toEqual(['Ghi lời khai bổ sung', 'Trích xuất camera']);
    expect(normaliseRequirements([])).toEqual([]);
  });

  it('a blank line is refused with its number, never dropped (the slip must be numbered as the reviewer saw it)', () => {
    let caught: unknown;
    try {
      normaliseRequirements(['Một', '   ', 'Ba']);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(WardRuleError);
    expect(caught).toMatchObject({ code: 'WARD_REQUIREMENT_EMPTY', detail: { position: 2 } });
  });

  it('more than 50 lines, or a line over 2 000 characters, is refused', () => {
    expect(() => normaliseRequirements(Array.from({ length: 51 }, (_, i) => `Yêu cầu ${i + 1}`))).toThrow(WardRuleError);
    expect(normaliseRequirements(Array.from({ length: 50 }, (_, i) => `Yêu cầu ${i + 1}`))).toHaveLength(50);
    expect(() => normaliseRequirements(['x'.repeat(2001)])).toThrow(WardRuleError);
    expect(normaliseRequirements(['x'.repeat(2000)])).toHaveLength(1);
  });
});

describe('the decision in force and taking a return back', () => {
  const at = (h: number) => new Date(Date.UTC(2026, 10, 16, h));
  const d = (id: string, kind: 'RETURN' | 'APPROVE', h: number, revokedH: number | null = null) => ({ id, kind, decidedAt: at(h), revokedAt: revokedH === null ? null : at(revokedH) });

  it('is the latest decision not revoked', () => {
    expect(decisionInForce([])).toBeNull();
    expect(decisionInForce([d('a', 'RETURN', 1)])?.id).toBe('a');
    expect(decisionInForce([d('a', 'RETURN', 1, 2), d('b', 'APPROVE', 3)])?.id).toBe('b');
    expect(decisionInForce([d('a', 'RETURN', 1, 2)])).toBeNull();
  });

  it('a return is taken back only while the ward unit has not touched the request since', () => {
    const ret = d('a', 'RETURN', 9);
    expect(returnRevocable({ status: 'RETURNED', updatedAt: at(9) }, ret)).toBe(true);
    expect(returnRevocable({ status: 'RETURNED', updatedAt: at(10) }, ret)).toBe(false);
    expect(returnRevocable({ status: 'SUBMITTED', updatedAt: at(9) }, ret)).toBe(false);
    expect(returnRevocable({ status: 'RETURNED', updatedAt: at(9) }, d('b', 'APPROVE', 9))).toBe(false);
    expect(returnRevocable({ status: 'RETURNED', updatedAt: at(9) }, null)).toBe(false);
  });
});
