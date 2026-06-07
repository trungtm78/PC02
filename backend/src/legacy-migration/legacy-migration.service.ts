import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decomposeLegacyRecord, type LegacyRecord } from './legacy-mapper';
import { buildMigrationReport, type MigrationReport } from './migration-report';

export interface CommitResult {
  created: { petitions: number; incidents: number; cases: number };
  skipped: number;
  errors: { legacyId: string; message: string }[];
  report: MigrationReport;
}

@Injectable()
export class LegacyMigrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Dry-run: KHÔNG mutate DB. Trả báo cáo đối soát.
  dryRun(records: LegacyRecord[]): MigrationReport {
    return buildMigrationReport(records);
  }

  // Resolve crimeChinhLegacyValue → crimeChinhId qua master Crime (theo legacyValue).
  // tx phải được truyền từ $transaction để đảm bảo đọc trong cùng boundary.
  private async resolveCrime(tx: any, data: Record<string, unknown>): Promise<void> {
    const lv = data.crimeChinhLegacyValue as number | undefined;
    delete data.crimeChinhLegacyValue;
    if (lv === undefined) return;
    const crime = await tx.crime.findFirst({ where: { legacyValue: lv } });
    if (crime) data.crimeChinhId = crime.id;
  }

  // Commit: upsert theo legacySourceId (idempotent re-run). Mỗi record 1 transaction nhỏ; lỗi 1 record không chặn record khác.
  async commit(records: LegacyRecord[], actorId: string): Promise<CommitResult> {
    const created = { petitions: 0, incidents: 0, cases: 0 };
    const errors: { legacyId: string; message: string }[] = [];
    let skipped = 0;

    for (const rec of records) {
      const legacyId = rec.id == null ? '' : String(rec.id).trim();
      if (!legacyId) {
        skipped++;
        continue;
      }
      try {
        const d = decomposeLegacyRecord(rec);
        if (!d.petition && !d.incident && !d.case) {
          skipped++;
          continue;
        }
        await this.prisma.$transaction(async (tx: any) => {
          if (d.petition) {
            const data = { ...d.petition };
            await this.resolveCrime(tx, data);
            const existing = await tx.petition.findFirst({ where: { legacySourceId: legacyId } });
            if (existing) {
              await tx.petition.update({ where: { id: existing.id }, data });
            } else {
              await tx.petition.create({
                data: {
                  stt: `DT-LEGACY-${legacyId}`,
                  receivedDate: (data.receivedDate as Date) ?? new Date(),
                  senderName: (data.senderName as string) ?? '(di trú)',
                  status: 'MOI_TIEP_NHAN',
                  ...data,
                },
              });
              created.petitions++;
            }
          }
          if (d.incident) {
            const data = { ...d.incident };
            const existing = await tx.incident.findFirst({ where: { legacySourceId: legacyId } });
            if (existing) {
              await tx.incident.update({ where: { id: existing.id }, data });
            } else {
              await tx.incident.create({
                data: { code: `VV-LEGACY-${legacyId}`, status: 'TIEP_NHAN', ...data },
              });
              created.incidents++;
            }
          }
          if (d.case) {
            const data = { ...d.case };
            await this.resolveCrime(tx, data);
            const existing = await tx.case.findFirst({ where: { legacySourceId: legacyId } });
            if (existing) {
              await tx.case.update({ where: { id: existing.id }, data });
            } else {
              await tx.case.create({
                data: { status: 'TIEP_NHAN', caseProvenance: 'TRANSFERRED', ...data },
              });
              created.cases++;
            }
          }
        });
      } catch (e) {
        errors.push({ legacyId, message: (e as Error).message });
      }
    }

    await this.audit.log({
      userId: actorId,
      action: 'LEGACY_MIGRATION_COMMIT',
      subject: 'LegacyMigration',
      subjectId: 'batch',
      metadata: { created, skipped, errorCount: errors.length },
    });

    return { created, skipped, errors, report: buildMigrationReport(records) };
  }

  // Rollback: xóa entity đã di trú theo danh sách legacySourceId (chỉ record do di trú tạo).
  async rollback(legacyIds: string[], actorId: string): Promise<{ deleted: number }> {
    let deleted: number;
    try {
      deleted = await this.prisma.$transaction(async (tx: any) => {
        const p = await tx.petition.deleteMany({ where: { legacySourceId: { in: legacyIds } } });
        const i = await tx.incident.deleteMany({ where: { legacySourceId: { in: legacyIds } } });
        const c = await tx.case.deleteMany({ where: { legacySourceId: { in: legacyIds } } });
        return p.count + i.count + c.count;
      });
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (msg.includes('Foreign key constraint') || msg.includes('P2003')) {
        throw new BadRequestException(
          'Không thể rollback: một số bản ghi có dữ liệu con liên kết. Hãy xóa dữ liệu con trước khi rollback.',
        );
      }
      throw e;
    }
    await this.audit.log({
      userId: actorId,
      action: 'LEGACY_MIGRATION_ROLLBACK',
      subject: 'LegacyMigration',
      subjectId: 'batch',
      metadata: { deleted, legacyIds },
    });
    return { deleted };
  }
}
