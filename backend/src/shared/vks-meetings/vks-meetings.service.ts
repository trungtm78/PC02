import { CaseChildAccessService } from '../../case-child-access/case-child-access.service';
import { CaseGovernanceService } from '../../cases/governance/case-governance.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVksMeetingDto } from './dto/create-vks-meeting.dto';
import type { DataScope } from '../../auth/services/unit-scope.service';
import { assertParentInScope } from '../../common/utils/scope-filter.util';

const PARENT_SCOPE_SELECT = {
  id: true,
  assignedTeamId: true,
  investigatorId: true,
} as const;

@Injectable()
export class VksMeetingsService {
  constructor(private readonly prisma: PrismaService) {}
  private get access() {
    return new CaseChildAccessService(
      this.prisma,
      new CaseGovernanceService(this.prisma),
    );
  }

  async createForCase(
    caseId: string,
    dto: CreateVksMeetingDto,
    userId: string,
    scope?: DataScope | null,
  ) {
    void scope;
    const parent = await this.loadCaseForScope(caseId);
    await this.access.read(caseId, userId);
    assertParentInScope(parent, await this.access.scope(userId), 'write');
    return this.access.write([caseId], userId, 'Case', 'write', async (tx) => {
      const result = await tx.vksMeetingRecord.create({
        data: {
          caseId,
          incidentId: null,
          ngayTrao: new Date(dto.ngayTrao),
          noiDung: dto.noiDung,
          soQuyetDinh: dto.soQuyetDinh,
          ketQua: dto.ketQua,
          createdById: userId,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          subject: 'Case',
          subjectId: caseId,
          action: 'CASE_VKS_MEETING_CREATED',
          metadata: { caseId, childId: result.id },
        },
      });
      return result;
    });
  }

  async createForIncident(
    incidentId: string,
    dto: CreateVksMeetingDto,
    userId: string,
    scope?: DataScope | null,
  ) {
    const parent = await this.loadIncidentForScope(incidentId);
    assertParentInScope(parent, scope, 'write');
    return this.prisma.vksMeetingRecord.create({
      data: {
        incidentId,
        caseId: null,
        ngayTrao: new Date(dto.ngayTrao),
        noiDung: dto.noiDung,
        soQuyetDinh: dto.soQuyetDinh,
        ketQua: dto.ketQua,
        createdById: userId,
      },
    });
  }

  async findAllForCase(
    caseId: string,
    scope?: DataScope | null,
    actorId?: string,
  ) {
    void scope;
    const parent = await this.loadCaseForScope(caseId);
    await this.access.entity('Case', 'read', actorId);
    await this.access.read(caseId, actorId);
    assertParentInScope(parent, await this.access.scope(actorId), 'read');
    return this.prisma.vksMeetingRecord.findMany({
      where: { caseId },
      orderBy: { ngayTrao: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAllForIncident(incidentId: string, scope?: DataScope | null) {
    const parent = await this.loadIncidentForScope(incidentId);
    assertParentInScope(parent, scope, 'read');
    return this.prisma.vksMeetingRecord.findMany({
      where: { incidentId },
      orderBy: { ngayTrao: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async delete(id: string, scope?: DataScope | null, actorId?: string) {
    const record = await this.prisma.vksMeetingRecord.findUnique({
      where: { id },
      include: {
        case: { select: PARENT_SCOPE_SELECT },
        incident: { select: PARENT_SCOPE_SELECT },
      },
    });
    if (!record)
      throw new NotFoundException(
        `Biên bản gặp gỡ VKS không tồn tại (id: ${id})`,
      );
    if (record.caseId) {
      assertParentInScope(
        record.case,
        await this.access.scope(actorId),
        'write',
      );
      return this.access.write(
        [record.caseId],
        actorId ?? '',
        'Case',
        'write',
        async (tx) => {
          const current = await tx.vksMeetingRecord.findUnique({
            where: { id },
          });
          if (!current || current.caseId !== record.caseId)
            throw new NotFoundException('Child parent changed');
          const result = await tx.vksMeetingRecord.delete({ where: { id } });
          await tx.auditLog.create({
            data: {
              userId: actorId,
              subject: 'Case',
              subjectId: record.caseId,
              action: 'CASE_VKS_MEETING_DELETED',
              metadata: { caseId: record.caseId, childId: id },
            },
          });
          return result;
        },
      );
    }
    assertParentInScope(record.incident, scope, 'write');
    return this.prisma.vksMeetingRecord.delete({ where: { id } });
  }

  private async loadCaseForScope(caseId: string) {
    const parent = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: PARENT_SCOPE_SELECT,
    });
    if (!parent)
      throw new NotFoundException(`Vụ án không tồn tại (id: ${caseId})`);
    return parent;
  }

  private async loadIncidentForScope(incidentId: string) {
    const parent = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: PARENT_SCOPE_SELECT,
    });
    if (!parent)
      throw new NotFoundException(`Vụ việc không tồn tại (id: ${incidentId})`);
    return parent;
  }
}
