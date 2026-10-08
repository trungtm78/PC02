import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as renderBase, type RenderOptions } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
export * from '@testing-library/react';
export function render(ui: ReactNode, options?: RenderOptions) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ExistingWrapper = options?.wrapper;
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client, children: ExistingWrapper ? createElement(ExistingWrapper, null, children) : children });
  }
  return renderBase(ui, { ...options, wrapper: Wrapper });
}
