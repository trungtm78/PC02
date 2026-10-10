import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SchedulePreviewController } from './schedule-preview.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { CalendarEventsService } from '../../calendar-events/calendar-events.service';
import { FeatureFlagsService } from '../../feature-flags/feature-flags.service';

/**
 * GET /bao-cao-dong/schedule/non-working-dates (S05-S08, R7). Unit test
 * wires the controller to mocked Prisma + CalendarEventsService — the
 * guard chain is covered by the route-permission gate spec, same pattern
 * as reports.controller.spec.ts.
 */
describe('SchedulePreviewController', () => {
  let controller: SchedulePreviewController;
  const prisma = { calendarEvent: { findMany: jest.fn() } };
  const calendarEvents = { expandOccurrences: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulePreviewController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: CalendarEventsService, useValue: calendarEvents },
        { provide: FeatureFlagsService, useValue: {} },
      ],
    }).compile();
    controller = module.get<SchedulePreviewController>(
      SchedulePreviewController,
    );
  });

  it('rejects a missing or malformed from/to pair', async () => {
    await expect(
      controller.nonWorkingDates(undefined, '2026-12-31'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.nonWorkingDates('2026-01-01', 'not-a-date'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.nonWorkingDates('31/12/2026', '2026-12-31'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects "to" before "from" and a range wider than the cap', async () => {
    await expect(
      controller.nonWorkingDates('2026-12-31', '2026-01-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.nonWorkingDates('2020-01-01', '2030-01-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('queries only SYSTEM official-day-off events and returns sorted ISO dates', async () => {
    prisma.calendarEvent.findMany.mockResolvedValue([{ id: 'ev1' }]);
    calendarEvents.expandOccurrences.mockReturnValue([
      { occurrenceDate: new Date('2026-09-02T00:00:00Z') },
      { occurrenceDate: new Date('2026-01-01T00:00:00Z') },
    ]);

    const result = await controller.nonWorkingDates('2026-01-01', '2026-12-31');

    expect(prisma.calendarEvent.findMany).toHaveBeenCalledWith({
      where: { scope: 'SYSTEM', isOfficialDayOff: true },
      include: { overrides: true },
    });
    expect(result).toEqual({ dates: ['2026-01-01', '2026-09-02'] });
  });
});
