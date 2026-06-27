import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import archiver from 'archiver';
import { sanitizeFilename } from '../common/utils/filename.util';
import type { DocumentType } from '../document-templates/docx-loader.service';
import { PetitionsService } from './petitions.service';
import type { DataScope } from '../auth/services/unit-scope.service';

export const MAX_BATCH_SIZE = 100;

const ALLOWED_DOC_TYPES: ReadonlySet<DocumentType> = new Set<DocumentType>([
  'PHIEU_DE_XUAT',
  'PHIEU_CHUYEN_NGUON_TIN',
  'PHIEU_CHUYEN_DON',
  'THONG_BAO_CHUYEN',
  'THONG_BAO_HUONG_DAN',
  'THONG_BAO_TRA_LAI',
  'BIEN_NHAN',
]);

export function validateBatchRequest(
  petitionIds: string[],
  docType: DocumentType,
): void {
  if (!Array.isArray(petitionIds) || petitionIds.length === 0) {
    throw new BadRequestException(
      'Danh sách petitionIds không được trống',
    );
  }
  if (petitionIds.length > MAX_BATCH_SIZE) {
    throw new BadRequestException(
      `Vượt quá ${MAX_BATCH_SIZE} đơn/lần (yêu cầu: ${petitionIds.length}). Hãy chia nhỏ.`,
    );
  }
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    throw new BadRequestException(
      `docType không hợp lệ: ${docType}. Cho phép: ${[...ALLOWED_DOC_TYPES].join(', ')}`,
    );
  }
  const seen = new Set<string>();
  for (const id of petitionIds) {
    if (seen.has(id)) {
      throw new BadRequestException(
        `Phát hiện ID trùng trong batch: ${id}. Loại bỏ ID trùng trước khi gửi (duplicate).`,
      );
    }
    seen.add(id);
  }
}

export function sanitizeBatchFilename(
  docType: DocumentType,
  now: Date = new Date(),
): string {
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  return sanitizeFilename(`batch-${docType}-${ts}.zip`);
}

/**
 * Streams a ZIP of N rendered docx files to the response. Each petition is
 * rendered through PetitionsService.exportDocument in isolation — one render
 * failure (validation, render throw, lock contention) does not abort the
 * batch; the failing petition is recorded in manifest.json instead.
 *
 * archiver streams chunks directly to res.write() — never accumulates the
 * entire ZIP in memory. The 100-petition cap defends against abusive load,
 * not memory (max 100 * 50KB docx = ~5MB, fine on the request thread).
 */
@Injectable()
export class BatchExportService {
  private readonly logger = new Logger(BatchExportService.name);

  constructor(private readonly petitions: PetitionsService) {}

  async exportBatchToZip(
    petitionIds: string[],
    docType: DocumentType,
    actorId: string,
    dataScope: DataScope | null | undefined,
    res: Response,
  ): Promise<void> {
    validateBatchRequest(petitionIds, docType);

    const filename = sanitizeBatchFilename(docType);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('warning', (err) => {
      this.logger.warn(`Batch archiver warning: ${err.message}`);
    });
    archive.on('error', (err) => {
      this.logger.error(`Batch archiver error: ${err.message}`, err.stack);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Batch export failed' });
      } else {
        res.destroy();
      }
    });

    archive.pipe(res);

    const manifest: Array<
      | { petitionId: string; status: 'success'; filename: string; documentNumber: string }
      | { petitionId: string; status: 'failed'; reason: string }
    > = [];

    for (const id of petitionIds) {
      try {
        const result = await this.petitions.exportDocumentToBuffer(
          id,
          docType,
          actorId,
          dataScope,
        );
        const entryName = sanitizeFilename(`${docType}_${result.documentNumber}.docx`);
        archive.append(result.buffer, { name: entryName });
        manifest.push({
          petitionId: id,
          status: 'success',
          filename: entryName,
          documentNumber: result.documentNumber,
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Batch render failed for ${id}: ${reason}`);
        manifest.push({ petitionId: id, status: 'failed', reason });
      }
    }

    // Append a machine-readable manifest so the UI can highlight which IDs
    // failed and why without having to inspect zip listings.
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    await archive.finalize();
  }
}
