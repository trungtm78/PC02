import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as archiver from 'archiver';
import { Writable } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AdminService } from '../admin.service';
import { EnrollmentService } from '../../auth/services/enrollment.service';
import { EnrollmentPdfService } from './enrollment-pdf.service';
import { buildEnrichedFile, type RowOutcome } from './bulk-enrichment.writer';
import { type PreviewRow } from './bulk-import.service';
import { UserStatus } from '../dto/create-user.dto';

const TEMP_DIR = process.env.BULK_IMPORT_TEMP_DIR || '/tmp/pc02-bulk';

/**
 * BulkImportProcessor — inline executor (v0.25.0.0).
 *
 * NOTE: Plan v0.25 designed cho BullMQ async, nhưng để giảm Redis dependency
 * trên VM (autoplan Eng risk #11), chạy inline qua `setImmediate` job-loop
 * pattern. Mỗi job: row sequential trong async worker, update progress DB,
 * gen enriched file + (optional) PDF ZIP, ghi job done.
 *
 * Concurrency: 1 job tại 1 thời điểm per process (in-memory queue). 12-100
 * user × 250ms bcrypt = 3-25s — acceptable cho single VM low-concurrency.
 *
 * Nếu scale lên 1000 user / 5+ admin concurrent → migrate sang BullMQ Worker.
 */
@Injectable()
export class BulkImportProcessor {
  private readonly logger = new Logger(BulkImportProcessor.name);
  private running = false;
  private queue: Array<() => Promise<void>> = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly adminService: AdminService,
    private readonly enrollmentService: EnrollmentService,
    private readonly enrollmentPdf: EnrollmentPdfService,
  ) {}

  /**
   * Enqueue job — return ngay. Worker loop chạy sau via setImmediate.
   */
  enqueue(
    jobId: string,
    rows: PreviewRow[],
    actorId: string,
    originalFilePath: string,
    originalFormat: 'xlsx' | 'csv',
    generatePdfs: boolean,
  ): void {
    this.queue.push(() =>
      this.processJob(jobId, rows, actorId, originalFilePath, originalFormat, generatePdfs),
    );
    this.tick();
  }

  private tick(): void {
    if (this.running) return;
    const next = this.queue.shift();
    if (!next) return;
    this.running = true;
    setImmediate(async () => {
      try {
        await next();
      } catch (err) {
        this.logger.error('Bulk job loop error', err as Error);
      } finally {
        this.running = false;
        this.tick();
      }
    });
  }

  private async processJob(
    jobId: string,
    rows: PreviewRow[],
    actorId: string,
    originalFilePath: string,
    originalFormat: 'xlsx' | 'csv',
    generatePdfs: boolean,
  ): Promise<void> {
    await this.prisma.bulkImportJob.update({
      where: { id: jobId },
      data: { status: 'processing', startedAt: new Date() },
    });

    const outcomes: RowOutcome[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.errors.length > 0) {
        outcomes.push({
          rowIndex: row.rowIndex,
          error: row.errors.join('; '),
        });
        errorCount++;
        await this.updateProgress(jobId, i + 1, successCount, errorCount, outcomes);
        continue;
      }
      try {
        const dto = {
          username: row.username!,
          email: row.email ?? undefined,
          firstName: row.firstName ?? undefined,
          lastName: row.lastName ?? undefined,
          workId: row.workId ?? undefined,
          phone: row.phone ?? undefined,
          departmentId: row.departmentId ?? undefined,
          roleId: row.roleId!,
          status: UserStatus.ACTIVE,
        };
        const user = await this.prisma.$transaction((tx) =>
          this.adminService.createUserCore(dto, actorId, tx),
        );
        const enrollment = await this.enrollmentService.generateEnrollmentLink(
          user.id,
          actorId,
          'bulk_import',
        );
        outcomes.push({
          rowIndex: row.rowIndex,
          userId: user.id,
          enrollmentUrl: enrollment.url,
          expiresAt: enrollment.expiresAt,
        });
        successCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi không xác định';
        outcomes.push({ rowIndex: row.rowIndex, error: message });
        errorCount++;
      }
      await this.updateProgress(jobId, i + 1, successCount, errorCount, outcomes);
    }

    // Gen enriched file
    try {
      const originalBuffer = await fs.readFile(originalFilePath);
      const enrichedBuffer = await buildEnrichedFile(originalBuffer, outcomes, originalFormat);
      const enrichedPath = path.join(
        TEMP_DIR,
        `${jobId}-enriched.${originalFormat}`,
      );
      await fs.writeFile(enrichedPath, enrichedBuffer, { mode: 0o600 });
      await this.prisma.bulkImportJob.update({
        where: { id: jobId },
        data: { enrichedFilePath: enrichedPath, originalFilePath },
      });
    } catch (err) {
      this.logger.error(`Enriched file gen failed jobId=${jobId}`, err as Error);
    }

    // Gen PDF ZIP (optional, blocking but acceptable)
    if (generatePdfs && successCount > 0) {
      try {
        await this.generatePdfZip(jobId, outcomes, rows);
      } catch (err) {
        this.logger.error(`PDF ZIP gen failed jobId=${jobId}`, err as Error);
      }
    }

    await this.prisma.bulkImportJob.update({
      where: { id: jobId },
      data: {
        status: 'done',
        finishedAt: new Date(),
        progress: rows.length,
        successRows: successCount,
        errorRows: errorCount,
        rowOutcomes: outcomes as object,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'BULK_IMPORT_COMPLETED',
      subject: 'BulkImportJob',
      subjectId: jobId,
      metadata: { successCount, errorCount, totalRows: rows.length },
    });
  }

  private async updateProgress(
    jobId: string,
    progress: number,
    successCount: number,
    errorCount: number,
    outcomes: RowOutcome[],
  ): Promise<void> {
    await this.prisma.bulkImportJob.update({
      where: { id: jobId },
      data: {
        progress,
        successRows: successCount,
        errorRows: errorCount,
        rowOutcomes: outcomes as object,
      },
    });
  }

  private async generatePdfZip(
    jobId: string,
    outcomes: RowOutcome[],
    rows: PreviewRow[],
  ): Promise<void> {
    const zipPath = path.join(TEMP_DIR, `${jobId}-handover.zip`);
    const output = await fs.open(zipPath, 'w');
    try {
      const writeStream = output.createWriteStream();
      const archive = archiver.create('zip', { zlib: { level: 6 } });
      archive.pipe(writeStream);

      for (const outcome of outcomes) {
        if (outcome.error || !outcome.enrollmentUrl) continue;
        const row = rows.find((r) => r.rowIndex === outcome.rowIndex);
        if (!row) continue;
        const pdfBuffer = await this.enrollmentPdf.generateHandoverPdf({
          fullName: row.fullName ?? row.username ?? 'Unknown',
          workId: row.workId,
          phone: row.phone,
          departmentName: row.departmentName,
          enrollmentUrl: outcome.enrollmentUrl,
          expiresAt: outcome.expiresAt instanceof Date
            ? outcome.expiresAt
            : new Date(outcome.expiresAt ?? Date.now()),
        });
        const safeName = (row.fullName ?? row.username ?? `row-${row.rowIndex}`)
          .replace(/[^a-zA-Z0-9À-ỹ\s_-]/g, '')
          .replace(/\s+/g, '_')
          .slice(0, 60);
        archive.append(pdfBuffer, { name: `${row.rowIndex}-${safeName}.pdf` });
      }
      await archive.finalize();
      await new Promise<void>((resolve, reject) => {
        writeStream.on('close', resolve);
        writeStream.on('error', reject);
      });
    } finally {
      await output.close();
    }
  }
}
