import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
