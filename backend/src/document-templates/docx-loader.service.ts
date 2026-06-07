import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The 7 documentTypes that PetitionsService.exportDocument can render.
 * Order matters only for diagnostic logs.
 */
export const DOCUMENT_TYPES = [
  'PHIEU_DE_XUAT',
  'PHIEU_CHUYEN_NGUON_TIN',
  'PHIEU_CHUYEN_DON',
  'THONG_BAO_CHUYEN',
  'THONG_BAO_HUONG_DAN',
  'THONG_BAO_TRA_LAI',
  'BIEN_NHAN',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * Single-concern loader for the 6 docx templates. Loads every file into memory
 * at module init so render-path stays O(1) and refuses to boot if any template
 * is missing. Replaces the heavier "TemplateCacheService" abstraction from the
 * original plan (see fresh eng review F3 — DocumentNumberTemplate table is the
 * source of truth for numbering metadata; this loader handles binary files only).
 *
 * dist/templates/docx is the production path. backend/templates/docx is the
 * source path used during tests and ts-node runs. nest-cli.json copies the
 * binaries on build.
 */
@Injectable()
export class DocxTemplateLoaderService implements OnModuleInit {
  private readonly buffers = new Map<DocumentType, Buffer>();
  private readonly shas = new Map<DocumentType, string>();
  private loaded = false;

  async onModuleInit(): Promise<void> {
    const dir = this.resolveTemplateDir();
    for (const docType of DOCUMENT_TYPES) {
      const file = path.join(dir, `${docType}.docx`);
      if (!fs.existsSync(file)) {
        throw new Error(`Template not found: ${file}. Refusing to boot.`);
      }
      const buf = fs.readFileSync(file);
      this.buffers.set(docType, buf);
      this.shas.set(docType, createHash('sha256').update(buf).digest('hex'));
    }
    this.loaded = true;
  }

  get(docType: DocumentType): Buffer {
    if (!this.loaded) {
      throw new Error(
        `DocxTemplateLoaderService.get(${docType}) called before onModuleInit() — templates not loaded.`,
      );
    }
    const buf = this.buffers.get(docType);
    if (!buf) {
      throw new Error(
        `DocxTemplateLoaderService: unknown documentType ${docType}. Allowed: ${DOCUMENT_TYPES.join(', ')}.`,
      );
    }
    return buf;
  }

  sha(docType: DocumentType): string {
    if (!this.loaded) {
      throw new Error(
        `DocxTemplateLoaderService.sha(${docType}) called before onModuleInit().`,
      );
    }
    const sha = this.shas.get(docType);
    if (!sha) {
      throw new Error(`DocxTemplateLoaderService: unknown documentType ${docType}.`);
    }
    return sha;
  }

  private resolveTemplateDir(): string {
    // Test/override hook so the missing-template fail-fast case is exercisable.
    const override = process.env['DOCX_TEMPLATE_DIR_OVERRIDE'];
    if (override) return override;

    // Production layout: dist/src/document-templates → dist/templates/docx
    // Dev/ts-node layout: src/document-templates → templates/docx
    const candidateDist = path.resolve(__dirname, '..', '..', 'templates', 'docx');
    if (fs.existsSync(candidateDist)) return candidateDist;
    const candidateSrc = path.resolve(__dirname, '..', '..', '..', 'templates', 'docx');
    return candidateSrc;
  }
}
