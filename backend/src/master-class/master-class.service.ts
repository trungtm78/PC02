import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { MASTER_CLASS_TYPES, MASTER_CLASS_TYPE_CODES } from '../common/constants/master-class-types';
import { CreateMasterClassDto } from './dto/create-master-class.dto';
import { UpdateMasterClassDto } from './dto/update-master-class.dto';
import { QueryMasterClassDto } from './dto/query-master-class.dto';

@Injectable()
export class MasterClassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  getTypes() {
    return {
      data: Object.entries(MASTER_CLASS_TYPES).map(([code, name]) => ({
        code,
        name,
      })),
    };
  }

  async getList(query: QueryMasterClassDto) {
    const { type, search, isActive, limit = 200, offset = 0 } = query;

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.masterClass.findMany({
        where,
        orderBy: [{ order: 'asc' }, { code: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.masterClass.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  async getById(id: string) {
    const record = await this.prisma.masterClass.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Không tìm thấy bản ghi');
    return { data: record };
  }

  async create(dto: CreateMasterClassDto, actorId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    if (!MASTER_CLASS_TYPE_CODES.includes(dto.type)) {
      throw new BadRequestException(`Type "${dto.type}" không hợp lệ`);
    }

    const existing = await this.prisma.masterClass.findUnique({
      where: { type_code: { type: dto.type, code: dto.code } },
    });
    if (existing) {
      throw new ConflictException(`Code "${dto.code}" đã tồn tại trong type "${dto.type}"`);
    }

    const record = await this.prisma.masterClass.create({
      data: {
        type: dto.type,
        code: dto.code.toUpperCase(),
        name: dto.name,
        order: dto.order ?? 0,
        isActive: dto.isActive ?? true,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'MASTER_CLASS_CREATED',
      subject: 'MasterClass',
      subjectId: record.id,
      metadata: { type: dto.type, code: dto.code, name: dto.name },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { data: record, message: 'Tạo thành công' };
  }

  async update(id: string, dto: UpdateMasterClassDto, actorId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    const existing = await this.prisma.masterClass.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy bản ghi');

    if (dto.code && dto.code !== existing.code) {
      const dup = await this.prisma.masterClass.findUnique({
        where: { type_code: { type: existing.type, code: dto.code } },
      });
      if (dup) throw new ConflictException(`Code "${dto.code}" đã tồn tại`);
    }

    const record = await this.prisma.masterClass.update({
      where: { id },
      data: {
        ...(dto.code !== undefined && { code: dto.code.toUpperCase() }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'MASTER_CLASS_UPDATED',
      subject: 'MasterClass',
      subjectId: id,
      metadata: { changes: dto },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { data: record, message: 'Cập nhật thành công' };
  }

  async delete(id: string, actorId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    const existing = await this.prisma.masterClass.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Không tìm thấy bản ghi');

    await this.prisma.masterClass.delete({ where: { id } });

    await this.audit.log({
      userId: actorId,
      action: 'MASTER_CLASS_DELETED',
      subject: 'MasterClass',
      subjectId: id,
      metadata: { type: existing.type, code: existing.code, name: existing.name },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { message: 'Xóa thành công' };
  }
}
