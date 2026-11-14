import type { ProcessingErrorCode } from '../contract/processing-codes';

/** A refusal of the pure layer. It carries a code and nothing to show: the caller turns it into its own answer. */
export class ProcessingEngineError extends Error {
  constructor(readonly code: ProcessingErrorCode) {
    super(code);
    this.name = 'ProcessingEngineError';
  }
}
