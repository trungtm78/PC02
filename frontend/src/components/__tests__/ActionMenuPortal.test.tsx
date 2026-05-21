/**
 * ActionMenuPortal — unit tests cho v0.31.0.1 fix dropdown bị clip
 * trong overflow-hidden + overflow-x-auto card wrappers.
 *
 * Per plan-eng-review decisions:
 *   1A — Anchor detached defensive close
 *   2A — State-based anchor (HTMLElement | null), no useRef
 *   4A — rAF-throttled scroll/resize listener (covered by Tests 3+4 implicit)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { useState, useEffect, useRef } from 'react';
import { ActionMenuPortal } from '../ActionMenuPortal';

/**
 * Test harness: button + portal, controlled state.
 * Mocks getBoundingClientRect on the button so position calc has deterministic input.
 */
function Harness({
  align,
  onCloseSpy,
  rect = { top: 100, bottom: 120, left: 50, right: 80, width: 30, height: 20, x: 50, y: 100, toJSON: () => ({}) },
}: {
  align?: 'left' | 'right';
  onCloseSpy?: () => void;
  rect?: DOMRect;
}) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Mock getBoundingClientRect once button mounts.
  useEffect(() => {
    if (btnRef.current) {
      btnRef.current.getBoundingClientRect = () => rect;
    }
  }, [rect]);

  return (
    <div>
      <button
        ref={btnRef}
        data-testid="trigger-btn"
        onClick={(e) => {
          setOpen(true);
          setAnchor(e.currentTarget);
        }}
      >
        Open
      </button>
      <ActionMenuPortal
        anchor={anchor}
        open={open}
        align={align}
        onClose={() => {
          setOpen(false);
          onCloseSpy?.();
        }}
      >
        <button data-testid="menu-item-1">Item 1</button>
        <button data-testid="menu-item-2">Item 2</button>
      </ActionMenuPortal>
    </div>
  );
}

describe('ActionMenuPortal', () => {
  beforeEach(() => {
    // jsdom default: getBoundingClientRect → zeros. Harness overrides per-button.
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Test 1 — closed state renders nothing', () => {
    render(<Harness />);
    expect(screen.queryByTestId('action-menu-portal')).not.toBeInTheDocument();
  });

  it('Test 2 — open=true renders portal into document.body', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('trigger-btn'));
    await waitFor(() => expect(screen.getByTestId('action-menu-portal')).toBeInTheDocument());
    // Portal must be a child of document.body, not inside the test container.
    const portal = screen.getByTestId('action-menu-portal');
    expect(portal.closest('[data-testid="trigger-btn"]')).toBeNull();
    expect(document.body.contains(portal)).toBe(true);
  });

  it('Test 3 — position align=right: portal.left === anchor.left, top === anchor.bottom + offsetY', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('trigger-btn'));
    const portal = await screen.findByTestId('action-menu-portal');
    // rect: top:100, bottom:120, left:50, right:80 → align right (default) → left=50, top=120+4=124
    expect(portal.style.top).toBe('124px');
    expect(portal.style.left).toBe('50px');
  });

  it('Test 4 — position align=left: portal.left === anchor.right - minWidth', async () => {
    render(<Harness align="left" />);
    fireEvent.click(screen.getByTestId('trigger-btn'));
    const portal = await screen.findByTestId('action-menu-portal');
    // rect.right=80, minWidth default 240 → left = 80 - 240 = -160
    expect(portal.style.left).toBe('-160px');
  });

  it('Test 5 — click outside closes portal (onClose called)', async () => {
    const onCloseSpy = vi.fn();
    render(<Harness onCloseSpy={onCloseSpy} />);
    fireEvent.click(screen.getByTestId('trigger-btn'));
    await screen.findByTestId('action-menu-portal');

    // Dispatch mousedown on body element (outside portal + outside anchor).
    fireEvent.mouseDown(document.body);
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 6 — click on menu child does NOT close', async () => {
    const onCloseSpy = vi.fn();
    render(<Harness onCloseSpy={onCloseSpy} />);
    fireEvent.click(screen.getByTestId('trigger-btn'));
    await screen.findByTestId('action-menu-portal');

    fireEvent.mouseDown(screen.getByTestId('menu-item-1'));
    expect(onCloseSpy).not.toHaveBeenCalled();
  });

  it('Test 7 — Escape key closes portal', async () => {
    const onCloseSpy = vi.fn();
    render(<Harness onCloseSpy={onCloseSpy} />);
    fireEvent.click(screen.getByTestId('trigger-btn'));
    await screen.findByTestId('action-menu-portal');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });

  it('Test 8 (Issue 1A) — anchor detached from DOM triggers onClose on reposition', async () => {
    const onCloseSpy = vi.fn();

    // Custom harness: trigger reposition by firing scroll after anchor removed.
    function DetachHarness() {
      const [open, setOpen] = useState(false);
      const [anchor, setAnchor] = useState<HTMLElement | null>(null);
      const [showButton, setShowButton] = useState(true);

      return (
        <div>
          {showButton && (
            <button
              data-testid="trigger-btn-detach"
              ref={(el) => {
                if (el) el.getBoundingClientRect = () => ({ top: 100, bottom: 120, left: 50, right: 80, width: 30, height: 20, x: 50, y: 100, toJSON: () => ({}) } as DOMRect);
              }}
              onClick={(e) => { setOpen(true); setAnchor(e.currentTarget); }}
            >
              Open
            </button>
          )}
          <button data-testid="hide-anchor" onClick={() => setShowButton(false)}>Hide anchor</button>
          <ActionMenuPortal
            anchor={anchor}
            open={open}
            onClose={() => { setOpen(false); onCloseSpy(); }}
          >
            <button data-testid="detach-item">Item</button>
          </ActionMenuPortal>
        </div>
      );
    }

    render(<DetachHarness />);
    fireEvent.click(screen.getByTestId('trigger-btn-detach'));
    await screen.findByTestId('action-menu-portal');

    // Detach anchor by hiding the button (React unmounts it).
    await act(async () => {
      fireEvent.click(screen.getByTestId('hide-anchor'));
    });

    // Trigger scroll → updatePosition runs → detects detached anchor → calls onClose.
    await act(async () => {
      fireEvent.scroll(window);
      // rAF coalesces — flush by waiting a frame.
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });

    await waitFor(() => expect(onCloseSpy).toHaveBeenCalled());
  });
});
