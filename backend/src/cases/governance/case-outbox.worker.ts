import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  HttpException,
} from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseGovernanceService } from './case-governance.service';
import { CaseEvidenceGovernanceService } from '../evidence-governance/evidence-governance.service';
@Injectable()
export class CaseOutboxWorker {
  private readonly logger = new Logger(CaseOutboxWorker.name);
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: CaseGovernanceService,
    @Optional() private readonly evidence?: CaseEvidenceGovernanceService,
  ) {}
  private async recipient(
    tx: Prisma.TransactionClient,
    row: { caseId: string; recipientId: string; event: Prisma.JsonValue },
  ): Promise<{ link: string; metadata?: Prisma.InputJsonObject } | null> {
    try {
      await this.core.assertCaseReadable(tx, row.caseId, {
        actorId: row.recipientId,
      });
      return { link: '/cases/' + encodeURIComponent(row.caseId) };
    } catch (error) {
      if (
        !(error instanceof ForbiddenException) &&
        !(error instanceof NotFoundException)
      )
        throw error;
    }
    const event =
      row.event && typeof row.event === 'object' && !Array.isArray(row.event)
        ? row.event
        : {};
    if (event.type === 'HANDOFF_SENT' && typeof event.handoffId === 'string') {
      try {
        const inbox = await new CaseGovernanceService(
          tx as unknown as PrismaService,
        ).handoffInbox({ actorId: row.recipientId });
        if (
          inbox.data.some(
            (item) => item.id === event.handoffId && item.caseId === row.caseId,
          )
        )
          return {
            link: '/cases/handoffs/inbox',
            metadata: { handoffId: event.handoffId, caseId: row.caseId },
          };
      } catch (error) {
        if (
          !(error instanceof ForbiddenException) &&
          !(error instanceof NotFoundException)
        )
          throw error;
      }
    }
    if (
      event.operation === 'EVIDENCE_PACKET_REVIEW' &&
      typeof event.aggregateId === 'string' &&
      this.evidence
    ) {
      try {
        const proof = await this.evidence.assertPacketNotificationRecipient(
          tx,
          event.aggregateId,
          { actorId: row.recipientId },
        );
        if (proof.caseId !== row.caseId) return null;
        return {
          link:
            '/cases/' +
            encodeURIComponent(proof.caseId) +
            '/disclosures/' +
            encodeURIComponent(proof.packetId),
          metadata: {
            ...proof,
            operation: 'EVIDENCE_PACKET_REVIEW',
            aggregateId: proof.packetId,
          },
        };
      } catch (error) {
        if (
          !(error instanceof HttpException) ||
          ![400, 403, 404, 409].includes(error.getStatus())
        )
          throw error;
      }
    }
    return null;
  }
  @Interval(10000)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.drain(20);
    } catch {
      this.logger.warn('Internal Case outbox poll failed; retained for retry');
    } finally {
      this.running = false;
    }
  }
  async drain(limit = 20, now = new Date()) {
    const candidates = await this.prisma.caseGovernanceOutbox.findMany({
      where: {
        nextAttemptAt: { lte: now },
        OR: [
          { status: 'PENDING' },
          { status: 'PROCESSING', leaseUntil: { lte: now } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: Math.max(1, Math.min(100, limit)),
    });
    let delivered = 0;
    for (const candidate of candidates) {
      const token = randomUUID(),
        leaseUntil = new Date(now.getTime() + 60000);
      const claim = await this.prisma.caseGovernanceOutbox.updateMany({
        where: {
          id: candidate.id,
          nextAttemptAt: { lte: now },
          OR: [
            { status: 'PENDING' },
            { status: 'PROCESSING', leaseUntil: { lte: now } },
          ],
        },
        data: {
          status: 'PROCESSING',
          leaseToken: token,
          leaseUntil,
          attempts: { increment: 1 },
        },
      });
      if (claim.count !== 1) continue;
      try {
        if (await this.deliver(candidate.id, token, now)) delivered++;
      } catch {
        const attempt = candidate.attempts + 1;
        await this.prisma.caseGovernanceOutbox.updateMany({
          where: { id: candidate.id, status: 'PROCESSING', leaseToken: token },
          data: {
            status: attempt >= 10 ? 'DEAD_LETTER' : 'PENDING',
            leaseToken: null,
            leaseUntil: null,
            nextAttemptAt: new Date(
              now.getTime() + Math.min(3600000, 1000 * 2 ** attempt),
            ),
          },
        });
      }
    }
    return { delivered, considered: candidates.length };
  }
  async deliver(id: string, token: string, now = new Date()): Promise<boolean> {
    return this.prisma.$transaction(
      async (tx) => {
        const row = await tx.caseGovernanceOutbox.findFirst({
          where: {
            id,
            status: 'PROCESSING',
            leaseToken: token,
            leaseUntil: { gt: now },
          },
        });
        if (!row) return false;
        const authority = await this.recipient(tx, row);
        if (!authority) {
          const result = await tx.caseGovernanceOutbox.updateMany({
            where: { id, status: 'PROCESSING', leaseToken: token },
            data: { status: 'SUPPRESSED', leaseToken: null, leaseUntil: null },
          });
          if (result.count !== 1)
            throw new ConflictException('Outbox lease changed');
          return false;
        }
        const notificationId = 'case-governance-' + row.id;
        let notification = await tx.notification.findUnique({
          where: { id: notificationId },
        });
        if (!notification)
          notification = await tx.notification.create({
            data: {
              id: notificationId,
              userId: row.recipientId,
              type: 'SYSTEM',
              title: 'Case workflow update',
              message: 'An authorized Case workflow requires your attention.',
              link: authority.link,
              metadata: {
                caseId: row.caseId,
                outboxId: row.id,
                operationId: row.operationId,
                ...authority.metadata,
              },
              pushNextRetryAt: null,
            },
          });
        if (notification.userId !== row.recipientId)
          throw new ConflictException('Notification deduplication mismatch');
        const changed = await tx.caseGovernanceOutbox.updateMany({
          where: {
            id,
            status: 'PROCESSING',
            leaseToken: token,
            leaseUntil: { gt: now },
          },
          data: {
            status: 'DELIVERED',
            notificationId: notification.id,
            deliveredAt: now,
            leaseToken: null,
            leaseUntil: null,
          },
        });
        if (changed.count !== 1)
          throw new ConflictException('Outbox lease changed');
        return true;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
