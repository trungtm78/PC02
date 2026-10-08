import {
  Injectable,
  Optional,
  ForbiddenException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CaseGovernanceService } from '../cases/governance/case-governance.service';
import { CaseFieldSchemaService } from '../cases/governance/case-field-schema.service';
import { CaseEvidenceGovernanceService } from '../cases/evidence-governance/evidence-governance.service';

type Notice = Omit<Partial<Notification>, 'metadata'> & { metadata?: unknown };
@Injectable()
export class CaseNotificationPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly evidence?: CaseEvidenceGovernanceService,
  ) {}
  private metadata(notice: Notice): Record<string, unknown> {
    return notice.metadata &&
      typeof notice.metadata === 'object' &&
      !Array.isArray(notice.metadata)
      ? (notice.metadata as Record<string, unknown>)
      : {};
  }
  private async reference(notice: Notice) {
    const metadata = this.metadata(notice);
    const linked = notice.link?.match(/^\/cases\/([^/?#]+)/)?.[1];
    const caseId =
      typeof metadata.caseId === 'string' ? metadata.caseId : linked;
    const packetId =
      typeof metadata.packetId === 'string'
        ? metadata.packetId
        : metadata.operation === 'EVIDENCE_PACKET_REVIEW' &&
            typeof metadata.aggregateId === 'string'
          ? metadata.aggregateId
          : undefined;
    if (caseId) return { caseId, packetId };
    if (packetId) {
      const packet = await this.prisma.caseDisclosurePacket.findUnique({
        where: { id: packetId },
        select: { caseId: true },
      });
      return { caseId: packet?.caseId, packetId };
    }
    return { caseId: undefined, packetId: undefined };
  }
  async serialize<T extends Notice>(
    actorId: string,
    notice: T,
  ): Promise<T | null> {
    const { caseId, packetId } = await this.reference(notice);
    if (!caseId && !packetId && !String(notice.type ?? '').startsWith('CASE_'))
      return notice;
    const core = new CaseGovernanceService(this.prisma);
    try {
      if (!caseId)
        throw new ForbiddenException(
          'Case notification provenance unavailable',
        );
      const record = await core.assertCaseReadable(this.prisma, caseId, {
        actorId,
      });
      const fields = new CaseFieldSchemaService(this.prisma, core);
      const eligible = await fields.readableNativeWhere(
        this.prisma,
        { actorId },
        ['createdAt'],
      );
      if (
        !(await this.prisma.case.count({
          where: { AND: [eligible, { id: caseId }] },
        }))
      )
        throw new ForbiddenException('Case notification clock is protected');
      const identity = await core.serializeCaseResult(
        this.prisma,
        caseId,
        { caseCode: record.caseCode },
        { actorId },
      );
      return {
        ...notice,
        title: 'Cập nhật hồ sơ',
        message: identity.caseCode
          ? `Hồ sơ ${identity.caseCode} có cập nhật`
          : 'Hồ sơ có cập nhật',
        link: `/cases/${caseId}`,
        metadata: { caseId },
      } as T;
    } catch (error) {
      if (
        !(error instanceof ForbiddenException) &&
        !(error instanceof NotFoundException)
      )
        throw error;
      const handoffId = this.metadata(notice).handoffId;
      if (typeof handoffId === 'string') {
        try {
          const inbox = await core.handoffInbox({ actorId });
          const eligible = inbox.data.find(
            (row) => row.id === handoffId && (!caseId || row.caseId === caseId),
          );
          if (eligible)
            return {
              ...notice,
              title: 'Hồ sơ chờ tiếp nhận',
              message: 'Có hồ sơ đang chờ tiếp nhận trong hộp thư của tổ',
              link: '/cases/handoffs/inbox',
              metadata: { caseId: eligible.caseId, handoffId },
            } as T;
        } catch (receiptError) {
          if (
            !(receiptError instanceof HttpException) ||
            ![400, 403, 404, 409].includes(receiptError.getStatus())
          )
            throw receiptError;
        }
      }
      if (!packetId || !this.evidence) return null;
      try {
        const approved = await this.evidence.assertPacketNotificationRecipient(
          this.prisma,
          packetId,
          { actorId },
        );
        return {
          ...notice,
          title: 'Gói tài liệu đã được duyệt',
          message: 'Gói tài liệu được phép tải đang sẵn sàng',
          link: `/cases/${approved.caseId}/disclosures/${approved.packetId}`,
          metadata: approved,
        } as T;
      } catch (packetError) {
        if (
          packetError instanceof HttpException &&
          [400, 403, 404, 409].includes(packetError.getStatus())
        )
          return null;
        throw packetError;
      }
    }
  }
  async where(actorId: string): Promise<Prisma.NotificationWhereInput> {
    const candidates = await this.prisma.notification.findMany({
      where: { userId: actorId },
      select: { id: true, type: true, metadata: true, link: true },
    });
    const blocked: string[] = [];
    for (const candidate of candidates)
      if (!(await this.serialize(actorId, candidate)))
        blocked.push(candidate.id);
    return {
      userId: actorId,
      ...(blocked.length ? { id: { notIn: blocked } } : {}),
    };
  }
}
