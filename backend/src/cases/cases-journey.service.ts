import { Injectable } from '@nestjs/common';
import { CasesService } from './cases.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CASE_STATUS_LABEL,
  INCIDENT_STATUS_LABEL,
  PETITION_STATUS_LABEL,
} from '../common/constants/status-labels.constants';
import type { DataScope } from '../auth/services/unit-scope.service';
import type {
  TimelineEventDto,
  TimelineEntityType,
  TimelineEventType,
  JourneyResultDto,
} from './dto/timeline-event.dto';

// ─── Action → Event type mappings ────────────────────────────────────────────

const ACTION_TO_EVENT: Record<string, TimelineEventType> = {
  CASE_CREATED: 'CREATED',
  CASE_UPDATED: 'FIELD_UPDATE',
  CASE_DELETED: 'FIELD_UPDATE',
  PETITION_CREATED: 'CREATED',
  PETITION_UPDATED: 'FIELD_UPDATE',
  PETITION_DELETED: 'FIELD_UPDATE',
  PETITION_CONVERTED_TO_CASE: 'LINKED',
  PETITION_CONVERTED_TO_INCIDENT: 'LINKED',
  PETITION_ASSIGNED: 'FIELD_UPDATE',
  INCIDENT_CREATED: 'CREATED',
  INCIDENT_UPDATED: 'FIELD_UPDATE',
  CASE_LINKED_INCIDENT: 'LINKED',
};

const ACTION_TO_SUBJECT: Record<string, TimelineEntityType> = {
  CASE_CREATED: 'CASE',
  CASE_UPDATED: 'CASE',
  CASE_DELETED: 'CASE',
  PETITION_CREATED: 'PETITION',
  PETITION_UPDATED: 'PETITION',
  PETITION_DELETED: 'PETITION',
  PETITION_CONVERTED_TO_CASE: 'PETITION',
  PETITION_CONVERTED_TO_INCIDENT: 'PETITION',
  PETITION_ASSIGNED: 'PETITION',
  PETITION_ESCALATED_FROM_WARD: 'PETITION',
  INCIDENT_CREATED: 'INCIDENT',
  INCIDENT_UPDATED: 'INCIDENT',
};

const ENTITY_LABEL: Record<TimelineEntityType, string> = {
  CASE: 'Vụ việc',
  INCIDENT: 'Vụ án',
  PETITION: 'Đơn thư',
};

function buildActorName(user: { firstName: string; lastName: string } | null): string {
  if (!user) return 'Hệ thống';
  return `${user.lastName} ${user.firstName}`.trim();
}

function buildStatusLabel(status: string, entityType: TimelineEntityType): string {
  if (entityType === 'CASE') return (CASE_STATUS_LABEL as Record<string, string>)[status] ?? status;
  if (entityType === 'INCIDENT') return (INCIDENT_STATUS_LABEL as Record<string, string>)[status] ?? status;
  return (PETITION_STATUS_LABEL as Record<string, string>)[status] ?? status;
}

function buildAuditTitle(action: string, eventType: TimelineEventType): string {
  if (eventType === 'CREATED') return 'Được tạo';
  if (eventType === 'LINKED') return 'Liên kết';
  return 'Cập nhật';
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class CasesJourneyService {
  constructor(
    private readonly casesService: CasesService,
    private readonly prisma: PrismaService,
  ) {}

  async getJourney(
    caseId: string,
    userId: string,
    dataScope: DataScope | null,
    page: number,
    limit: number,
  ): Promise<{ success: true; data: JourneyResultDto }> {
    // Enforce DataScope — throws ForbiddenException if out of scope
    const caseResult = await this.casesService.getById(caseId, dataScope ?? undefined);
    const caseRecord = caseResult.data as {
      id: string;
      stt?: string;
      name?: string;
      petitions: Array<{ id: string; stt?: string }>;
      investigator?: { firstName: string; lastName: string } | null;
    };

    const petitionIds = caseRecord.petitions.map((p) => p.id);

    // Find linked incident (Incident.linkedCaseId → Case.id)
    const incident = await this.prisma.incident.findFirst({
      where: { linkedCaseId: caseId, deletedAt: null },
      select: { id: true, code: true },
    });

    const incidentId = incident?.id ?? null;

    // Parallel fetch (Promise.allSettled for graceful partial failure)
    const [caseHistoryResult, incidentHistoryResult, auditResult] = await Promise.allSettled([
      this.prisma.caseStatusHistory.findMany({
        where: { caseId },
        orderBy: { changedAt: 'asc' },
        include: {
          changedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        },
      }),
      incidentId
        ? this.prisma.incidentStatusHistory.findMany({
            where: { incidentId },
            orderBy: { createdAt: 'asc' },
            include: {
              changedBy: { select: { id: true, firstName: true, lastName: true, username: true } },
            },
          })
        : Promise.resolve([]),
      this.prisma.auditLog.findMany({
        where: {
          subjectId: { in: [caseId, ...petitionIds, ...(incidentId ? [incidentId] : [])] },
        },
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, username: true } },
        },
      }),
    ]);

    const caseHistory = caseHistoryResult.status === 'fulfilled' ? caseHistoryResult.value : [];
    const incidentHistory = incidentHistoryResult.status === 'fulfilled' ? incidentHistoryResult.value : [];
    const auditLogs = auditResult.status === 'fulfilled' ? auditResult.value : [];

    // Map CaseStatusHistory → TimelineEventDto
    const caseStatusEvents: TimelineEventDto[] = caseHistory.map((h) => {
      const from = buildStatusLabel(h.fromStatus, 'CASE');
      const to = buildStatusLabel(h.toStatus, 'CASE');
      return {
        id: `case-sh-${h.id}`,
        entityType: 'CASE',
        entityId: caseId,
        entityLabel: `Vụ việc ${caseRecord.stt ?? caseId}`,
        eventType: 'STATUS_CHANGE',
        title: `${from} → ${to}`,
        detail: null,
        actor: h.changedBy
          ? { id: h.changedBy.id, name: buildActorName(h.changedBy) }
          : null,
        actedAt: h.changedAt,
        metadata: {
          hasDiff: false,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
        },
      };
    });

    // Map IncidentStatusHistory → TimelineEventDto
    const incidentStatusEvents: TimelineEventDto[] = incidentHistory.map((h: any) => {
      const from = buildStatusLabel(h.fromStatus, 'INCIDENT');
      const to = buildStatusLabel(h.toStatus, 'INCIDENT');
      return {
        id: `incident-sh-${h.id}`,
        entityType: 'INCIDENT' as TimelineEntityType,
        entityId: incidentId!,
        entityLabel: `Vụ án ${incident?.code ?? incidentId}`,
        eventType: 'STATUS_CHANGE' as TimelineEventType,
        title: `${from} → ${to}`,
        detail: null,
        actor: h.changedBy
          ? { id: h.changedBy.id, name: buildActorName(h.changedBy) }
          : null,
        actedAt: h.createdAt,
        metadata: {
          hasDiff: false,
          fromStatus: h.fromStatus,
          toStatus: h.toStatus,
        },
      };
    });

    // Map AuditLog → TimelineEventDto
    const auditEvents: TimelineEventDto[] = auditLogs
      .map((log: any) => {
        // Determine entity type from subject field or action prefix
        const entityType: TimelineEntityType =
          ACTION_TO_SUBJECT[log.action] ??
          (log.subject === 'Case' ? 'CASE' :
           log.subject === 'Incident' ? 'INCIDENT' : 'PETITION');

        const eventType: TimelineEventType = ACTION_TO_EVENT[log.action] ?? 'FIELD_UPDATE';

        // Determine which petition this belongs to (for label)
        let entityLabel = `${ENTITY_LABEL[entityType]}`;
        if (entityType === 'CASE') {
          entityLabel = `Vụ việc ${caseRecord.stt ?? caseId}`;
        } else if (entityType === 'INCIDENT') {
          entityLabel = `Vụ án ${incident?.code ?? incidentId}`;
        } else {
          const pet = caseRecord.petitions.find((p) => p.id === log.subjectId);
          entityLabel = `Đơn thư ${pet?.stt ?? log.subjectId}`;
        }

        const meta = log.metadata as Record<string, any> | null;
        const hasDiff = !!(meta?.before);
        const changedFields = meta?.before
          ? Object.keys(meta.before as Record<string, unknown>)
          : undefined;

        return {
          id: `audit-${log.id}`,
          entityType,
          entityId: log.subjectId as string,
          entityLabel,
          eventType,
          title: buildAuditTitle(log.action as string, eventType),
          detail: null,
          actor: log.user
            ? { id: (log.user as any).id, name: buildActorName(log.user as any) }
            : null,
          actedAt: log.createdAt as Date,
          // Strip raw before/after — security: never expose field values
          metadata: {
            hasDiff,
            ...(changedFields ? { changedFields } : {}),
          },
        } satisfies TimelineEventDto;
      });

    // Merge all events
    const allEvents: TimelineEventDto[] = [
      ...caseStatusEvents,
      ...incidentStatusEvents,
      ...auditEvents,
    ];

    // Sort DESC by actedAt (newest first)
    allEvents.sort((a, b) => {
      const diff = new Date(b.actedAt).getTime() - new Date(a.actedAt).getTime();
      if (diff !== 0) return diff;
      // Tiebreaker: INCIDENT > CASE > PETITION
      const priority: Record<TimelineEntityType, number> = { INCIDENT: 0, CASE: 1, PETITION: 2 };
      return priority[a.entityType] - priority[b.entityType];
    });

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
