import type { CalendarYearDto, CalendarYearSummaryDto } from '../types';

export function yearDto(over: Partial<CalendarYearDto> = {}): CalendarYearDto {
  return {
    id: 'y2026',
    year: 2026,
    weekendDays: [0, 6],
    status: 'DRAFT',
    revision: 3,
    confirmedById: null,
    confirmedAt: null,
    note: null,
    updatedById: 'u1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    days: [
      { date: '2026-09-02', kind: 'OFF', label: 'Quốc khánh' },
      { date: '2026-09-05', kind: 'WORKING', label: null },
    ],
    ...over,
  };
}

export function yearSummary(over: Partial<CalendarYearSummaryDto> = {}): CalendarYearSummaryDto {
  return {
    id: 'y2026',
    year: 2026,
    weekendDays: [0, 6],
    status: 'DRAFT',
    revision: 3,
    daysOff: 9,
    workingDays: 1,
    note: null,
    confirmedById: null,
    confirmedAt: null,
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...over,
  };
}
