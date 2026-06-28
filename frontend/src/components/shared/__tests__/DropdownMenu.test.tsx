import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DropdownMenu, DropdownItem } from '../DropdownMenu';

function setup(onPick = vi.fn()) {
  render(
    <div>
      <button data-testid="outside">outside</button>
      <DropdownMenu trigger="⋮" testId="kebab" triggerLabel="Thao tác khác">
        {(close) => (
          <DropdownItem testId="item-del" danger onClick={() => { onPick(); close(); }}>
            Xoá
          </DropdownItem>
        )}
      </DropdownMenu>
    </div>,
  );
  return { onPick };
}

describe('DropdownMenu', () => {
  it('mặc định đóng; bấm trigger → mở menu', () => {
    setup();
    expect(screen.queryByTestId('item-del')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('kebab'));
    expect(screen.getByTestId('item-del')).toBeInTheDocument();
    expect(screen.getByTestId('kebab')).toHaveAttribute('aria-expanded', 'true');
  });

  it('bấm item → gọi onClick + đóng menu', () => {
    const { onPick } = setup();
    fireEvent.click(screen.getByTestId('kebab'));
    fireEvent.click(screen.getByTestId('item-del'));
    expect(onPick).toHaveBeenCalled();
    expect(screen.queryByTestId('item-del')).not.toBeInTheDocument();
  });

  it('click-outside → đóng', () => {
    setup();
    fireEvent.click(screen.getByTestId('kebab'));
    expect(screen.getByTestId('item-del')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('item-del')).not.toBeInTheDocument();
  });

  it('Esc → đóng', () => {
    setup();
    fireEvent.click(screen.getByTestId('kebab'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('item-del')).not.toBeInTheDocument();
  });
});
