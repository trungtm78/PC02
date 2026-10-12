import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GridModelService } from '../grid/grid-model.service';
import type { InputFieldRef } from '../engine/grid-workbook';
import { exportTemplateInWorker } from '../template/parse-in-worker';
import type { TemplateExportRequest } from './template-export';

/**
 * Builds the file an officer or a manager actually wants: the report's own
 * template with the numbers filled in. All of the heavy work — loading and
 * rewriting the workbook AND working out every formula, with the same engine
 * the screen uses — runs in the bounded worker, so a large template is limited
 * by that thread's time and memory, not the server's.
 */

export interface TeamExportInput {
  versionId: string;
  fields: InputFieldRef[];
  /** Field key → stored text, null/'' for blank. */
  values: Readonly<Record<string, string | null | undefined>>;
  /** Written to the hidden `__dr_meta` sheet. */
  meta: Record<string, string>;
}

@Injectable()
export class TemplateExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly grids: GridModelService,
  ) {}

  async buildTeamFile(input: TeamExportInput): Promise<Buffer> {
    const version = await this.prisma.dynReportVersion.findUnique({
      where: { id: input.versionId },
      select: { selectedSheets: true },
    });
    if (!version) throw new NotFoundException('Không tìm thấy phiên bản mẫu này.');
    const selectedSheets = (version.selectedSheets as unknown as string[]) ?? [];

    // May refuse (too large / busy / unbuildable): the caller falls back to a plain list export.
    const { model } = await this.grids.getForVersion(input.versionId);

    const request: TemplateExportRequest = {
      selectedSheets,
      fields: input.fields,
      // The writer treats null and '' alike (a blank), so no further normalising is needed here.
      values: Object.fromEntries(input.fields.map((f) => [f.fieldKey, input.values[f.fieldKey] ?? null])),
      grid: model,
      meta: input.meta,
    };

    return exportTemplateInWorker(
      // Fetched inside the worker slot, so a queued export never holds a copy of the workbook.
      async () => {
        const row = await this.prisma.dynReportVersion.findUnique({
          where: { id: input.versionId },
          select: { fileBytes: true },
        });
        if (!row) throw new NotFoundException('Không tìm thấy phiên bản mẫu này.');
        return Buffer.from(row.fileBytes);
      },
      request,
    );
  }
}
