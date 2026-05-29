/**
 * Tests cho <ListPageShell> root container + Context.
 *
 * Container provides:
 * - unique tableId qua Context (cho aria-controls relationships)
 * - section landmark với aria-labelledby reference từ Header
 * - vertical flex layout cho children subcomponents
 */
import { describe, it, expect } from 'vitest';
import { render, screen, renderHook } from '@testing-library/react';
import { ListPageShell, useListPageShellContext } from '../ListPageShell';

describe('<ListPageShell> root container', () => {
  it('render children trong section landmark', () => {
    render(
      <ListPageShell>
        <div data-testid="child">child content</div>
      </ListPageShell>,
    );
    const section = screen.getByRole('region');
    expect(section).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('section có aria-labelledby reference vào header id', () => {
    render(
      <ListPageShell>
        <div>x</div>
      </ListPageShell>,
    );
    const section = screen.getByRole('region');
    const ariaLabelledBy = section.getAttribute('aria-labelledby');
    expect(ariaLabelledBy).toMatch(/^list-page-shell-/);
    expect(ariaLabelledBy).toMatch(/-title$/);
  });

  it('mỗi instance có unique id (multiple shells trên cùng page không collision)', () => {
    const { container } = render(
      <>
        <ListPageShell><div>a</div></ListPageShell>
        <ListPageShell><div>b</div></ListPageShell>
      </>,
    );
    const sections = container.querySelectorAll('[role="region"]');
    expect(sections).toHaveLength(2);
    const id1 = sections[0].getAttribute('aria-labelledby');
    const id2 = sections[1].getAttribute('aria-labelledby');
    expect(id1).not.toBe(id2);
  });

  it('container có data-testid="list-page-shell" để E2E test target', () => {
    render(<ListPageShell><div>x</div></ListPageShell>);
    expect(screen.getByTestId('list-page-shell')).toBeInTheDocument();
  });
});

describe('useListPageShellContext', () => {
  it('throw nếu gọi ngoài <ListPageShell>', () => {
    expect(() => renderHook(() => useListPageShellContext())).toThrow(/ListPageShell/);
  });

  it('trả về context với titleId + tableId + uniqueId', () => {
    const { result } = renderHook(() => useListPageShellContext(), {
      wrapper: ({ children }) => <ListPageShell>{children}</ListPageShell>,
    });
    expect(result.current.titleId).toMatch(/^list-page-shell-.+-title$/);
    expect(result.current.tableId).toMatch(/^list-page-shell-.+-table$/);
    expect(result.current.uniqueId).toBeTruthy();
  });

  it('titleId + tableId share cùng uniqueId base', () => {
    const { result } = renderHook(() => useListPageShellContext(), {
      wrapper: ({ children }) => <ListPageShell>{children}</ListPageShell>,
    });
    const { uniqueId, titleId, tableId } = result.current;
    expect(titleId).toBe(`list-page-shell-${uniqueId}-title`);
    expect(tableId).toBe(`list-page-shell-${uniqueId}-table`);
  });
});
