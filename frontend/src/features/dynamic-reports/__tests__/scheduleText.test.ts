import { describe, it, expect } from 'vitest';
import { describeDueRule, describeOpenRule, describeSchedule } from '../scheduleText';

describe('scheduleText', () => {
  it('"N days after the period ends" with a time', () => {
    expect(describeDueRule({ kind: 'DAYS_AFTER_END', days: 5, time: '17:00' })).toBe('5 ngày sau khi kết thúc kỳ lúc 17:00');
  });

  it('a fixed day in the next period', () => {
    expect(describeDueRule({ kind: 'FIXED_IN_PERIOD', periodOffset: 1, anchorDay: 5, time: '09:30' })).toBe(
      'ngày 5 kỳ kế tiếp lúc 09:30',
    );
  });

  it('a weekly rule names the weekday, a quarterly one the month', () => {
    expect(describeDueRule({ kind: 'FIXED_IN_PERIOD', periodOffset: 0, anchorWeekday: 5, time: '17:00' })).toBe(
      'Thứ Sáu chính kỳ lúc 17:00',
    );
    expect(describeDueRule({ kind: 'FIXED_IN_PERIOD', periodOffset: 1, anchorMonth: 1, anchorDay: 15, time: '17:00' })).toBe(
      'ngày 15 tháng thứ 1 kỳ kế tiếp lúc 17:00',
    );
  });

  it('an unknown rule never throws', () => {
    expect(describeDueRule({})).toBe('Chưa xác định');
  });

  it('opening: from the start of the period, or N days before the due date', () => {
    expect(describeOpenRule({ kind: 'AT_PERIOD_START' })).toBe('Từ đầu kỳ');
    expect(describeOpenRule({ kind: 'DAYS_BEFORE_DUE', days: 3 })).toBe('3 ngày trước hạn');
  });

  it('a whole schedule reads as one sentence, with the custom start day and the weekend shift when they apply', () => {
    const text = describeSchedule({
      periodType: 'MONTHLY',
      periodStartDay: 21,
      dueRule: { kind: 'DAYS_AFTER_END', days: 3, time: '17:00' },
      openRule: { kind: 'AT_PERIOD_START' },
      shiftNonWorking: true,
      oneTimeDate: null,
      timezone: 'Asia/Ho_Chi_Minh',
      effectiveFrom: '2026-10-01T00:00:00.000Z',
    });
    expect(text).toBe(
      'Hằng tháng · kỳ bắt đầu ngày 21 · hạn 3 ngày sau khi kết thúc kỳ lúc 17:00 · mở từ đầu kỳ · dời hạn nếu rơi vào ngày nghỉ',
    );
  });
});
