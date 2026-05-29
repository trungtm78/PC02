/**
 * Lý do 1 item bị skip — KHÔNG phải failed. Frontend phân loại UX theo enum này.
 */
export type BulkSkipReason =
  | 'INELIGIBLE'
  | 'PERMISSION'
  | 'NOT_FOUND'
  | 'CONCURRENT_MODIFICATION'
  | 'SERVER_ERROR';

export interface BulkSkippedItem {
  id: string;
  reason: BulkSkipReason;
  message?: string;
}

export interface BulkFailedItem {
  id: string;
  error: string;
}

export interface BulkSucceededItem<T = unknown> {
  id: string;
  data?: T;
}

export interface BulkResult<T = unknown> {
  succeeded: BulkSucceededItem<T>[];
  skipped: BulkSkippedItem[];
  failed: BulkFailedItem[];
}

/**
 * Minimal Prisma interface — chỉ cần $transaction. Tránh import PrismaService
 * trực tiếp để runBulk pure (test dễ, không phụ thuộc DB).
 *
 * Generic `TTx` cho phép caller narrow type (vd `Prisma.TransactionClient`)
 * trong per-resource service mà vẫn cho test mock pass `unknown`. Codex P2
 * review (B1) yêu cầu fix này để callers không phải cast trong executeOne.
 */
interface PrismaLike<TTx = unknown> {
  $transaction: <R>(cb: (tx: TTx) => Promise<R>) => Promise<R>;
}

export interface PreflightResult {
  validIds: string[];
  skipped: BulkSkippedItem[];
}

export interface RunBulkOptions<T, TTx = unknown> {
  ids: string[];
  prisma: PrismaLike<TTx>;
  executeOne: (id: string, tx: TTx) => Promise<T>;
  /**
   * Chạy 1 lần TRƯỚC vòng lặp tx. Dùng cho scope-filter (loại id ngoài
   * dataScope → reason PERMISSION) hoặc bulk-load business state (vd
   * Case status để loại non-TIEP_NHAN → reason INELIGIBLE). Tiết kiệm
   * DB round-trip vs check trong từng tx.
   */
  preflight?: (ids: string[]) => Promise<PreflightResult>;
}

/**
 * Per-item transaction loop. CRITICAL: Postgres abort tx khi statement fail —
 * Prisma `$transaction` không auto-savepoint. Vì vậy mỗi item 1 tx riêng,
 * catch ngoài tx, accumulate kết quả. Plan eng review E-C5 chốt model này.
 *
 * Type param `TTx` cho per-resource service truyền `Prisma.TransactionClient`,
 * test mock chỉ cần dùng default `unknown`.
 */
export async function runBulk<T, TTx = unknown>(
  opts: RunBulkOptions<T, TTx>,
): Promise<BulkResult<T>> {
  const result: BulkResult<T> = {
    succeeded: [],
    skipped: [],
    failed: [],
  };

  let validIds = opts.ids;
  if (opts.preflight && opts.ids.length > 0) {
    const pre = await opts.preflight(opts.ids);
    validIds = pre.validIds;
    result.skipped.push(...pre.skipped);
  }

  for (const id of validIds) {
    try {
      const data = await opts.prisma.$transaction(async (tx) =>
        opts.executeOne(id, tx),
      );
      result.succeeded.push({ id, data });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      result.failed.push({ id, error });
    }
  }
  return result;
}
