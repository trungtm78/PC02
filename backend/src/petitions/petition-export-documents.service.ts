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
    const baseName = `ChungTu_${this.dateStamp()}`;

    // [F1+P2 atomic] Render+cấp số CẢ N mẫu RỒI gộp/zip — tất cả trong MỘT transaction
    // (finalize callback chạy trong tx). Lỗi bất kỳ (render, gộp, zip) → rollback HẾT,
    // KHÔNG tiêu số văn bản nào. Trả buffer deliverable hoàn chỉnh → res.send (không
    // pipe stream → không rủi ro unhandled 'error' của EventEmitter).
    if (normalized.mode === 'merged') {
      const merged = await this.petitions.renderDocumentsAtomic(
        id,
        normalized.docTypes,
        actorId,
        dataScope,
        (docs) => this.docxMerge.merge(docs.map((d) => d.buffer)),
      );
      this.setDownloadHeaders(res, DOCX_CONTENT_TYPE, `${baseName}.docx`);
      res.send(merged);
      return;
    }

    // mode === 'zip'
    const zipBuffer = await this.petitions.renderDocumentsAtomic(
      id,
      normalized.docTypes,
      actorId,
      dataScope,
      (docs) => this.buildZipBuffer(docs),
    );
    this.setDownloadHeaders(res, 'application/zip', `${baseName}.zip`);
    res.send(zipBuffer);
  }

  /**
   * Đóng N buffer .docx thành 1 .zip trong BỘ NHỚ (collect chunk → Buffer.concat).
   * Buffer-based (không pipe res) để gọi được trong transaction atomic + tránh
   * unhandled EventEmitter 'error' crash process. N≤7 file nhỏ → memory không đáng kể.
   */
  private buildZipBuffer(
    docs: Array<{ buffer: Buffer; filename: string }>,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];
      archive.on('data', (c: Buffer) => chunks.push(c));
      archive.on('warning', (err) => {
        this.logger.warn(`Export-documents zip warning: ${err.message}`);
      });
      archive.on('error', reject);
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      for (const d of docs) {
        archive.append(d.buffer, { name: sanitizeFilename(d.filename) });
      }
      void archive.finalize();
    });
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
