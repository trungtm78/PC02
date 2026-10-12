import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import {
  assertMagicBytes,
  assertCompressedSize,
  assertNoZipBomb,
  computeSha256,
  HostileXlsxError,
} from '../../xlsx-imports/hostile-xlsx-guard';
import { buildGridInWorker, parseTemplateInWorker } from './parse-in-worker';
import type { GridModel } from '../engine/grid-types';
import { assertNoMacro, MacroDetectedError } from './macro-guard';
import { TemplateLimitError } from './limits';
import { suggestValidationRules } from './suggest-rules';
import { deriveFromValidations } from './validation-constraints';
import type { DerivedRuleSuggestion } from './validation-constraints';
import type { ParsedIssue } from './types';
import type { ParseTemplateResult } from './types';
import type { SuggestedRule } from './suggest-rules';

export interface SheetInfo {
  name: string;
  state: 'visible' | 'hidden' | 'veryHidden';
}

export class TemplateValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'TemplateValidationError';
  }
}

export interface ValidateAndParseResult extends ParseTemplateResult {
  sha256: string;
  suggestedRules: Array<SuggestedRule | DerivedRuleSuggestion>;
  /**
   * The selected sheets drawn as the officer will see them, so the wizard can mark input cells on the template
   * itself. `null` when it could not be built (too large, a busy worker): the wizard then works from the list.
   */
  grid: GridModel | null;
}

/**
 * TemplateService (spec §10 PR3). Entry point PR4's upload step calls.
 * Ordering matters: the cheap, synchronous, pre-parse checks
 * (assertMagicBytes/assertCompressedSize/assertNoZipBomb — the same
 * hostile-xlsx-guard every other xlsx upload in this repo already uses,
 * R6) run BEFORE the file ever reaches exceljs or the worker thread, so a
 * hostile upload is rejected in microseconds, not after paying for a
 * worker spawn. `assertWorkbookLimits` (file-wide sheet/row caps) and the
 * dynamic-reports-specific two-tier limits both run inside the worker via
 * `parseTemplateInWorker`/`parseTemplate` — no need to duplicate them here.
 */
@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  private async runPreChecks(buffer: Buffer): Promise<void> {
    try {
      await assertMagicBytes(buffer);
      assertCompressedSize(buffer);
      assertNoZipBomb(buffer);
      await assertNoMacro(buffer);
    } catch (err) {
      if (
        err instanceof HostileXlsxError ||
        err instanceof MacroDetectedError
      ) {
        throw new TemplateValidationError(err.message, err.code);
      }
      throw err;
    }
  }

  /**
   * S02 (upload step, before any sheet is selected) — just the sheet
   * names, so the wizard can render a picker. Deliberately NOT worker-
   * isolated like validateAndParse/parseTemplate: by this point the
   * buffer has already passed every pre-check (magic bytes, zip-bomb,
   * macro), and reading `workbook.worksheets.map(s => s.name)` has no
   * per-cell work — its cost scales with file size (already capped at
   * XLSX_LIMITS.MAX_COMPRESSED_BYTES), not with sheet content, unlike
   * the full parse this function deliberately skips.
   */
  async listSheets(buffer: Buffer): Promise<SheetInfo[]> {
    await this.runPreChecks(buffer);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    return workbook.worksheets.map((sheet) => ({
      name: sheet.name,
      state: sheet.state as SheetInfo['state'],
    }));
  }

  async validateAndParse(
    buffer: Buffer,
    selectedSheetNames: string[],
  ): Promise<ValidateAndParseResult> {
    await this.runPreChecks(buffer);

    const sha256 = computeSha256(buffer);

    let parsed: ParseTemplateResult;
    try {
      parsed = await parseTemplateInWorker(buffer, selectedSheetNames);
    } catch (err) {
      if (err instanceof TemplateLimitError) {
        throw new TemplateValidationError(err.message, err.code);
      }
      this.logger.error(
        `Template parse failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }

    // Excel's own data validation on the cells the report will use (OV7). The cells that could still be marked
    // count too: whatever the author marks later is held to the same rule when the report is published.
    const candidates = [
      ...parsed.fields.map((f) => ({ sheetKey: f.sheetKey, address: f.address, fieldKey: f.fieldKey, type: f.type })),
      ...parsed.markableCells.map((c) => ({
        sheetKey: c.sheetKey,
        address: c.address,
        fieldKey: `${c.sheetKey}!${c.address}`,
        type: 'NUM' as const,
      })),
    ];
    const validation = deriveFromValidations(parsed.dataValidations, candidates);
    const validationIssues: ParsedIssue[] = validation.unsupported.map((u) => ({
      sheetKey: u.sheetKey,
      address: u.address,
      code: 'UNSUPPORTED_FEATURE',
      severity: 'WARNING',
      message: `Quy tắc nhập liệu của Excel: ${u.message}`,
    }));

    return {
      ...parsed,
      issues: [...parsed.issues, ...validationIssues],
      sha256,
      suggestedRules: [...suggestValidationRules(parsed.formulas), ...validation.ruleSuggestions],
      grid: await this.buildPreviewGrid(buffer, selectedSheetNames),
    };
  }

  /** Never fails the preview: the grid is a convenience over the list the wizard always had. */
  private async buildPreviewGrid(buffer: Buffer, selectedSheetNames: string[]): Promise<GridModel | null> {
    try {
      return await buildGridInWorker(buffer, selectedSheetNames);
    } catch (err) {
      this.logger.warn(
        `Preview without the grid: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
