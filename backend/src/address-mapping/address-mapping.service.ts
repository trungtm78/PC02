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
  async crawlAndSync(province = 'HCM') {
    const BASE = 'https://provinces.open-api.vn/api';

    // Mapping quận/huyện cũ → phường mới (Nghị quyết 1279/NQ-UBTVQH15)
    const DISTRICT_TO_NEW_WARD: Record<string, string | null> = {
      'quận phú nhuận':  'phường phú nhuận',
      'quận bình thạnh': 'phường bình thạnh',
      'quận gò vấp':     'phường gò vấp',
      'quận tân bình':   'phường tân bình',
      'quận tân phú':    'phường tân phú',
      'quận bình tân':   'phường bình tân',
      'huyện bình chánh': 'phường bình chánh',
      'huyện hóc môn':   'phường hóc môn',
      'huyện củ chi':    'phường củ chi',
      'huyện nhà bè':    'phường nhà bè',
      'huyện cần giờ':   'phường cần giờ',
      // Quận số — chưa có văn bản chính thức → chỉ xóa cấp quận
      'quận 1': null, 'quận 2': null, 'quận 3': null, 'quận 4': null,
      'quận 5': null, 'quận 6': null, 'quận 7': null, 'quận 8': null,
      'quận 9': null, 'quận 10': null, 'quận 11': null, 'quận 12': null,
      'thành phố thủ đức': null,
    };

    // Province code → API code
    const PROVINCE_API_CODE: Record<string, number> = { HCM: 79 };
    const apiCode = PROVINCE_API_CODE[province];
    if (!apiCode) throw new Error(`Province ${province} not supported for crawl`);

    // Fetch province data with full depth
    const res = await fetch(`${BASE}/p/${apiCode}?depth=3`, {
      headers: { 'User-Agent': 'PC02-AddressMapper/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from provinces.open-api.vn`);

    const data = await res.json() as {
      districts: Array<{
        name: string;
        wards: Array<{ name: string; codename: string }>;
      }>;
    };

    const districts = data.districts ?? [];

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const district of districts) {
      const districtKey = district.name.toLowerCase().trim();
      const newWard = DISTRICT_TO_NEW_WARD[districtKey];

      if (newWard === undefined) {
        // District không có trong mapping → bỏ qua
        skipped += (district.wards ?? []).length;
        continue;
      }

      for (const ward of district.wards ?? []) {
        const oldWard = ward.name.toLowerCase().trim();
        const resolvedNewWard = newWard ?? oldWard; // null = giữ tên phường
        const note = newWard
          ? `NQ 1279/NQ-UBTVQH15: ${district.name} sáp nhập thành ${newWard}`
          : `Chỉ xóa cấp quận (${district.name}) — tên phường giữ nguyên`;
        const needsReview = newWard === null;

        const upserted = await this.prisma.addressMapping.upsert({
          where: { oldWard_oldDistrict_province: { oldWard, oldDistrict: districtKey, province } },
          update: { newWard: resolvedNewWard, note, needsReview },
          create: { oldWard, oldDistrict: districtKey, newWard: resolvedNewWard, province, note, needsReview, isActive: true },
        });

        const timeDiff = upserted.updatedAt.getTime() - upserted.createdAt.getTime();
        if (timeDiff < 1000) created++;
        else updated++;
      }
    }

    const total = await this.prisma.addressMapping.count({ where: { province } });
    return {
      success: true,
      message: `Crawl hoàn tất từ provinces.open-api.vn`,
      stats: { created, updated, skipped, total, needsReview: await this.prisma.addressMapping.count({ where: { province, needsReview: true } }) },
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
