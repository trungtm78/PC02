import { Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * The 6 Phụ lục report types that PhuLucReportService can generate.
 */
export const XLSX_REPORT_TYPES = [
  'PHU_LUC_01',
  'PHU_LUC_02',
  'PHU_LUC_03',
  'PHU_LUC_04',
  'PHU_LUC_05',
  'PHU_LUC_06',
] as const;
export type XlsxReportType = (typeof XLSX_REPORT_TYPES)[number];

/**
 * Mirror of DocxTemplateLoaderService (v0.47 PR2 T7) — loads 6 xlsx templates
 * at module init, refuses to boot if any file is missing.
 * Replaces the originally-planned TemplateCacheService (single concern: binary
 * file caching). PhuLucReportService streams data rows into a cloned workbook
 * built from these templates.
 */
@Injectable()
export class XlsxTemplateLoaderService implements OnModuleInit {
  private readonly buffers = new Map<XlsxReportType, Buffer>();
  private readonly shas = new Map<XlsxReportType, string>();
  private loaded = false;

  async onModuleInit(): Promise<void> {
    const dir = this.resolveTemplateDir();
    for (const reportType of XLSX_REPORT_TYPES) {
      const file = path.join(dir, `${reportType}.xlsx`);
      if (!fs.existsSync(file)) {
        throw new Error(`Xlsx template not found: ${file}. Refusing to boot.`);
      }
      const buf = fs.readFileSync(file);
      this.buffers.set(reportType, buf);
      this.shas.set(reportType, createHash('sha256').update(buf).digest('hex'));
    }
    this.loaded = true;
  }

  get(reportType: XlsxReportType): Buffer {
    if (!this.loaded) {
      throw new Error(
        `XlsxTemplateLoaderService.get(${reportType}) called before onModuleInit().`,
      );
    }
    const buf = this.buffers.get(reportType);
    if (!buf) {
      throw new Error(
        `XlsxTemplateLoaderService: unknown reportType ${reportType}. Allowed: ${XLSX_REPORT_TYPES.join(', ')}.`,
      );
    }
    return buf;
  }

  sha(reportType: XlsxReportType): string {
    if (!this.loaded) {
      throw new Error(`XlsxTemplateLoaderService.sha(${reportType}) called before onModuleInit().`);
    }
    const sha = this.shas.get(reportType);
    if (!sha) {
      throw new Error(`XlsxTemplateLoaderService: unknown reportType ${reportType}.`);
    }
    return sha;
  }

  private resolveTemplateDir(): string {
    const override = process.env['XLSX_TEMPLATE_DIR_OVERRIDE'];
    if (override) return override;

    // dist layout: dist/src/document-templates → dist/templates/xlsx
    // dev/ts-node: src/document-templates → templates/xlsx
    const candidateDist = path.resolve(__dirname, '..', '..', 'templates', 'xlsx');
    if (fs.existsSync(candidateDist)) return candidateDist;
    const candidateSrc = path.resolve(__dirname, '..', '..', '..', 'templates', 'xlsx');
    return candidateSrc;
  }
}
