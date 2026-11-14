import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { FeatureFlag } from '../../feature-flags/decorators/feature-flag.decorator';
import { FeatureFlagGuard } from '../../feature-flags/guards/feature-flag.guard';
import { PROCESSING_ERROR } from '../contract/processing-codes';
import { CalendarYearActionDto, SaveCalendarYearDto } from './dto/calendar.dto';
import { WorkingCalendarService, type CalendarYearDto } from './working-calendar.service';

interface AuthenticatedUser {
  id: string;
}

/** The year of the path: four digits. Whether it is a year a calendar may have is the service's answer. */
function yearOf(raw: string): number {
  if (!/^\d{4}$/.test(raw)) throw new BadRequestException({ code: PROCESSING_ERROR.CALENDAR_YEAR_INVALID });
  return Number(raw);
}

/**
 * The working calendar deadlines are counted on, year by year. Behind the same switch as the flow configuration
 * (`processing_flow`, 404 while it is off) and its own permissions on `ProcessingCalendar`: `read`, `edit` (save and
 * delete a year), `confirm` (declare the days of a year complete, and take that back).
 */
@Controller('processing-calendar/years')
@UseGuards(JwtAuthGuard, FeatureFlagGuard, PermissionsGuard)
@FeatureFlag('processing_flow')
export class WorkingCalendarController {
  constructor(private readonly calendars: WorkingCalendarService) {}

  /** Every stored year with its state and counts. A year with no row is not listed (it behaves as: weekends off). */
  @Get()
  @RequirePermissions({ action: 'read', subject: 'ProcessingCalendar' })
  listYears() {
    return this.calendars.listYears();
  }

  /** `stored: null`: the year has no row. That is a state, not an error: it is what `PUT` with `expected: null` fills. */
  @Get(':year')
  @RequirePermissions({ action: 'read', subject: 'ProcessingCalendar' })
  async getYear(@Param('year') year: string): Promise<{ year: number; stored: CalendarYearDto | null }> {
    const wanted = yearOf(year);
    return { year: wanted, stored: await this.calendars.getYear(wanted) };
  }

  @Put(':year')
  @RequirePermissions({ action: 'edit', subject: 'ProcessingCalendar' })
  saveYear(@Param('year') year: string, @Body() body: SaveCalendarYearDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calendars.saveYear(yearOf(year), body, user.id);
  }

  @Post(':year/confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'confirm', subject: 'ProcessingCalendar' })
  confirmYear(@Param('year') year: string, @Body() body: CalendarYearActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calendars.confirmYear(yearOf(year), body.expected, user.id);
  }

  /** The way back from `confirm`. */
  @Post(':year/unconfirm')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'confirm', subject: 'ProcessingCalendar' })
  unconfirmYear(@Param('year') year: string, @Body() body: CalendarYearActionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.calendars.unconfirmYear(yearOf(year), body.expected, user.id);
  }

  /** A DRAFT year only. `id` and `revision`: the row and revision looked at. */
  @Delete(':year')
  @RequirePermissions({ action: 'edit', subject: 'ProcessingCalendar' })
  deleteYear(
    @Param('year') year: string,
    @Query('id') id: string | undefined,
    @Query('revision') revision: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const wanted = yearOf(year);
    if (typeof id !== 'string' || id === '' || typeof revision !== 'string' || !/^[1-9]\d{0,8}$/.test(revision)) {
      throw new BadRequestException({ code: PROCESSING_ERROR.EXPECTED_REVISION_INVALID });
    }
    return this.calendars.deleteYear(wanted, { id, revision: Number(revision) }, user.id);
  }
}
