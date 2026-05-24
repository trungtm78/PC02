import { Injectable } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  INCIDENT_STATUS_LABEL,
} from '../common/constants/status-labels.constants';
import type { DataScope } from '../auth/services/unit-scope.service';
import type {
  TimelineEventDto,
  TimelineEventType,
  JourneyResultDto,
} from '../cases/dto/timeline-event.dto';

const SAFE_CHANGED_FIELDS = new Set([
  'status', 'incidentType', 'assignedTeamId', 'investigatorId', 'deadline',
  'description', 'name', 'capDoToiPham', 'unit',
]);

const ACTION_TO_EVENT: Record<string, TimelineEventType> = {
  INCIDENT_CREATED: 'CREATED',
  INCIDENT_UPDATED: 'FIELD_UPDATE',
  INCIDENT_AUTO_CREATED: 'CREATED',
  INCIDENT_DELETED: 'FIELD_UPDATE',
  CASE_LINKED_INCIDENT: 'LINKED',
};

const AUDIT_LOG_FETCH_LIMIT = 500;

function buildActorName(user: { firstName: string | null; lastName: string | null } | null): string {
  if (!user) return 'Hệ thống';
  return `${user.lastName} ${user.firstName}`.trim();
}

function buildStatusLabel(status: string): string {
  return (INCIDENT_STATUS_LABEL as Record<string, string>)[status] ?? status;
}

@Injectable()
export class IncidentsJourneyService {
  constructor(
    private readonly incidentsService: IncidentsService,
    private readonly prisma: PrismaService,
  ) {}

  async getJourney(
    incidentId: string,
    dataScope: DataScope | null,
    page: number,
    limit: number,
  ): Promise<{ success: true; data: JourneyResultDto }> {
    // Enforce DataScope — throws ForbiddenException if out of scope
    const incidentResult = await this.incidentsService.getById(incidentId, dataScope ?? undefined);
    const incidentRecord = incidentResult.data as {
      id: string;
      code?: string;
      createdAt?: Date;
      investigatorId?: string | null;
    };

    const entityLabel = `Vụ án ${incidentRecord.code ?? incidentId}`;

    // Parallel fetch: status history + audit logs
    const [statusHistoryResult, auditResult] = await Promise.allSettled([
      this.prisma.incidentStatusHistory.findMany({
        where: { incidentId },
        orderBy: { createdAt: 'asc' },
        include: {
          changedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        },
      }),
      this.prisma.auditLog.findMany({
        where: { subjectId: incidentId },
        orderBy: { createdAt: 'desc' },
        take: AUDIT_LOG_FETCH_LIMIT,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, username: true } },
        },
      }),
    ]);

    const statusHistory = statusHistoryResult.status === 'fulfilled' ? statusHistoryResult.value : [];
    const auditLogs = auditResult.status === 'fulfilled' ? auditResult.value : [];

    // Map IncidentStatusHistory → TimelineEventDto
    const statusEvents: TimelineEventDto[] = (statusHistory as any[]).map((h) => {
      const from = buildStatusLabel(h.fromStatus ?? '');
      const to = buildStatusLabel(h.toStatus ?? '');
      return {
        id: `incident-sh-${h.id}`,
        entityType: 'INCIDENT',
        entityId: incidentId,
        entityLabel,
        eventType: 'STATUS_CHANGE',
        title: `${from} → ${to}`,
        detail: null,
        actor: h.changedBy
          ? { id: h.changedBy.id, name: buildActorName(h.changedBy) }
          : null,
        actedAt: h.createdAt as Date,
        metadata: {
          hasDiff: false,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
        },
      } satisfies TimelineEventDto;
    });

    // Map AuditLog → TimelineEventDto
    const auditEvents: TimelineEventDto[] = (auditLogs as any[]).map((log) => {
      const eventType: TimelineEventType = ACTION_TO_EVENT[log.action as string] ?? 'FIELD_UPDATE';
      const meta = log.metadata as Record<string, any> | null;
      const hasDiff = !!(meta?.before);
      const changedFields = meta?.before
        ? Object.keys(meta.before as Record<string, unknown>).filter((f) => SAFE_CHANGED_FIELDS.has(f))
        : undefined;

      return {
        id: `audit-${log.id}`,
        entityType: 'INCIDENT',
        entityId: incidentId,
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

    // Merge all events
    const allEvents: TimelineEventDto[] = [...statusEvents, ...auditEvents];

    // Inject synthetic CREATED event when no INCIDENT_CREATED audit log exists
    const hasIncidentCreatedLog = auditEvents.some((e) => e.eventType === 'CREATED');
    if (!hasIncidentCreatedLog && incidentRecord.createdAt) {
      allEvents.push({
        id: `incident-created-${incidentId}`,
        entityType: 'INCIDENT',
        entityId: incidentId,
        entityLabel,
        eventType: 'CREATED',
        title: 'Được tạo',
        detail: null,
        actor: null,
        actedAt: incidentRecord.createdAt,
        metadata: { hasDiff: false },
      });
    }

    // Sort DESC by actedAt
    allEvents.sort((a, b) => new Date(b.actedAt).getTime() - new Date(a.actedAt).getTime());

    const total = allEvents.length;
    const skip = (page - 1) * limit;
    const events = allEvents.slice(skip, skip + limit);
    const hasNextPage = total > skip + limit;

    return {
      success: true,
      data: { events, total, hasNextPage, page, limit },
    };
  }
}
