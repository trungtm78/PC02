import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ListPageShell } from '../ListPageShell';
import { Toolbar } from '../Toolbar';

describe('<ListPageShell.Toolbar> searchSlot', () => {
  it('có searchSlot → dựng slot thay ô chữ mặc định, không để hai ô tìm kiếm', () => {
    render(
      <ListPageShell>
        <Toolbar searchSlot={<div data-testid="o-slot" />} />
      </ListPageShell>,
    );
    expect(screen.getByTestId('o-slot')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
});
