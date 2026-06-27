import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import archiver from 'archiver';
import { sanitizeFilename } from '../common/utils/filename.util';
import type { DataScope } from '../auth/services/unit-scope.service';
import { PetitionsService } from './petitions.service';
import { DocxMergeService } from './docx-merge.service';
import { validateExportDocumentsRequest } from './petition-export-documents.validate';

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Xuất NHIỀU mẫu chứng từ cho 1 đơn thư → 1 file Word gộp (mặc định) hoặc ZIP.
 *
 *   validate+dedupe → [F1] pre-validate tất cả (KHÔNG cấp số) → render từng mẫu
 *   (exportDocumentToBuffer, mỗi mẫu cấp 1 số văn bản) → merged: DocxMergeService
 *   → 1 .docx; zip: archiver → .zip.
 *
 * 1 mẫu lỗi: pre-validate chặn lỗi thiếu trường TRƯỚC khi cấp số (fail-hard,
 * không gap số). Lỗi render hiếm còn lại vẫn throw (fail cả request).
 */
@Injectable()
export class PetitionExportDocumentsService {
  private readonly logger = new Logger(PetitionExportDocumentsService.name);

  constructor(
    private readonly petitions: PetitionsService,
    private readonly docxMerge: DocxMergeService,
  ) {}

  async exportDocuments(
    id: string,
    docTypes: string[],
    mode: string | undefined,
    actorId: string,
    dataScope: DataScope | null | undefined,
    res: Response,
  ): Promise<void> {
    const normalized = validateExportDocumentsRequest(docTypes, mode);

    // [F1+P2 atomic] Render CẢ N mẫu trong MỘT transaction: pre-validate tất cả →
    // render+cấp số tuần tự → bất kỳ lỗi giữa chừng → rollback HẾT (không tiêu số
    // văn bản nào, không gap). merge/zip làm sau trên buffer trả về.
    const rendered = await this.petitions.renderDocumentsAtomic(
      id,
      normalized.docTypes,
      actorId,
      dataScope,
    );

    const baseName = `ChungTu_${this.dateStamp()}`;

    if (normalized.mode === 'merged') {
      const merged = this.docxMerge.merge(rendered.map((r) => r.buffer));
      this.setDownloadHeaders(res, DOCX_CONTENT_TYPE, `${baseName}.docx`);
      res.send(merged);
      return;
    }

    // mode === 'zip'
    const archive = archiver('zip', { zlib: { level: 9 } });
    // [review P1/codex] Bắt 'error' của archiver/stream — unhandled EventEmitter 'error'
    // (zlib fail / client disconnect khi pipe) có thể KILL process Node. Pattern khớp BatchExportService.
    archive.on('warning', (err) => {
      this.logger.warn(`Export-documents archiver warning: ${err.message}`);
    });
    archive.on('error', (err) => {
      this.logger.error(`Export-documents archiver error: ${err.message}`, err.stack);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Xuất chứng từ thất bại' });
      } else {
        res.destroy();
      }
    });
    this.setDownloadHeaders(res, 'application/zip', `${baseName}.zip`);
    archive.pipe(res);
    for (const r of rendered) {
      archive.append(r.buffer, { name: sanitizeFilename(r.filename) });
    }
    await archive.finalize();
  }

  private setDownloadHeaders(
    res: Response,
    contentType: string,
    filename: string,
  ): void {
    res.setHeader('Content-Type', contentType);
    // RFC 5987 cho tên file (an toàn cả ASCII fallback).
    const ascii = filename.replace(/[^\x20-\x7E]/g, '_');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
  }

  private dateStamp(now: Date = new Date()): string {
    return (
      String(now.getFullYear()) +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0')
    );
  }
}
