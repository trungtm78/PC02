import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressMappingDto } from './dto/create-address-mapping.dto';
import { QueryAddressMappingDto, LookupAddressMappingDto } from './dto/query-address-mapping.dto';

// Province code → /api/v1 numeric code (provinces.open-api.vn).
// HCM = 79 is the only fully-tested entry; HN/DN/HP/CT to be enabled by follow-up PRs
// when those wards are reform-mapped.
const PROVINCE_API_CODE: Record<string, number> = {
  HCM: 79,
  HN: 1,
  HP: 31,
  DN: 48,
  CT: 92,
};

const PROVINCES_API_BASE = 'https://provinces.open-api.vn/api';
const FETCH_USER_AGENT = 'PC02-AddressMapper/1.0';
const SNAPSHOT_DIR = join(process.cwd(), 'prisma', 'data', 'snapshots');

@Injectable()
export class AddressMappingService {
  private readonly logger = new Logger(AddressMappingService.name);
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

  /**
   * Start a bulk-seed-from-API job for a province. Returns immediately with
   * a job ID; actual work happens in a background worker via setImmediate.
   *
   * Concurrency-locked: refuses if any queued/running job exists for the
   * same province. Caller polls /seed/status/:id for progress.
   */
  async startSeedJob(province: string, triggeredBy: string) {
    const apiCode = PROVINCE_API_CODE[province];
    if (!apiCode) {
      throw new ConflictException(`Province '${province}' chưa được hỗ trợ. Hỗ trợ: ${Object.keys(PROVINCE_API_CODE).join(', ')}`);
    }
    const running = await this.prisma.addressSeedJob.findFirst({
      where: { province, status: { in: ['queued', 'running'] } },
    });
    if (running) {
      throw new ConflictException(`Đang có job chạy cho ${province} (id=${running.id}, status=${running.status})`);
    }
    const job = await this.prisma.addressSeedJob.create({
      data: { province, status: 'queued', triggeredBy },
    });
    // Kick off background worker without awaiting.
    setImmediate(() => {
      void this.runSeedJob(job.id, apiCode, province).catch((err) => {
        this.logger.error(`Seed job ${job.id} crashed: ${err?.message ?? err}`);
      });
    });
    return { jobId: job.id, statusUrl: `/address-mappings/seed/status/${job.id}` };
  }

  async getSeedJobStatus(id: string) {
    const job = await this.prisma.addressSeedJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException(`Seed job ${id} không tồn tại`);
    return job;
  }

  async cancelSeedJob(id: string) {
    const job = await this.prisma.addressSeedJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundException(`Seed job ${id} không tồn tại`);
    if (job.status !== 'queued' && job.status !== 'running') {
      throw new ConflictException(`Job đã ${job.status}, không thể hủy`);
    }
    await this.prisma.addressSeedJob.update({
      where: { id },
      data: { cancelToken: 'requested' },
    });
    return { ok: true, message: 'Cancellation requested. Worker sẽ dừng ở batch tiếp theo.' };
  }

  /**
   * Background worker: enumerates old structure via v1 API, then for each
   * old ward calls v2 from-legacy to get new ward(s). Stores raw API
   * responses to backend/prisma/data/snapshots/{province}-v1-{ts}.json
   * for offline reproducibility (Codex/CEO finding).
   */
  private async runSeedJob(jobId: string, apiCode: number, province: string): Promise<void> {
    const errors: Array<{ wardCode?: number; error: string }> = [];
    let mapped = 0;
    let needsReviewCount = 0;
    let total = 0;

    try {
      await this.prisma.addressSeedJob.update({
        where: { id: jobId },
        data: { status: 'running' },
      });

      // 1. Fetch v1 (old structure with old codes).
      const v1Res = await fetch(`${PROVINCES_API_BASE}/p/${apiCode}?depth=3`, {
        headers: { 'User-Agent': FETCH_USER_AGENT },
        signal: AbortSignal.timeout(30000),
        redirect: 'follow',
      });
      if (!v1Res.ok) throw new Error(`v1 API HTTP ${v1Res.status}`);
      const v1Data = (await v1Res.json()) as {
        districts: Array<{ name: string; wards: Array<{ name: string; code: number }> }>;
      };

      // Snapshot raw response for reproducibility.
      try {
        mkdirSync(SNAPSHOT_DIR, { recursive: true });
        const snapPath = join(SNAPSHOT_DIR, `${province}-v1-${Date.now()}.json`);
        writeFileSync(snapPath, JSON.stringify(v1Data, null, 2));
      } catch (snapErr: any) {
        this.logger.warn(`Snapshot write failed (non-fatal): ${snapErr.message}`);
      }

      total = (v1Data.districts ?? []).reduce((acc, d) => acc + (d.wards?.length ?? 0), 0);
      await this.prisma.addressSeedJob.update({
        where: { id: jobId },
        data: { totalWards: total },
      });

      // 2. Walk each old ward → call v2 from-legacy.
      for (const district of v1Data.districts ?? []) {
        const oldDistrictName = district.name.toLowerCase().trim();
        for (const ward of district.wards ?? []) {
          // Honor cancellation between every ward (cheap check, ~1ms DB query).
          const job = await this.prisma.addressSeedJob.findUnique({ where: { id: jobId } });
          if (job?.cancelToken === 'requested') {
            await this.prisma.addressSeedJob.update({
              where: { id: jobId },
              data: { status: 'cancelled', completedAt: new Date(), errorLog: JSON.stringify(errors), mappedCount: mapped, needsReview: needsReviewCount },
            });
            this.logger.log(`Seed job ${jobId} cancelled at ward ${ward.code}`);
            return;
          }

          const oldWardName = ward.name.toLowerCase().trim();
          const oldWardCode = ward.code;

          try {
            const v2Res = await fetch(
              `${PROVINCES_API_BASE}/v2/w/from-legacy/?legacy_code=${oldWardCode}`,
              {
                headers: { 'User-Agent': FETCH_USER_AGENT },
                signal: AbortSignal.timeout(5000),
                redirect: 'follow',
              },
            );
            if (!v2Res.ok) {
              errors.push({ wardCode: oldWardCode, error: `v2 HTTP ${v2Res.status}` });
              continue;
            }
            const matches = (await v2Res.json()) as Array<{ ward: { name: string; code: number } }>;
            if (!matches || matches.length === 0) {
              continue;
            }

            const candidates = matches.map((m) => m.ward.name);
            const isAmbiguous = matches.length > 1;
            if (isAmbiguous) needsReviewCount++;

            const primaryNew = matches[0].ward.name.toLowerCase().trim();
            const note = isAmbiguous
              ? `Old ward split: → ${candidates.join(', ')} (cần admin review)`
              : 'API-seeded từ provinces.open-api.vn v2';

            await this.prisma.addressMapping.upsert({
              where: { oldWard_oldDistrict_province: { oldWard: oldWardName, oldDistrict: oldDistrictName, province } },
              create: {
                oldWard: oldWardName,
                oldDistrict: oldDistrictName,
                newWard: primaryNew,
                province,
                note,
                needsReview: isAmbiguous,
                source: 'api-v2',
                seededAt: new Date(),
                candidates: isAmbiguous ? (candidates as any) : undefined,
                isActive: true,
              },
              update: {
                newWard: primaryNew,
                note,
                needsReview: isAmbiguous,
                source: 'api-v2',
                seededAt: new Date(),
                candidates: isAmbiguous ? (candidates as any) : null,
                isActive: true,
              },
            });
            mapped++;

            // Update progress every 25 rows so the admin sees movement.
            if (mapped % 25 === 0) {
              await this.prisma.addressSeedJob.update({
                where: { id: jobId },
                data: { mappedCount: mapped, errorCount: errors.length, needsReview: needsReviewCount },
              });
            }
          } catch (err: any) {
            errors.push({ wardCode: oldWardCode, error: err?.message ?? String(err) });
          }

          // Polite throttle between API calls. Codex flagged 50ms as overly polite;
          // 10ms is a reasonable middle ground for an unmaintained-but-online API.
          await new Promise((r) => setTimeout(r, 10));
        }
      }

      await this.prisma.addressSeedJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          mappedCount: mapped,
          errorCount: errors.length,
          needsReview: needsReviewCount,
          errorLog: errors.length ? JSON.stringify(errors).slice(0, 5000) : null,
        },
      });
      this.logger.log(`Seed job ${jobId} completed: ${mapped} mapped, ${errors.length} errors, ${needsReviewCount} need review`);
    } catch (err: any) {
      this.logger.error(`Seed job ${jobId} failed: ${err?.message ?? err}`);
      await this.prisma.addressSeedJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          mappedCount: mapped,
          errorCount: errors.length,
          needsReview: needsReviewCount,
          errorLog: JSON.stringify({ fatalError: err?.message ?? String(err), partial: errors.slice(0, 50) }).slice(0, 5000),
        },
      });
    }
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
