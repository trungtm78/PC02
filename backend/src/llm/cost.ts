export interface TokenPrices {
  /** Micro-USD per million input tokens. */
  inputMicroUsdPerMTok: number | null;
  /** Micro-USD per million output tokens. */
  outputMicroUsdPerMTok: number | null;
}

const MICRO_PER_MTOK = 1_000_000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7, no daylight saving
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Cost of one call in micro-USD, or null when it cannot be known.
 *
 * Prices are entered by the administrator, never guessed in code: a wrong built-in price would make the
 * monthly cap look safe while spending without limit. No price means "unknown", not "free".
 */
export function estimateCostMicroUsd(
  usage: { inputTokens: number; outputTokens: number },
  prices: TokenPrices | null,
): number | null {
  if (
    !prices ||
    prices.inputMicroUsdPerMTok === null ||
    prices.outputMicroUsdPerMTok === null
  ) {
    return null;
  }
  return Math.round(
    (usage.inputTokens * prices.inputMicroUsdPerMTok +
      usage.outputTokens * prices.outputMicroUsdPerMTok) /
      MICRO_PER_MTOK,
  );
}

export type BudgetLevel = 'OK' | 'WARN' | 'EXHAUSTED';

/** A cap of 0 or less means unlimited. */
export function budgetLevel(
  usedMicroUsd: number,
  capMicroUsd: number,
): BudgetLevel {
  if (capMicroUsd <= 0) return 'OK';
  if (usedMicroUsd >= capMicroUsd) return 'EXHAUSTED';
  if (usedMicroUsd >= capMicroUsd * 0.8) return 'WARN';
  return 'OK';
}

/** Instant at which the current Vietnam calendar day began. */
export function dayStartVietnam(now: Date): Date {
  const shifted = now.getTime() + VIETNAM_OFFSET_MS;
  return new Date(shifted - (shifted % DAY_MS) - VIETNAM_OFFSET_MS);
}

/** Instant at which the current Vietnam calendar month began. */
export function monthStartVietnam(now: Date): Date {
  const shifted = new Date(now.getTime() + VIETNAM_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) -
      VIETNAM_OFFSET_MS,
  );
}
