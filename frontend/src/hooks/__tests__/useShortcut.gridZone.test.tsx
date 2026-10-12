import { describe, it, expect, vi } from 'vitest';
import { render as rtlRender, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { useShortcut } from '../useShortcut';

function Probe({ onSearch, onSave }: { onSearch: () => void; onSave: () => void }) {
  useShortcut('search', onSearch); // Ctrl+K, global scope: fires even inside inputs
  useShortcut('save', onSave); // F2, fires in inputs
  return (
    <div>
      <textarea data-testid="outside" />
      <div data-shortcut-zone="grid">
        <textarea data-testid="inside" />
      </div>
    </div>
  );
}

function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('useShortcut — grid keyboard zone', () => {
  it('still fires global and in-input shortcuts outside the grid', () => {
    const onSearch = vi.fn();
    const onSave = vi.fn();
    const { getByTestId } = render(<Probe onSearch={onSearch} onSave={onSave} />);
    fireEvent.keyDown(getByTestId('outside'), { key: 'k', code: 'KeyK', ctrlKey: true });
    fireEvent.keyDown(getByTestId('outside'), { key: 'F2', code: 'F2' });
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('swallows Ctrl+K and F2 typed inside the grid (they are spreadsheet keys there)', () => {
    const onSearch = vi.fn();
    const onSave = vi.fn();
    const { getByTestId } = render(<Probe onSearch={onSearch} onSave={onSave} />);
    fireEvent.keyDown(getByTestId('inside'), { key: 'k', code: 'KeyK', ctrlKey: true });
    fireEvent.keyDown(getByTestId('inside'), { key: 'F2', code: 'F2' });
    expect(onSearch).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not preventDefault a key the grid will handle itself', () => {
    const { getByTestId } = render(<Probe onSearch={vi.fn()} onSave={vi.fn()} />);
    const notCancelled = fireEvent.keyDown(getByTestId('inside'), { key: 'F2', code: 'F2' });
    expect(notCancelled).toBe(true);
  });
});
