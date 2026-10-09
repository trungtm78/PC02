import { Injectable, Logger } from '@nestjs/common';
import {
  assertMagicBytes,
  assertCompressedSize,
  assertNoZipBomb,
  computeSha256,
  HostileXlsxError,
} from '../../xlsx-imports/hostile-xlsx-guard';
import { parseTemplateInWorker } from './parse-in-worker';
import { assertNoMacro, MacroDetectedError } from './macro-guard';
import { TemplateLimitError } from './limits';
import { suggestValidationRules } from './suggest-rules';
import type { ParseTemplateResult } from './types';
import type { SuggestedRule } from './suggest-rules';

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
  suggestedRules: SuggestedRule[];
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

  async validateAndParse(
    buffer: Buffer,
    selectedSheetNames: string[],
  ): Promise<ValidateAndParseResult> {
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

    return {
      ...parsed,
      sha256,
      suggestedRules: suggestValidationRules(parsed.formulas),
    };
  }
}
