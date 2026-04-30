import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TienDoKhacPhuc } from '@prisma/client';
import { CreateActionPlanDto } from './dto/create-action-plan.dto';

@Injectable()
export class ActionPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async createForCase(caseId: string, dto: CreateActionPlanDto, userId: string) {
    await this.assertCaseExists(caseId);
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

  async createForIncident(incidentId: string, dto: CreateActionPlanDto, userId: string) {
    await this.assertIncidentExists(incidentId);
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

  async findAllForCase(caseId: string) {
    await this.assertCaseExists(caseId);
    return this.prisma.suspensionActionPlan.findMany({
      where: { caseId },
      orderBy: { ngayLap: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAllForIncident(incidentId: string) {
    await this.assertIncidentExists(incidentId);
    return this.prisma.suspensionActionPlan.findMany({
      where: { incidentId },
      orderBy: { ngayLap: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async delete(id: string) {
    const record = await this.prisma.suspensionActionPlan.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Kế hoạch khắc phục không tồn tại (id: ${id})`);
    return this.prisma.suspensionActionPlan.delete({ where: { id } });
  }

  private async assertCaseExists(caseId: string) {
    const exists = await this.prisma.case.findUnique({ where: { id: caseId }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Vụ án không tồn tại (id: ${caseId})`);
  }

  private async assertIncidentExists(incidentId: string) {
    const exists = await this.prisma.incident.findUnique({ where: { id: incidentId }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Vụ việc không tồn tại (id: ${incidentId})`);
  }
}
