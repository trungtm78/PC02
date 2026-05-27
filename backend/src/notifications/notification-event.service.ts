import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationSseService } from './notification-sse.service';
import { RecipientResolverService } from './recipient-resolver.service';
import { nextWorkHoursTime } from './work-hours.util';
import {
  CaseAssignedEvent,
  CaseCreatedEvent,
  CaseStatusChangedEvent,
  IncidentAssignedEvent,
  IncidentCreatedEvent,
  PetitionAssignedEvent,
  PetitionReceivedEvent,
  UydtAssignedEvent,
} from './events/notification.events';

@Injectable()
export class NotificationEventService {
  private readonly logger = new Logger(NotificationEventService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sse: NotificationSseService,
    private readonly recipients: RecipientResolverService,
  ) {}

  @OnEvent('case.assigned', { async: true })
  async onCaseAssigned(event: CaseAssignedEvent): Promise<void> {
    try {
      await this.sendInApp({
        toUserId: event.toUserId,
        type: NotificationType.CASE_ASSIGNED,
        title: 'Bạn được phân công vụ án mới',
        message: `Vụ án ${event.caseCode} vừa được giao cho bạn bởi ${event.byUserName}`,
        link: `/cases/${event.caseId}`,
        metadata: { caseId: event.caseId },
      });
    } catch (err) {
      this.logger.error('onCaseAssigned failed', err);
    }
  }

  @OnEvent('incident.assigned', { async: true })
  async onIncidentAssigned(event: IncidentAssignedEvent): Promise<void> {
    try {
      await this.sendInApp({
        toUserId: event.toUserId,
        type: NotificationType.INCIDENT_ASSIGNED,
        title: 'Bạn được phân công vụ việc mới',
        message: `Vụ việc ${event.incidentName} vừa được giao cho bạn bởi ${event.byUserName}`,
        link: `/incidents/${event.incidentId}`,
        metadata: { incidentId: event.incidentId },
      });
    } catch (err) {
      this.logger.error('onIncidentAssigned failed', err);
    }
  }

  @OnEvent('petition.assigned', { async: true })
  async onPetitionAssigned(event: PetitionAssignedEvent): Promise<void> {
    try {
      await this.sendInApp({
        toUserId: event.toUserId,
        type: NotificationType.PETITION_ASSIGNED,
        title: 'Bạn được phân công đơn thư mới',
        message: `Đơn thư "${event.petitionTitle}" vừa được giao cho bạn bởi ${event.byUserName}`,
        link: `/petitions/${event.petitionId}`,
        metadata: { petitionId: event.petitionId },
      });
    } catch (err) {
      this.logger.error('onPetitionAssigned failed', err);
    }
  }

  @OnEvent('utdt.assigned', { async: true })
  async onUydtAssigned(event: UydtAssignedEvent): Promise<void> {
    try {
      const targets = [event.toUserId, ...event.toLeaderUserIds].filter(Boolean);
      await Promise.all(
        targets.map((uid) =>
          this.sendInApp({
            toUserId: uid,
            type: NotificationType.UTDT_ASSIGNED,
            title: 'Ủy thác điều tra mới',
            message: `UTDT "${event.delegationTitle}" đã được phân công bởi ${event.byUserName}`,
            link: `/delegations/${event.delegationId}`,
            metadata: { delegationId: event.delegationId },
          }),
        ),
      );
    } catch (err) {
      this.logger.error('onUydtAssigned failed', err);
    }
  }

  @OnEvent('case.created', { async: true })
  async onCaseCreated(event: CaseCreatedEvent): Promise<void> {
    try {
      const leaderIds = await this.recipients.getAllHeadUnits();
      await Promise.all(
        leaderIds.map((uid) =>
          this.sendInApp({
            toUserId: uid,
            type: NotificationType.CASE_ASSIGNED,
            title: 'Vụ án mới được tạo',
            message: `Vụ án ${event.caseCode} vừa được tạo trong hệ thống`,
            link: `/cases/${event.caseId}`,
            metadata: { caseId: event.caseId },
          }),
        ),
      );
    } catch (err) {
      this.logger.error('onCaseCreated failed', err);
    }
  }

  // ── Stub handlers — implement in next sprint (D12) ─────────────────────

  @OnEvent('case.status_changed', { async: true })
  async onCaseStatusChanged(event: CaseStatusChangedEvent): Promise<void> {
    this.logger.debug(`case.status_changed stub: ${event.caseCode}`);
  }

  @OnEvent('petition.received', { async: true })
  async onPetitionReceived(event: PetitionReceivedEvent): Promise<void> {
    this.logger.debug(`petition.received stub: ${event.petitionId}`);
  }

  @OnEvent('incident.created', { async: true })
  async onIncidentCreated(event: IncidentCreatedEvent): Promise<void> {
    this.logger.debug(`incident.created stub: ${event.incidentId}`);
  }

  // ── Shared helper ──────────────────────────────────────────────────────

  private async sendInApp(payload: {
    toUserId: string;
    type: NotificationType;
    title: string;
    message: string;
    link: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const pref = await this.getPref(payload.toUserId, payload.type);
    if (!pref.inApp) return;

    await this.prisma.notification.create({
      data: {
        userId: payload.toUserId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        link: payload.link,
        metadata: (payload.metadata ?? Prisma.JsonNull) as any,
        pushNextRetryAt: pref.push ? nextWorkHoursTime() : null,
        pushMaxRetries: 3,
      },
    });

    this.sse.notifyUser(payload.toUserId);
  }

  private async getPref(userId: string, type: NotificationType) {
    return (
      (await this.prisma.notificationPreference.findUnique({
        where: { userId_eventType: { userId, eventType: type } },
      })) ?? { inApp: true, push: true, email: false }
    );
  }
}
