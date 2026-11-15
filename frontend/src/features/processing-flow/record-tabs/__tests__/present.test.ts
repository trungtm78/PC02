import { describe, it, expect } from 'vitest';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { isAdjusted, lastActivity, partyLine, proposalLabel, speakingKinds, stepBadge } from '../present';
import { party, recFlow, recStep } from './fixtures';

const R = L.recordTabs;
const flow = recFlow();

describe('the badge of a step', () => {
  it('names the colour with the days left, the day of the deadline, and the overdue days', () => {
    expect(stepBadge(recStep({ band: 'RED', remainingDays: 1 }), flow).text).toBe('Đỏ · còn 1 ngày');
    expect(stepBadge(recStep({ band: 'YELLOW', remainingDays: 3 }), flow).text).toBe('Vàng · còn 3 ngày');
    expect(stepBadge(recStep({ band: 'GREEN', remainingDays: 0 }), flow).text).toBe('Xanh · hạn hôm nay');
    expect(stepBadge(recStep({ band: 'OVERDUE', remainingDays: -2 }), flow)).toMatchObject({ tone: 'over', text: 'Quá hạn 2 ngày' });
    expect(stepBadge(recStep({ band: 'NONE', remainingDays: 12 }), flow)).toMatchObject({ tone: 'neutral', text: 'Chưa tới ngưỡng · còn 12 ngày' });
  });

  it('a step with no deadline says so; a finished late step says late; a skipped one says when', () => {
    expect(stepBadge(recStep({ band: 'NONE', remainingDays: null, dueAt: null }), flow).text).toBe(R.noDeadline);
    expect(stepBadge(recStep({ status: 'DONE', doneAt: '2026-12-25T03:00:00.000Z', completion: 'DONE_LATE' }), flow).text).toBe('Xong 25/12/2026 · trễ hạn');
    expect(stepBadge(recStep({ status: 'SKIPPED', skippedAt: '2026-12-02T03:00:00.000Z' }), flow).text).toBe('Bỏ qua 02/12/2026');
  });

  it('gives no colour while the record is suspended, whatever the step carries', () => {
    const suspended = { suspended: true, pausedSince: null };
    expect(stepBadge(recStep({ band: 'RED', remainingDays: 1 }), suspended).text).toBe(R.suspended);
    expect(stepBadge(recStep({ band: 'OVERDUE', remainingDays: -4 }), { suspended: false, pausedSince: '2026-12-08T00:00:00.000Z' }).text).toBe(R.suspended);
  });

  it('a result waiting for the leader says so under the colour', () => {
    expect(stepBadge(recStep({ status: 'REPORTED', band: 'YELLOW', remainingDays: 2 }), flow).note).toBe(R.stepStatus.REPORTED);
  });
});

describe('the other words of a step', () => {
  it('writes a unit with its role and the person named', () => {
    const row = party({ id: 'pp-1', partyKind: 'TEAM', teamId: 't3', teamName: 'Tổ 3', role: 'CHECK', assigneeUserId: 'u7' });
    expect(partyLine({ ...row, assigneeName: 'Trần B' })).toBe('Tổ 3 · kiểm tra · Trần B');
    expect(partyLine(row)).toBe('Tổ 3 · kiểm tra');
    expect(partyLine({ ...row, partyKind: 'RECORD_TEAM', teamId: null, teamName: null, assigneeUserId: null })).toBe(`${L.recordTeam} · kiểm tra`);
  });

  it('the own target counts as adjusted only when it is earlier than the regulatory deadline', () => {
    expect(isAdjusted(recStep({ internalDueAt: '2026-12-16T00:00:00.000Z' }))).toBe(true);
    expect(isAdjusted(recStep({ internalDueAt: '2026-12-20T00:00:00.000Z' }))).toBe(false);
    expect(isAdjusted(recStep({ internalDueAt: null }))).toBe(false);
  });

  it('offers an opinion only in the roles the step holds', () => {
    const parties = (...roles: string[]) => ({ parties: roles.map((role) => party({ teamId: 't', teamName: 'T', role })) });
    expect(speakingKinds(parties('MAIN', 'INFORM'))).toEqual(['SUPERVISOR']);
    expect(speakingKinds(parties('CHECK', 'COORDINATE', 'MAIN'))).toEqual(['SUPERVISOR', 'COORDINATE', 'CHECK']);
    expect(speakingKinds(parties('INFORM'))).toEqual([]);
  });

  it('words a proposal by the kind of record; an unknown code is never shown raw', () => {
    expect(proposalLabel('CASE', 'CLOSE')).toBe('Đình chỉ, kết thúc');
    expect(proposalLabel('PETITION', 'CLOSE')).toBe(L.common.none);
    expect(proposalLabel('PETITION', null)).toBeNull();
  });

  it('the newest activity of a step is the latest of its report, opinion, finish and skip', () => {
    const a = recStep({ startAt: '2026-12-01T00:00:00.000Z' });
    const b = recStep({ latestReport: { kind: 'PROGRESS', summary: '', at: '2026-12-09T00:00:00.000Z', revision: 1 } });
    expect(lastActivity(b)).toBeGreaterThan(lastActivity(a));
    expect(lastActivity(recStep({ startAt: null }))).toBe(-Infinity);
  });
});
