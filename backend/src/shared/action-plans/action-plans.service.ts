import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TienDoKhacPhuc } from '@prisma/client';
import { CreateActionPlanDto } from './dto/create-action-plan.dto';
import type { DataScope } from '../../auth/services/unit-scope.service';
import { assertParentInScope } from '../../common/utils/scope-filter.util';

const PARENT_SCOPE_SELECT = {
  id: true,
  assignedTeamId: true,
  investigatorId: true,
} as const;

@Injectable()
export class ActionPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async createForCase(
    caseId: string,
    dto: CreateActionPlanDto,
    userId: string,
    scope?: DataScope | null,
  ) {
    const parent = await this.loadCaseForScope(caseId);
    assertParentInScope(parent, scope, 'write');
    return this.prisma.suspensionActionPlan.create({
      data: {
        caseId,
        incidentId: null,
        ngayLap: new Date(dto.ngayLap),
        bienPhap: dto.bienPhap,
        thoiHan: dto.thoiHan ? new Date(dto.thoiHan) : null,
        tienDo: dto.tienDo ?? TienDoKhacPhuc.DANG_THUC_HIEN,
        ketQua: dto.ketQua,
        createdById: userId,
      },
    });
  }

  async createForIncident(
    incidentId: string,
    dto: CreateActionPlanDto,
    userId: string,
    scope?: DataScope | null,
  ) {
    const parent = await this.loadIncidentForScope(incidentId);
    assertParentInScope(parent, scope, 'write');
    return this.prisma.suspensionActionPlan.create({
      data: {
        incidentId,
        caseId: null,
        ngayLap: new Date(dto.ngayLap),
        bienPhap: dto.bienPhap,
        thoiHan: dto.thoiHan ? new Date(dto.thoiHan) : null,
        tienDo: dto.tienDo ?? TienDoKhacPhuc.DANG_THUC_HIEN,
        ketQua: dto.ketQua,
        createdById: userId,
      },
    });
  }

  async findAllForCase(caseId: string, scope?: DataScope | null) {
    const parent = await this.loadCaseForScope(caseId);
    assertParentInScope(parent, scope, 'read');
    return this.prisma.suspensionActionPlan.findMany({
      where: { caseId },
      orderBy: { ngayLap: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAllForIncident(incidentId: string, scope?: DataScope | null) {
    const parent = await this.loadIncidentForScope(incidentId);
    assertParentInScope(parent, scope, 'read');
    return this.prisma.suspensionActionPlan.findMany({
      where: { incidentId },
      orderBy: { ngayLap: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async delete(id: string, scope?: DataScope | null) {
    const record = await this.prisma.suspensionActionPlan.findUnique({
      where: { id },
      include: {
        case: { select: PARENT_SCOPE_SELECT },
        incident: { select: PARENT_SCOPE_SELECT },
      },
    });
    if (!record) throw new NotFoundException(`Kế hoạch khắc phục không tồn tại (id: ${id})`);
    assertParentInScope(record.case ?? record.incident ?? null, scope, 'write');
    return this.prisma.suspensionActionPlan.delete({ where: { id } });
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
