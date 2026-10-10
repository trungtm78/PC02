import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { CalendarEventsService } from '../../calendar-events/calendar-events.service';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** S05-S08 preview only ever looks a few periods ahead (spec: "preview ≥6
 * kỳ") — even a YEARLY report's 6-period window is under 7 years. Capped
 * well above that so the wizard never hits this, while a crafted request
 * can't force an unbounded CalendarEvent scan. */
const MAX_RANGE_DAYS = 3650;

/**
 * S05-S08 (wizard schedule step, spec §6.1 PR4 + R7). Lets the client-side
 * `generatePeriods` preview (pure, mirrored to the frontend by gen:dr-engine)
 * show the same holiday shifts the real PeriodScheduler will apply later —
 * without duplicating `CalendarEventsService.expandOccurrences` logic, the
 * same call `period-scheduler.service.ts#resolveNonWorkingDates` already
 * makes server-side when it actually generates periods.
 */
@Controller('bao-cao-dong/schedule')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('dynamic_reports')
export class SchedulePreviewController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendarEvents: CalendarEventsService,
  ) {}

  @Get('non-working-dates')
  @RequirePermissions({ action: 'manage', subject: 'DynamicReport' })
  async nonWorkingDates(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
  ): Promise<{ dates: string[] }> {
    if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
      throw new BadRequestException(
        'Tham số "from"/"to" phải theo dạng YYYY-MM-DD.',
      );
    }
    const fromDate = new Date(`${from}T00:00:00Z`);
    const toDate = new Date(`${to}T00:00:00Z`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException(
        'Tham số "from"/"to" phải theo dạng YYYY-MM-DD.',
      );
    }
    const rangeDays = (toDate.getTime() - fromDate.getTime()) / 86_400_000;
    if (rangeDays < 0 || rangeDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Khoảng "from"-"to" phải không âm và không vượt quá ${MAX_RANGE_DAYS} ngày.`,
      );
    }

    const events = await this.prisma.calendarEvent.findMany({
      where: { scope: 'SYSTEM', isOfficialDayOff: true },
      include: { overrides: true },
    });
    const occurrences = this.calendarEvents.expandOccurrences(
      events,
      fromDate,
      toDate,
    );
    const dates = occurrences
      .map((o) => o.occurrenceDate.toISOString().slice(0, 10))
      .sort();
    return { dates };
  }
}
