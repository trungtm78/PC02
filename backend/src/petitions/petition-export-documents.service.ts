import { Injectable } from '@nestjs/common';
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

    // [F1] Pre-validate TẤT CẢ mẫu TRƯỚC khi render/cấp số → thiếu trường = 400 ngay,
    // không tiêu số văn bản nào.
    await this.petitions.preValidateExportDocuments(
      id,
      normalized.docTypes,
      dataScope,
    );

    const rendered: Array<{ buffer: Buffer; documentNumber: string; filename: string }> = [];
    for (const docType of normalized.docTypes) {
      rendered.push(
        await this.petitions.exportDocumentToBuffer(id, docType, actorId, dataScope),
      );
    }

    const baseName = `ChungTu_${this.dateStamp()}`;

    if (normalized.mode === 'merged') {
      const merged = this.docxMerge.merge(rendered.map((r) => r.buffer));
      this.setDownloadHeaders(res, DOCX_CONTENT_TYPE, `${baseName}.docx`);
      res.send(merged);
      return;
    }

    // mode === 'zip'
    this.setDownloadHeaders(res, 'application/zip', `${baseName}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
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
