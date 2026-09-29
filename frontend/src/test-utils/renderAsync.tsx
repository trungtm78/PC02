import { act, render, type RenderOptions, type RenderResult } from '@testing-library/react';
import type { ReactNode } from 'react';

/** Render and settle effects started by the initial commit inside one act boundary. */
export async function renderAsync(
  ui: ReactNode,
  options?: RenderOptions,
): Promise<RenderResult> {
  let result: RenderResult | undefined;
  await act(async () => {
    result = render(ui, options);
  });
  if (!result) throw new Error('Render did not produce a result');
  return result;
}
