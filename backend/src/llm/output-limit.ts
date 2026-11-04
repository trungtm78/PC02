/**
 * Whether a provider's 400 says the answer asked for is longer than the model can give (`max_tokens` above its limit).
 * Another provider may allow it, so this is not the kind of refusal that every provider would repeat.
 */
export function refusesOutputLength(detail: string | undefined): boolean {
  if (!detail) return false;
  return (
    /\b(max_tokens|max_completion_tokens|maxOutputTokens)\b/i.test(detail) ||
    /(maximum|at most|limit)[^.]{0,60}(output|completion) tokens/i.test(detail)
  );
}
