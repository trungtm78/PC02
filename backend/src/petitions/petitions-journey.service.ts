import { Injectable } from '@nestjs/common';
import { PetitionsService } from './petitions.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  PETITION_STATUS_LABEL,
} from '../common/constants/status-labels.constants';
import type { DataScope } from '../auth/services/unit-scope.service';
import type {
  TimelineEventDto,
  TimelineEventType,
  JourneyResultDto,
} from '../cases/dto/timeline-event.dto';

const SAFE_CHANGED_FIELDS = new Set([
  'status', 'petitionType', 'petitionStatus', 'loaiDon', 'assignedTeamId',
  'assignedToId', 'deadline', 'description', 'name',
]);

const ACTION_TO_EVENT: Record<string, TimelineEventType> = {
  PETITION_CREATED: 'CREATED',
  PETITION_UPDATED: 'FIELD_UPDATE',
  PETITION_DELETED: 'FIELD_UPDATE',
  PETITION_STATUS_CHANGED: 'STATUS_CHANGE',
  PETITION_CONVERTED_TO_CASE: 'LINKED',
  PETITION_CONVERTED_TO_INCIDENT: 'LINKED',
  PETITION_ASSIGNED: 'FIELD_UPDATE',
  PETITION_ESCALATED_FROM_WARD: 'LINKED',
};

function buildActorName(user: { firstName: string | null; lastName: string | null } | null): string {
  if (!user) return 'Hệ thống';
  const parts = [user.lastName, user.firstName].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Hệ thống';
}

@Injectable()
export class PetitionsJourneyService {
  constructor(
    private readonly petitionsService: PetitionsService,
    private readonly prisma: PrismaService,
  ) {}

  async getJourney(
    petitionId: string,
    dataScope: DataScope | null,
    page: number,
    limit: number,
  ): Promise<{ success: true; data: JourneyResultDto }> {
    // Enforce DataScope — throws ForbiddenException if out of scope
    const petitionResult = await this.petitionsService.getById(petitionId, dataScope ?? undefined);
    const petitionRecord = petitionResult.data as {
      id: string;
      stt?: string;
      createdAt?: Date;
      assignedToId?: string | null;
    };

    // True server-side pagination: count queries determine total without loading all rows
    const [dbTotal, createdCount] = await Promise.all([
      this.prisma.auditLog.count({ where: { subjectId: petitionId } }),
      this.prisma.auditLog.count({ where: { subjectId: petitionId, action: 'PETITION_CREATED' } }),
    ]);

    // Synthetic CREATED event injected when no PETITION_CREATED audit log exists.
    // Synthetic is always the oldest event (position = dbTotal in DESC-sorted list).
    const hasSyntheticCreated = createdCount === 0 && !!petitionRecord.createdAt;
    const effectiveTotal = dbTotal + (hasSyntheticCreated ? 1 : 0);

    const skip = (page - 1) * limit;
    // Number of real DB records to fetch for this page (may be < limit near end)
    const realFetchCount = Math.max(0, Math.min(limit, dbTotal - skip));
    // Synthetic occupies position `dbTotal` (0-indexed) in the full DESC-sorted list
    const syntheticOnThisPage =
      hasSyntheticCreated && skip <= dbTotal && dbTotal < skip + limit;

    // Fetch only the page slice from DB
    const auditLogs =
      realFetchCount > 0
        ? await this.prisma.auditLog.findMany({
            where: { subjectId: petitionId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: realFetchCount,
            include: {
              user: { select: { id: true, firstName: true, lastName: true, username: true } },
            },
          })
        : [];

    const entityLabel = `Đơn thư ${petitionRecord.stt ?? petitionId}`;

    const events: TimelineEventDto[] = (auditLogs as any[]).map((log) => {
      const eventType: TimelineEventType = ACTION_TO_EVENT[log.action as string] ?? 'FIELD_UPDATE';
      const meta = log.metadata as Record<string, any> | null;
      const hasDiff = !!(meta?.before);
      const changedFields = meta?.before
        ? Object.keys(meta.before as Record<string, unknown>).filter((f) => SAFE_CHANGED_FIELDS.has(f))
        : undefined;

      return {
        id: `audit-${log.id}`,
        entityType: 'PETITION',
        entityId: petitionId,
        entityLabel,
        eventType,
        title: eventType === 'CREATED' ? 'Được tạo' : eventType === 'LINKED' ? 'Liên kết' : 'Cập nhật',
        detail: null,
        actor: log.user
          ? { id: (log.user as any).id, name: buildActorName(log.user as any) }
          : null,
        actedAt: log.createdAt as Date,
        metadata: {
          hasDiff,
          ...(changedFields ? { changedFields } : {}),
        },
      } satisfies TimelineEventDto;
    });

    // Inject synthetic CREATED at the end of this page (it's always the chronologically oldest event)
    if (syntheticOnThisPage) {
      events.push({
        id: `petition-created-${petitionId}`,
        entityType: 'PETITION',
        entityId: petitionId,
        entityLabel,
        eventType: 'CREATED',
        title: 'Được tạo',
        detail: null,
        actor: null,
        actedAt: petitionRecord.createdAt!,
        metadata: { hasDiff: false },
      });
    }

    const hasNextPage = skip + events.length < effectiveTotal;

    return {
      success: true,
      data: { events, total: effectiveTotal, hasNextPage, page, limit },
    };
  }
}
