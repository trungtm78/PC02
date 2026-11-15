import { describe, it, expect } from 'vitest';
import { BANDS } from '../record-tabs/codes';
import { TONE_CARD_CLASS, TONE_CLASS, alertBadge, bandText, bandTone } from '../bandPresenter';
import { TONE_CLASS as TAB_TONE_CLASS, stepBadge } from '../record-tabs/present';
import { recFlow, recStep } from '../record-tabs/__tests__/fixtures';

describe('the one presenter of an alert band', () => {
  it('gives every band of the contract a tone that has a colour', () => {
    for (const band of BANDS) expect(TONE_CLASS[bandTone(band)]).toBeTruthy();
    // A count card of a band is coloured from the same file, for every tone a chip can have.
    expect(Object.keys(TONE_CARD_CLASS).sort()).toEqual(Object.keys(TONE_CLASS).sort());
    expect(TONE_CARD_CLASS[bandTone('OVERDUE')].valueColorClass).toBe('text-red-900');
    expect(BANDS.map(bandTone)).toEqual(['over', 'red', 'yellow', 'green', 'neutral']);
    expect(bandTone('SOMETHING_NEW')).toBe('neutral');
  });

  it('words a band with the days left, the due day, and the days overdue', () => {
    expect(bandText('RED', 1)).toBe('Đỏ · còn 1 ngày');
    expect(bandText('YELLOW', 3)).toBe('Vàng · còn 3 ngày');
    expect(bandText('GREEN', 0)).toBe('Xanh · hạn hôm nay');
    expect(bandText('OVERDUE', -2)).toBe('Quá hạn 2 ngày');
    expect(bandText('OVERDUE', 0)).toBe('Quá hạn');
    expect(bandText('NONE', 12)).toBe('Chưa tới ngưỡng · còn 12 ngày');
    expect(bandText('RED', null)).toBe('Đỏ');
  });

  it('is the table the record tabs use, not a second one', () => {
    expect(TAB_TONE_CLASS).toBe(TONE_CLASS);
    const badge = stepBadge(recStep({ band: 'YELLOW', remainingDays: 3 }), recFlow());
    expect(badge).toMatchObject({ tone: bandTone('YELLOW'), text: bandText('YELLOW', 3) });
  });
});

describe('the alert of a row of a list', () => {
  const alert = (over: Partial<Parameters<typeof alertBadge>[0]>) =>
    alertBadge({ source: 'FLOW', band: 'RED', remainingDays: 1, stepName: 'Xác minh', dueAt: '2026-12-20T16:59:59.999Z', ...over });

  it('from a flow: the colour, the days and the step the colour comes from', () => {
    expect(alert({})).toEqual({ tone: 'red', text: 'Đỏ · còn 1 ngày', step: 'Xác minh', sentence: 'Đỏ · còn 1 ngày · Xác minh' });
    expect(alert({ band: 'OVERDUE', remainingDays: -2 })?.sentence).toBe('Quá hạn 2 ngày · Xác minh');
    expect(alert({ band: 'YELLOW', remainingDays: 3 })?.sentence).toBe('Vàng · còn 3 ngày · Xác minh');
    expect(alert({ band: 'GREEN', remainingDays: 5 })?.sentence).toBe('Xanh · còn 5 ngày · Xác minh');
  });

  it('from the record own deadline: the same words with no step', () => {
    expect(alert({ source: 'RECORD_DEADLINE', stepName: null })).toEqual({ tone: 'red', text: 'Đỏ · còn 1 ngày', step: null, sentence: 'Đỏ · còn 1 ngày' });
    expect(alert({ source: 'RECORD_DEADLINE', stepName: null, band: 'OVERDUE', remainingDays: -2 })?.sentence).toBe('Quá hạn 2 ngày');
    expect(alert({ source: 'RECORD_DEADLINE', stepName: null, band: 'RED', remainingDays: 0 })?.sentence).toBe('Đỏ · hạn hôm nay');
  });

  it('a flow alert whose step is not named shows no dangling separator', () => {
    expect(alert({ stepName: null })?.sentence).toBe('Đỏ · còn 1 ngày');
    expect(alert({ stepName: '  ' })?.sentence).toBe('Đỏ · còn 1 ngày');
  });

  it('a record that has not reached any threshold shows nothing, like a record with no alert (the approved wireframe)', () => {
    expect(alert({ band: 'NONE', remainingDays: 40 })).toBeNull();
    expect(alert({ source: 'RECORD_DEADLINE', band: 'NONE', remainingDays: 8, stepName: null })).toBeNull();
    expect(alertBadge(null)).toBeNull();
    expect(alertBadge(undefined)).toBeNull();
  });
});
