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

  async createForCase(
    caseId: string,
    dto: CreateVksMeetingDto,
    userId: string,
    scope?: DataScope | null,
  ) {
    const parent = await this.loadCaseForScope(caseId);
    assertParentInScope(parent, scope, 'write');
    return this.prisma.vksMeetingRecord.create({
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

  async findAllForCase(caseId: string, scope?: DataScope | null) {
    const parent = await this.loadCaseForScope(caseId);
    assertParentInScope(parent, scope, 'read');
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

  async delete(id: string, scope?: DataScope | null) {
    const record = await this.prisma.vksMeetingRecord.findUnique({
      where: { id },
      include: {
        case: { select: PARENT_SCOPE_SELECT },
        incident: { select: PARENT_SCOPE_SELECT },
      },
    });
    if (!record) throw new NotFoundException(`Biên bản gặp gỡ VKS không tồn tại (id: ${id})`);
    assertParentInScope(record.case ?? record.incident ?? null, scope, 'write');
    return this.prisma.vksMeetingRecord.delete({ where: { id } });
  }

  private async loadCaseForScope(caseId: string) {
    const parent = await this.prisma.case.findUnique({
      where: { id: caseId },
      select: PARENT_SCOPE_SELECT,
    });
    if (!parent) throw new NotFoundException(`Vụ án không tồn tại (id: ${caseId})`);
    return parent;
  }

  private async loadIncidentForScope(incidentId: string) {
    const parent = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: PARENT_SCOPE_SELECT,
    });
    if (!parent) throw new NotFoundException(`Vụ việc không tồn tại (id: ${incidentId})`);
    return parent;
  }
}
