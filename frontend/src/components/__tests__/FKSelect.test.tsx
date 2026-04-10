import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FKSelect } from '../FKSelect';
import type { FKOption } from '../FKSelect';

// ─── Mock scrollIntoView (not available in jsdom) ──────────────────────────

Element.prototype.scrollIntoView = vi.fn();

// ─── Mock useDirectoryOptions ──────────────────────────────────────────────

const mockDirectoryData: FKOption[] = [
  { value: 'Vi phạm hành chính', label: 'Vi phạm hành chính' },
  { value: 'Tranh chấp dân sự', label: 'Tranh chấp dân sự' },
  { value: 'An ninh trật tự', label: 'An ninh trật tự' },
];

vi.mock('@/hooks/useDirectoryOptions', () => ({
  useDirectoryOptions: (type: string | undefined) => {
    if (!type) return { data: undefined, isLoading: false };
    if (type === 'LOADING_TYPE') return { data: undefined, isLoading: true };
    return { data: mockDirectoryData, isLoading: false };
  },
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

const TEST_OPTIONS: FKOption[] = [
  { value: 'opt1', label: 'Vi Phạm Hành Chính' },
  { value: 'opt2', label: 'Tranh Chấp Dân Sự' },
  { value: 'opt3', label: 'An Ninh Trật Tự' },
  { value: 'opt4', label: 'Khác' },
];

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderFKSelect(props: Partial<React.ComponentProps<typeof FKSelect>> = {}) {
  const defaultProps = {
    label: 'Test Label',
    value: '',
    onChange: vi.fn(),
    options: TEST_OPTIONS,
    testId: 'fk-test',
    ...props,
  };
  return { ...render(<FKSelect {...defaultProps} />, { wrapper }), onChange: defaultProps.onChange };
}

function openDropdown() {
  fireEvent.click(screen.getByTestId('fk-test-trigger'));
}

function getSearchInput() {
  return screen.getByTestId('fk-test-search');
}

// ─── Keyboard Navigation Tests (8) ────────────────────────────────────────

describe('FKSelect - Keyboard Navigation', () => {
  it('ArrowDown moves highlight to next option', () => {
    renderFKSelect();
    openDropdown();
    const input = getSearchInput();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // First option should be highlighted (index 0)
    const options = screen.getAllByRole('button').filter(b => b.getAttribute('data-option-index') !== null);
    expect(options[0]).toHaveClass('bg-blue-100');
  });

  it('ArrowDown wraps from last to first', () => {
    renderFKSelect();
    openDropdown();
    const input = getSearchInput();

    // Navigate past last item: -1->0->1->2->3->0 (5 presses to wrap)
    for (let i = 0; i <= TEST_OPTIONS.length; i++) {
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    }
    // Should wrap to first
    const options = screen.getAllByRole('button').filter(b => b.getAttribute('data-option-index') !== null);
    expect(options[0]).toHaveClass('bg-blue-100');
  });

  it('ArrowUp moves highlight to previous option', () => {
    renderFKSelect();
    openDropdown();
    const input = getSearchInput();

    // Go down twice, then up once
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    const options = screen.getAllByRole('button').filter(b => b.getAttribute('data-option-index') !== null);
    expect(options[0]).toHaveClass('bg-blue-100');
  });

  it('ArrowUp wraps from first to last', () => {
    renderFKSelect();
    openDropdown();
    const input = getSearchInput();

    // ArrowUp when no highlight should go to last
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    const options = screen.getAllByRole('button').filter(b => b.getAttribute('data-option-index') !== null);
    expect(options[options.length - 1]).toHaveClass('bg-blue-100');
  });

  it('Enter selects the highlighted option', () => {
    const { onChange } = renderFKSelect();
    openDropdown();
    const input = getSearchInput();

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('opt1');
  });

  it('Enter selects first option when no highlight', () => {
    const { onChange } = renderFKSelect();
    openDropdown();
    const input = getSearchInput();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('opt1');
  });

  it('Escape closes the dropdown', () => {
    renderFKSelect();
    openDropdown();
    expect(screen.getByTestId('fk-test-dropdown')).toBeInTheDocument();

    const input = getSearchInput();
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByTestId('fk-test-dropdown')).not.toBeInTheDocument();
  });

  it('highlight resets when search query changes', async () => {
    renderFKSelect();
    openDropdown();
    const input = getSearchInput();

    // Highlight first option
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // Type something — highlight should reset
    fireEvent.change(input, { target: { value: 'Vi' } });

    // After typing, first filtered option should NOT have highlight class
    // (highlight resets to -1)
    await waitFor(() => {
      const options = screen.getAllByRole('button').filter(b => b.getAttribute('data-option-index') !== null);
      // None should have bg-blue-100 (highlight color), only hover/selected classes
      const highlighted = options.filter(o => o.classList.contains('bg-blue-100'));
      expect(highlighted).toHaveLength(0);
    });
  });
});

// ─── Abbreviation Matching Tests (4) ───────────────────────────────────────

describe('FKSelect - Abbreviation Matching', () => {
  it('"VPHC" matches "Vi Phạm Hành Chính"', () => {
    renderFKSelect();
    openDropdown();
    const input = getSearchInput();

    fireEvent.change(input, { target: { value: 'VPHC' } });

    expect(screen.getByText('Vi Phạm Hành Chính')).toBeInTheDocument();
  });

  it('abbreviation matching is case-insensitive', () => {
    renderFKSelect();
    openDropdown();
    const input = getSearchInput();

    fireEvent.change(input, { target: { value: 'tcds' } });

    expect(screen.getByText('Tranh Chấp Dân Sự')).toBeInTheDocument();
  });

  it('single-word labels do not break abbreviation match', () => {
    renderFKSelect();
    openDropdown();
    const input = getSearchInput();

    fireEvent.change(input, { target: { value: 'K' } });

    // "Khác" should appear (single word, initial "K")
    // But abbreviation requires 2+ chars, so this falls through to fuzzy
    expect(screen.getByText('Khác')).toBeInTheDocument();
  });

  it('empty query returns all options', () => {
    renderFKSelect();
    openDropdown();

    const options = screen.getAllByRole('button').filter(b => b.getAttribute('data-option-index') !== null);
    expect(options).toHaveLength(TEST_OPTIONS.length);
  });
});

// ─── directoryType Auto-fetch Tests (3) ────────────────────────────────────

describe('FKSelect - directoryType auto-fetch', () => {
  it('renders options from Directory API when directoryType is set', () => {
    renderFKSelect({ options: undefined, directoryType: 'INCIDENT_TYPE' });
    openDropdown();

    expect(screen.getByText('Vi phạm hành chính')).toBeInTheDocument();
    expect(screen.getByText('Tranh chấp dân sự')).toBeInTheDocument();
  });

  it('shows loading state while fetching directory data', () => {
    renderFKSelect({ options: undefined, directoryType: 'LOADING_TYPE' });
    openDropdown();

    expect(screen.getByText('Đang tải...')).toBeInTheDocument();
  });

  it('falls back to options prop when directoryType is not set', () => {
    renderFKSelect({ directoryType: undefined });
    openDropdown();

    expect(screen.getByText('Vi Phạm Hành Chính')).toBeInTheDocument();
    expect(screen.getByText('Khác')).toBeInTheDocument();
  });
});
