import { useCallback, useState } from 'react';

/**
 * v0.67 PR1 T2 — useModalLifecycle hook (Issue I4 from /plan-eng-review).
 *
 * Generic state machine shared by all 7 modal providers:
 *
 *   idle ──open(args)──> open ──submit(payload)──> loading ──success──> idle
 *                          │                          │
 *                          │                          └─────error──> open + error
 *                          └────close()──> idle
 *
 * Eliminates ~30 LOC boilerplate per provider. State management lives here,
 * UI rendering lives in the consumer provider.
 */

export interface UseModalLifecycleArgs<TArgs, TResult, TPayload = void> {
  submitFn: (args: TArgs, payload: TPayload) => Promise<TResult>;
  onSuccess?: (result: TResult, args: TArgs) => void;
}

export interface UseModalLifecycleResult<TArgs, TPayload = void> {
  args: TArgs | null;
  isOpen: boolean;
  isLoading: boolean;
  error: string | null;
  open: (args: TArgs) => void;
  close: () => void;
  submit: (payload: TPayload) => Promise<void>;
}

function extractErrorMessage(e: unknown): string {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.message) return err.message;
  return 'Lỗi không xác định';
}

export function useModalLifecycle<TArgs, TResult, TPayload = void>({
  submitFn,
  onSuccess,
}: UseModalLifecycleArgs<TArgs, TResult, TPayload>): UseModalLifecycleResult<TArgs, TPayload> {
  const [args, setArgs] = useState<TArgs | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback((next: TArgs) => {
    setArgs(next);
    setError(null);
  }, []);

  const close = useCallback(() => {
    setArgs(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const submit = useCallback(
    async (payload: TPayload) => {
      if (!args) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await submitFn(args, payload);
        onSuccess?.(result, args);
        setArgs(null);
        setError(null);
      } catch (e) {
        setError(extractErrorMessage(e));
      } finally {
        setIsLoading(false);
      }
    },
    [args, submitFn, onSuccess],
  );

  return {
    args,
    isOpen: args !== null,
    isLoading,
    error,
    open,
    close,
    submit,
  };
}
