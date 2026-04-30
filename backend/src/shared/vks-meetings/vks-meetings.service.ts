import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVksMeetingDto } from './dto/create-vks-meeting.dto';

@Injectable()
export class VksMeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForCase(caseId: string, dto: CreateVksMeetingDto, userId: string) {
    await this.assertCaseExists(caseId);
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

  async createForIncident(incidentId: string, dto: CreateVksMeetingDto, userId: string) {
    await this.assertIncidentExists(incidentId);
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

  async findAllForCase(caseId: string) {
    await this.assertCaseExists(caseId);
    return this.prisma.vksMeetingRecord.findMany({
      where: { caseId },
      orderBy: { ngayTrao: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async findAllForIncident(incidentId: string) {
    await this.assertIncidentExists(incidentId);
    return this.prisma.vksMeetingRecord.findMany({
      where: { incidentId },
      orderBy: { ngayTrao: 'desc' },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async delete(id: string) {
    const record = await this.prisma.vksMeetingRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException(`Biên bản gặp gỡ VKS không tồn tại (id: ${id})`);
    return this.prisma.vksMeetingRecord.delete({ where: { id } });
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
