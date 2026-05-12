import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { RRule } from 'rrule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto, EventScopeDto, validateRecurrenceSafety } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

export interface CurrentUser {
  id: string;
  role: string;
  teamIds?: string[];
  leaderTeamIds?: string[];
}

const PERSONAL_EVENT_CAP_PER_USER = 1000;
const MAX_OCCURRENCES_PER_EVENT = 500; // DoS protection — Eng review fix

export interface ExpandedOccurrence {
  eventId: string;
  occurrenceDate: Date;
  event: any; // full event record with category
  override: any | null; // override record if any
}

@Injectable()
export class CalendarEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find non-deleted events in a date range with DataScope applied.
   * Admin gets all events; non-admin gets SYSTEM + own TEAM + own PERSONAL.
   */
  async findInRange(from: Date, to: Date, currentUser: CurrentUser) {
    const where: any = {
      deletedAt: null,
      startDate: { gte: from, lte: to },
    };

    if (currentUser.role !== 'ADMIN') {
      where.OR = [
        { scope: 'SYSTEM' },
        { scope: 'TEAM', teamId: { in: currentUser.teamIds ?? [] } },
        { scope: 'PERSONAL', userId: currentUser.id },
      ];
    }

    return this.prisma.calendarEvent.findMany({
      where,
      include: { category: true },
    });
  }

  async create(dto: CreateEventDto, currentUser: CurrentUser) {
    // 1. RRULE safety check before any DB hit.
    try {
      validateRecurrenceSafety(dto.recurrenceRule, dto.recurrenceEndDate);
    } catch (err: any) {
      throw new BadRequestException(err.message);
    }

    // 2. Scope authorization + payload normalization.
    let teamId: string | null = null;
    let userId: string | null = null;

    if (dto.scope === EventScopeDto.SYSTEM) {
      if (currentUser.role !== 'ADMIN') {
        throw new ForbiddenException('Chỉ admin mới tạo được sự kiện cấp hệ thống');
      }
    } else if (dto.scope === EventScopeDto.TEAM) {
      if (!dto.teamId) {
        throw new BadRequestException('TEAM scope yêu cầu teamId');
      }
      const isLeader = (currentUser.leaderTeamIds ?? []).includes(dto.teamId);
      if (currentUser.role !== 'ADMIN' && !isLeader) {
        throw new ForbiddenException('Chỉ tổ trưởng của tổ này (hoặc admin) mới tạo được sự kiện cấp tổ');
      }
      teamId = dto.teamId;
    } else if (dto.scope === EventScopeDto.PERSONAL) {
      // Force userId to currentUser.id — ignore any client-sent value (security: prevent spoofing onto another user).
      userId = currentUser.id;

      // Per-user cap on active PERSONAL events.
      const activeCount = await this.prisma.calendarEvent.count({
        where: { scope: 'PERSONAL', userId, deletedAt: null },
      });
      if (activeCount >= PERSONAL_EVENT_CAP_PER_USER) {
        throw new ConflictException(
          `Đã đạt giới hạn ${PERSONAL_EVENT_CAP_PER_USER} sự kiện cá nhân. Xóa bớt sự kiện cũ trước khi tạo mới.`,
        );
      }
    }

    return this.prisma.calendarEvent.create({
      data: {
        title: dto.title,
        shortTitle: dto.shortTitle ?? null,
        description: dto.description ?? null,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        startTime: dto.startTime ?? null,
        endTime: dto.endTime ?? null,
        allDay: dto.allDay,
        isOfficialDayOff: dto.isOfficialDayOff ?? false,
        lunarDate: dto.lunarDate ?? null,
        categoryId: dto.categoryId,
        scope: dto.scope,
        teamId,
        userId,
        recurrenceRule: dto.recurrenceRule ?? null,
        recurrenceEndDate: dto.recurrenceEndDate ? new Date(dto.recurrenceEndDate) : null,
        createdById: currentUser.id,
      },
    });
  }

  async update(id: string, dto: UpdateEventDto, currentUser: CurrentUser) {
    const existing = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Sự kiện ${id} không tồn tại`);
    }

    this.assertCanMutate(existing, currentUser);

    // Validate recurrence safety if it's being changed.
    if (dto.recurrenceRule !== undefined) {
      try {
        validateRecurrenceSafety(dto.recurrenceRule, dto.recurrenceEndDate ?? existing.recurrenceEndDate?.toISOString());
      } catch (err: any) {
        throw new BadRequestException(err.message);
      }
    }

    // Whitelist updatable fields — scope is intentionally not editable.
    const data: Record<string, unknown> = { updatedById: currentUser.id };
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.shortTitle !== undefined) data.shortTitle = dto.shortTitle;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.startTime !== undefined) data.startTime = dto.startTime;
    if (dto.endTime !== undefined) data.endTime = dto.endTime;
    if (dto.allDay !== undefined) data.allDay = dto.allDay;
    if (dto.isOfficialDayOff !== undefined) data.isOfficialDayOff = dto.isOfficialDayOff;
    if (dto.lunarDate !== undefined) data.lunarDate = dto.lunarDate;
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.recurrenceRule !== undefined) data.recurrenceRule = dto.recurrenceRule;
    if (dto.recurrenceEndDate !== undefined) {
      data.recurrenceEndDate = dto.recurrenceEndDate ? new Date(dto.recurrenceEndDate) : null;
    }

    return this.prisma.calendarEvent.update({ where: { id }, data });
  }

  async softDelete(id: string, currentUser: CurrentUser) {
    const existing = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Sự kiện ${id} không tồn tại`);
    }

    this.assertCanMutate(existing, currentUser);

    return this.prisma.calendarEvent.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: currentUser.id },
    });
  }

  /**
   * Exclude a single occurrence of a recurring event (RFC 5545 EXDATE).
   * Used by frontend's "Xóa chỉ ngày này" option in the recurring delete dialog.
   */
  async excludeOccurrence(id: string, occurrenceDate: string, currentUser: CurrentUser) {
    const existing = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Sự kiện ${id} không tồn tại`);
    }
    if (!existing.recurrenceRule) {
      throw new BadRequestException('Chỉ áp dụng cho sự kiện lặp lại');
    }

    this.assertCanMutate(existing, currentUser);

    return this.prisma.calendarEventOccurrenceOverride.create({
      data: {
        eventId: id,
        occurrenceDate: new Date(occurrenceDate),
        excluded: true,
      },
    });
  }

  /**
   * Expand events into per-date occurrences using RRULE (RFC 5545).
   * - Non-recurring: 1 occurrence on startDate (if in range).
   * - Recurring: rrule.between(from, to, true), capped at MAX_OCCURRENCES_PER_EVENT.
   * - Applies overrides — excluded=true skips the occurrence (EXDATE pattern).
   *
   * Events passed in MUST include `overrides` relation pre-loaded.
   */
  expandOccurrences(
    events: any[],
    from: Date,
    to: Date,
  ): ExpandedOccurrence[] {
    const result: ExpandedOccurrence[] = [];

    for (const ev of events) {
      const overrideMap = new Map<string, any>();
      for (const ov of ev.overrides ?? []) {
        const key = ov.occurrenceDate.toISOString().slice(0, 10);
        overrideMap.set(key, ov);
      }

      if (!ev.recurrenceRule) {
        // Non-recurring: single occurrence on startDate.
        const start = ev.startDate as Date;
        if (start >= from && start <= to) {
          const key = start.toISOString().slice(0, 10);
          const override = overrideMap.get(key);
          if (override?.excluded) continue;
          result.push({ eventId: ev.id, occurrenceDate: start, event: ev, override: override ?? null });
        }
        continue;
      }

      // Recurring: parse RRULE and expand within range.
      let rrule: RRule;
      try {
        rrule = RRule.fromString(`DTSTART:${this.toRRuleDate(ev.startDate)}\nRRULE:${ev.recurrenceRule}`);
      } catch {
        // Malformed RRULE — skip with single occurrence on startDate (defensive).
        if (ev.startDate >= from && ev.startDate <= to) {
          result.push({ eventId: ev.id, occurrenceDate: ev.startDate, event: ev, override: null });
        }
        continue;
      }

      const effectiveTo = ev.recurrenceEndDate && ev.recurrenceEndDate < to ? ev.recurrenceEndDate : to;
      const dates = rrule.between(from, effectiveTo, true).slice(0, MAX_OCCURRENCES_PER_EVENT);

      for (const date of dates) {
        const key = date.toISOString().slice(0, 10);
        const override = overrideMap.get(key);
        if (override?.excluded) continue;
        result.push({ eventId: ev.id, occurrenceDate: date, event: ev, override: override ?? null });
      }
    }

    return result;
  }

  /** Format a Date into RRULE DTSTART string: YYYYMMDDTHHmmssZ */
  private toRRuleDate(d: Date): string {
    return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  /**
   * Mutation authorization: SYSTEM events require ADMIN regardless of createdById.
   * TEAM events: admin OR leader of the event's teamId.
   * PERSONAL events: admin OR the userId on the event.
   */
  private assertCanMutate(event: any, currentUser: CurrentUser): void {
    if (currentUser.role === 'ADMIN') return;

    if (event.scope === 'SYSTEM') {
      throw new ForbiddenException('Chỉ admin mới sửa được sự kiện cấp hệ thống');
    }

    if (event.scope === 'TEAM') {
      const isLeader = (currentUser.leaderTeamIds ?? []).includes(event.teamId);
      if (!isLeader) {
        throw new ForbiddenException('Chỉ tổ trưởng của tổ này (hoặc admin) mới sửa được sự kiện cấp tổ');
      }
      return;
    }

    if (event.scope === 'PERSONAL') {
      if (event.userId !== currentUser.id) {
        throw new ForbiddenException('Chỉ chủ sở hữu mới sửa được sự kiện cá nhân');
      }
      return;
    }
  }
}
