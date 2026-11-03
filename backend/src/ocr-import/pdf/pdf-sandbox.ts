import { HttpStatus, Injectable, Optional } from '@nestjs/common';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import { OcrImportError } from '../ocr-import-error';

export interface PdfSandboxOptions {
  maxPages: number;
  timeoutMs: number;
  /** Memory the parser may use before it is stopped. */
  maxMemoryMb?: number;
}

const DEFAULTS: PdfSandboxOptions = {
  maxPages: 20,
  timeoutMs: 20_000,
  maxMemoryMb: 256,
};

interface WorkerResult {
  pages?: Uint8Array[];
  error?: 'ENCRYPTED' | 'UNREADABLE' | 'TOO_MANY_PAGES';
  count?: number;
}

/**
 * Splits an uploaded PDF into single-page PDFs. A PDF is a program-sized file format and a hostile one can exhaust
 * memory or time, so the parsing never happens in the API's own thread: it runs in a worker with a memory ceiling and
 * a deadline, and is terminated if either is exceeded.
 */
@Injectable()
export class PdfSandbox {
  private readonly options: PdfSandboxOptions;

  constructor(@Optional() options?: Partial<PdfSandboxOptions>) {
    this.options = { ...DEFAULTS, ...(options ?? {}) };
  }

  split(bytes: Buffer): Promise<Uint8Array[]> {
    return new Promise((resolve, reject) => {
      const fail = (
        code: ConstructorParameters<typeof OcrImportError>[0],
        status = HttpStatus.UNPROCESSABLE_ENTITY,
        details = {},
      ) => reject(new OcrImportError(code, status, details));
      const worker = new Worker(path.join(__dirname, 'pdf-worker.js'), {
        workerData: {
          bytes: new Uint8Array(bytes),
          maxPages: this.options.maxPages,
        },
        resourceLimits: {
          maxOldGenerationSizeMb: this.options.maxMemoryMb ?? 256,
        },
      });
      let settled = false;
      const done = (action: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(deadline);
        void worker.terminate();
        action();
      };
      const deadline = setTimeout(
        () => done(() => fail('OCR_PDF_TOO_COMPLEX')),
        this.options.timeoutMs,
      );
      worker.once('message', (result: WorkerResult) =>
        done(() => {
          if (result.pages) return resolve(result.pages);
          if (result.error === 'ENCRYPTED') return fail('OCR_PDF_ENCRYPTED');
          if (result.error === 'TOO_MANY_PAGES') {
            return fail('OCR_PDF_TOO_MANY_PAGES', HttpStatus.CONFLICT, {
              limit: this.options.maxPages,
              pages: result.count,
            });
          }
          return fail('OCR_PDF_UNREADABLE');
        }),
      );
      // Out of memory, or the worker crashed: the file was too much for the parser.
      worker.once('error', () => done(() => fail('OCR_PDF_TOO_COMPLEX')));
      worker.once('exit', (code) => {
        if (code !== 0) done(() => fail('OCR_PDF_TOO_COMPLEX'));
      });
    });
  }
}
