import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class EventCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.eventCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.eventCategory.findUnique({ where: { id } });
  }

  async create(dto: CreateCategoryDto) {
    const existing = await this.prisma.eventCategory.findFirst({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" đã tồn tại`);
    }
    return this.prisma.eventCategory.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        color: dto.color,
        icon: dto.icon ?? null,
        sortOrder: dto.sortOrder ?? 100,
        isSystem: false, // user-created categories are never system
      },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.eventCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Danh mục ${id} không tồn tại`);
    }
    // Strict whitelist — silently drop slug/isSystem even if caller sends them.
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.icon !== undefined) data.icon = dto.icon;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    return this.prisma.eventCategory.update({ where: { id }, data });
  }

  async remove(id: string) {
    const existing = await this.prisma.eventCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Danh mục ${id} không tồn tại`);
    }
    if (existing.isSystem) {
      throw new ForbiddenException('Không xóa được danh mục hệ thống');
    }
    const eventCount = await this.prisma.calendarEvent.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (eventCount > 0) {
      throw new ConflictException(
        `Danh mục đang được dùng bởi ${eventCount} sự kiện. Gán lại sang danh mục khác trước khi xóa.`,
      );
    }
    return this.prisma.eventCategory.delete({ where: { id } });
  }
}
