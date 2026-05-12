import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { FeatureFlag } from '../feature-flags/decorators/feature-flag.decorator';
import { UnitScopeService } from '../auth/services/unit-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarEventsService, CurrentUser } from './calendar-events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('calendar-events')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@FeatureFlag('calendar_events_v2')
export class CalendarEventsController {
  constructor(
    private readonly service: CalendarEventsService,
    private readonly unitScope: UnitScopeService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Build the CurrentUser from req.user, expanding teamIds + leaderTeamIds from DB.
   * We DO NOT trust JWT for team membership (mitigates team-change leak — Eng review).
   */
  private async resolveCurrentUser(req: any): Promise<CurrentUser> {
    const userId = req.user.id;
    const roleName: string = req.user.role ?? 'OFFICER';

    if (roleName === 'ADMIN') {
      return { id: userId, role: roleName };
    }

    const memberships = await this.prisma.userTeam.findMany({
      where: { userId },
      select: { teamId: true, isLeader: true },
    });
    return {
      id: userId,
      role: roleName,
      teamIds: memberships.map((m) => m.teamId),
      leaderTeamIds: memberships.filter((m) => m.isLeader).map((m) => m.teamId),
    };
  }

  @Get()
  @RequirePermissions({ action: 'read', subject: 'Calendar' })
  async list(@Query('year') year: string | undefined, @Query('month') month: string | undefined, @Req() req: any) {
    const now = new Date();
    const y = year ? Number(year) : now.getFullYear();
    const m = month ? Number(month) : undefined;
    const from = m !== undefined ? new Date(y, m - 1, 1) : new Date(y, 0, 1);
    const to = m !== undefined ? new Date(y, m, 0, 23, 59, 59, 999) : new Date(y, 11, 31, 23, 59, 59, 999);
    const currentUser = await this.resolveCurrentUser(req);
    return this.service.findInRange(from, to, currentUser);
  }

  @Post()
  @Throttle({ default: { ttl: 60000, limit: 20 } }) // 20 events/min per user — anti-spam
  @RequirePermissions({ action: 'write', subject: 'Calendar' })
  async create(@Body() dto: CreateEventDto, @Req() req: any) {
    const currentUser = await this.resolveCurrentUser(req);
    return this.service.create(dto, currentUser);
  }

  @Patch(':id')
  @RequirePermissions({ action: 'edit', subject: 'Calendar' })
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto, @Req() req: any) {
    const currentUser = await this.resolveCurrentUser(req);
    return this.service.update(id, dto, currentUser);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Calendar' })
  async remove(@Param('id') id: string, @Req() req: any) {
    const currentUser = await this.resolveCurrentUser(req);
    return this.service.softDelete(id, currentUser);
  }

  /**
   * Exclude a single occurrence of a recurring event (RFC 5545 EXDATE).
   * Used by "Xóa chỉ ngày này" in the recurring delete dialog.
   */
  @Delete(':id/occurrence/:date')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ action: 'delete', subject: 'Calendar' })
  async excludeOccurrence(@Param('id') id: string, @Param('date') date: string, @Req() req: any) {
    const currentUser = await this.resolveCurrentUser(req);
    return this.service.excludeOccurrence(id, date, currentUser);
  }
}
