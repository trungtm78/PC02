import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressMappingDto } from './dto/create-address-mapping.dto';
import { QueryAddressMappingDto, LookupAddressMappingDto } from './dto/query-address-mapping.dto';

@Injectable()
export class AddressMappingService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryAddressMappingDto) {
    const { province, search, needsReview, isActive, limit = 50, offset = 0 } = query;
    const where: Record<string, unknown> = {};
    if (province) where.province = province;
    if (needsReview !== undefined) where.needsReview = needsReview;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { oldWard: { contains: search.toLowerCase(), mode: 'insensitive' } },
        { oldDistrict: { contains: search.toLowerCase(), mode: 'insensitive' } },
        { newWard: { contains: search.toLowerCase(), mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.addressMapping.findMany({ where, orderBy: [{ province: 'asc' }, { oldDistrict: 'asc' }, { oldWard: 'asc' }], take: limit, skip: offset }),
      this.prisma.addressMapping.count({ where }),
    ]);
    return { data, total, limit, offset };
  }

  /** Tra cứu mapping cho F10 hotkey — case-insensitive, với district-level fallback */
  async lookup(dto: LookupAddressMappingDto) {
    const { ward, district, province = 'HCM' } = dto;
    const districtNorm = district.toLowerCase().trim();
    const wardNorm = ward.toLowerCase().trim();

    // Bước 1: Exact match (oldWard + oldDistrict)
    const exact = await this.prisma.addressMapping.findFirst({
      where: {
        oldWard: { equals: wardNorm, mode: 'insensitive' },
        oldDistrict: { equals: districtNorm, mode: 'insensitive' },
        province,
        isActive: true,
      },
    });
    if (exact) return exact;

    // Bước 2: District-level fallback
    // Nếu không tìm thấy phường cụ thể, kiểm tra xem tất cả phường trong quận đó
    // có cùng map về 1 phường mới không (quận đã sáp nhập hoàn toàn)
    const districtNewWards = await this.prisma.addressMapping.findMany({
      where: {
        oldDistrict: { equals: districtNorm, mode: 'insensitive' },
        province,
        isActive: true,
      },
      select: { newWard: true },
      distinct: ['newWard'],
    });

    if (districtNewWards.length === 1) {
      // Tất cả phường trong quận này → cùng 1 phường mới
      // (trường hợp phường chưa có trong data nhưng quận đã sáp nhập hoàn toàn)
      return {
        id: 'district-fallback',
        oldWard: wardNorm,
        oldDistrict: districtNorm,
        newWard: districtNewWards[0].newWard,
        province,
        note: `Fallback theo quận: ${districtNorm} → ${districtNewWards[0].newWard}`,
        isActive: true,
        needsReview: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return null;
  }

  async create(dto: CreateAddressMappingDto) {
    const existing = await this.prisma.addressMapping.findUnique({
      where: { oldWard_oldDistrict_province: { oldWard: dto.oldWard, oldDistrict: dto.oldDistrict, province: dto.province } },
    });
    if (existing) throw new ConflictException(`Mapping "${dto.oldWard}, ${dto.oldDistrict}" đã tồn tại`);
    return this.prisma.addressMapping.create({ data: dto });
  }

  async update(id: string, dto: Partial<CreateAddressMappingDto>) {
    const existing = await this.prisma.addressMapping.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Mapping #${id} không tồn tại`);
    return this.prisma.addressMapping.update({ where: { id }, data: { ...dto, updatedAt: new Date() } });
  }

  async remove(id: string) {
    const existing = await this.prisma.addressMapping.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Mapping #${id} không tồn tại`);
    await this.prisma.addressMapping.delete({ where: { id } });
    return { message: `Đã xóa mapping #${id}` };
  }

  /** Crawl từ provinces.open-api.vn và sync vào DB */
  async crawlAndSync() {
    // Gọi API fetch để lấy data mới nhất
    // Logic tương tự scripts/crawl-address-mappings.mjs
    // Trả về stats để admin review
    const existing = await this.prisma.addressMapping.count();
    return {
      message: 'Crawl feature: run node scripts/crawl-address-mappings.mjs --apply',
      existingRecords: existing,
      hint: 'Run crawl script then re-seed to update mappings',
    };
  }

  async getStats() {
    const [total, needsReview, active] = await Promise.all([
      this.prisma.addressMapping.count(),
      this.prisma.addressMapping.count({ where: { needsReview: true } }),
      this.prisma.addressMapping.count({ where: { isActive: true } }),
    ]);
    return { total, needsReview, active };
  }
}
