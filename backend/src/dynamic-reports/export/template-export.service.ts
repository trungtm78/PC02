import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GridModelService } from '../grid/grid-model.service';
import { evaluateGridWorkbook } from '../engine/grid-workbook';
import type { InputFieldRef } from '../engine/grid-workbook';
import { describeFormulaError } from '../engine/numfmt';
import type { FormulaErrorCode } from '../engine/numfmt';
import type { GridModel } from '../engine/grid-types';
import { exportTemplateInWorker } from '../template/parse-in-worker';
import type { FormulaResult, TemplateExportRequest } from './template-export';

/**
 * Builds the file an officer or a manager actually wants: the report's own
 * template with the numbers filled in. The heavy part (loading and rewriting
 * the workbook) runs in the bounded worker; the calculation of every formula
 * is done here, with the same engine the screen uses, so the file, the web
 * page and the stored figures agree.
 */

export interface TeamExportInput {
  versionId: string;
  fields: InputFieldRef[];
  /** Field key → stored text, null/'' for blank. */
  values: Readonly<Record<string, string | null | undefined>>;
  /** Written to the hidden `__dr_meta` sheet. */
  meta: Record<string, string>;
}

/** Every formula of the model, worked out against the given values, as the file will carry it. */
export function computeFormulaResults(
  model: GridModel,
  fields: readonly InputFieldRef[],
  values: Readonly<Record<string, string | null | undefined>>,
): Record<string, FormulaResult> {
  const { evaluator } = evaluateGridWorkbook(model, fields, values);
  const out: Record<string, FormulaResult> = {};
  for (const sheet of model.sheets) {
    for (const [address, cell] of Object.entries(sheet.cells)) {
      if (cell.k !== 'formula') continue;
      const outcome = evaluator.get(sheet.name, address);
      const key = `${sheet.name}!${address}`;
      if (!outcome || !outcome.ok) {
        const code = (outcome && !outcome.ok ? outcome.error.code : 'CYCLE_DETECTED') as FormulaErrorCode;
        out[key] = { kind: 'error', value: describeFormulaError(code).text };
        continue;
      }
      const v = outcome.value;
      if (v.type === 'number') out[key] = { kind: 'number', value: Number(v.value) };
      else if (v.type === 'string') out[key] = { kind: 'string', value: v.value };
      else out[key] = { kind: 'boolean', value: v.value };
    }
  }
  return out;
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
      formulaResults: computeFormulaResults(model, input.fields, input.values),
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
