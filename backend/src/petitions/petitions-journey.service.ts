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

const AUDIT_LOG_FETCH_LIMIT = 500;

function buildActorName(user: { firstName: string | null; lastName: string | null } | null): string {
  if (!user) return 'Hệ thống';
  return `${user.lastName} ${user.firstName}`.trim();
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

    const auditLogs = await this.prisma.auditLog.findMany({
      where: { subjectId: petitionId },
      orderBy: { createdAt: 'desc' },
      take: AUDIT_LOG_FETCH_LIMIT,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
    });

    const entityLabel = `Đơn thư ${petitionRecord.stt ?? petitionId}`;

    const auditEvents: TimelineEventDto[] = auditLogs.map((log: any) => {
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

    // Inject synthetic CREATED event when no PETITION_CREATED audit log exists
    const hasPetitionCreatedLog = auditEvents.some((e) => e.eventType === 'CREATED');
    if (!hasPetitionCreatedLog && petitionRecord.createdAt) {
      auditEvents.push({
        id: `petition-created-${petitionId}`,
        entityType: 'PETITION',
        entityId: petitionId,
        entityLabel,
        eventType: 'CREATED',
        title: 'Được tạo',
        detail: null,
        actor: null,
        actedAt: petitionRecord.createdAt,
        metadata: { hasDiff: false },
      });
    }

    // Sort DESC by actedAt
    auditEvents.sort((a, b) => new Date(b.actedAt).getTime() - new Date(a.actedAt).getTime());

    const total = auditEvents.length;
    const skip = (page - 1) * limit;
    const events = auditEvents.slice(skip, skip + limit);
    const hasNextPage = total > skip + limit;

    return {
      success: true,
      data: { events, total, hasNextPage, page, limit },
    };
  }
}
