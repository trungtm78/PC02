import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueryCrimesDto } from './dto/query-crimes.dto';

@Injectable()
export class CrimesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryCrimesDto) {
    const {
      pc02Only = true,
      search,
      chapter,
      isActive = true,
      limit = 500,
      offset = 0,
    } = query;

    const where: Record<string, unknown> = {};
    if (isActive !== undefined) where.isActive = isActive;
    if (chapter) where.chapter = chapter;

    if (search) {
      // Khi tìm kiếm: BỎ lọc PC02 — tìm trên toàn bộ 316 điều để không "gõ đúng nhưng không ra".
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    } else if (pc02Only) {
      where.pc02Relevant = true;
    }

    const [data, total] = await Promise.all([
      this.prisma.crime.findMany({
        where,
        orderBy: { order: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.crime.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  async findOne(id: string) {
    const crime = await this.prisma.crime.findUnique({ where: { id } });
    if (!crime) throw new NotFoundException(`Tội danh #${id} không tồn tại`);
    return crime;
  }
}
