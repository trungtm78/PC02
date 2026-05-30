import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Folder } from 'lucide-react';
import { ListPageShell } from '../ListPageShell';
import { Header } from '../Header';

describe('<ListPageShell.Header>', () => {
  it('render title trong h1 với id matching Context titleId', () => {
    render(
      <ListPageShell>
        <Header title="Danh sách vụ án" />
      </ListPageShell>,
    );
    const heading = screen.getByRole('heading', { level: 1, name: 'Danh sách vụ án' });
    expect(heading).toBeInTheDocument();
    expect(heading.id).toMatch(/^list-page-shell-.+-title$/);
    // section aria-labelledby phải point vào title id
    const section = screen.getByRole('region');
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
  });

  it('render subtitle nếu provided', () => {
    render(
      <ListPageShell>
        <Header title="X" subtitle="Phụ đề chi tiết" />
      </ListPageShell>,
    );
    expect(screen.getByText('Phụ đề chi tiết')).toBeInTheDocument();
  });

  it('không render subtitle DOM nếu không có prop', () => {
    render(
      <ListPageShell>
        <Header title="X" />
      </ListPageShell>,
    );
    expect(screen.queryByTestId('list-page-shell-header-subtitle')).not.toBeInTheDocument();
  });

  it('render icon nếu provided', () => {
    render(
      <ListPageShell>
        <Header title="X" icon={Folder} />
      </ListPageShell>,
    );
    // Lucide icons render as svg
    expect(screen.getByTestId('list-page-shell-header-icon')).toBeInTheDocument();
  });

  it('render actions slot bên phải', () => {
    render(
      <ListPageShell>
        <Header title="X" actions={<button data-testid="action-btn">Tạo mới</button>} />
      </ListPageShell>,
    );
    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
  });

  it('container dùng PAGE_HEADER token class (bg-white border-b)', () => {
    render(
      <ListPageShell>
        <Header title="X" />
      </ListPageShell>,
    );
    const header = screen.getByTestId('list-page-shell-header');
    expect(header.className).toContain('bg-white');
    expect(header.className).toContain('border-b');
  });

  it('throw nếu render ngoài <ListPageShell>', () => {
    // Suppress React error boundary noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Header title="X" />)).toThrow(/ListPageShell/);
    spy.mockRestore();
  });
});
