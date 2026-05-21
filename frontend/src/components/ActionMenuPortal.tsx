import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";

interface ActionMenuPortalProps {
  /**
   * Anchor DOM element. Pass via state (e.g. `setOpenMenu({id, anchor: e.currentTarget})`)
   * — no ref needed, enables inline JSX inside .map() without per-row component extraction.
   */
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Horizontal alignment relative to anchor. Default 'right' (menu's LEFT = anchor's LEFT). */
  align?: "left" | "right";
  /** Px offset below anchor. Default 4. */
  offsetY?: number;
  /** Min width. Default 240 (matches old `w-60`). */
  minWidth?: number;
}

/**
 * Renders dropdown menu via React Portal to document.body, bypassing parent
 * overflow constraints. Used for action menus inside scrollable tables where
 * a parent `overflow-x-auto` would clip an inline absolute dropdown (CSS spec
 * forces overflow-y to auto when overflow-x is non-visible).
 *
 * Design decisions (v0.31.0.1 plan-eng-review):
 * - 2A: state-based `anchor: HTMLElement | null` (not useRef) — caller passes
 *   `e.currentTarget` on click. Enables inline JSX inside `.map()` rows.
 * - 1A: defensive close — if anchor detaches from DOM mid-open (parent
 *   re-render unmounts row), trigger onClose instead of rendering at (0,0).
 * - 4A: scroll/resize listener wrapped in requestAnimationFrame — coalesces
 *   60Hz scroll events into single position update per paint cycle.
 *
 * See commit history d81cdbe / ef92357 / 5d6622e for prior CSS-only attempts
 * (all failed: CSS spec ép overflow-y → auto khi overflow-x là non-visible).
 */
export function ActionMenuPortal({
  anchor,
  open,
  onClose,
  children,
  align = "right",
  offsetY = 4,
  minWidth = 240,
}: ActionMenuPortalProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Compute position from anchor. Defensive: close if anchor detached from DOM.
  const updatePosition = useCallback(() => {
    if (!anchor || !document.body.contains(anchor)) {
      onClose();
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const top = rect.bottom + offsetY;
    const left = align === "right" ? rect.left : rect.right - minWidth;
    setPos({ top, left });
  }, [anchor, align, offsetY, minWidth, onClose]);

  // On open: compute initial position + subscribe to scroll/resize (rAF-throttled).
  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
    let rafId: number | null = null;
    const onScrollOrResize = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updatePosition();
      });
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePosition]);

  // Click-outside detection (mousedown so it fires before menu item click handler).
  useEffect(() => {
    if (!open) return;
    const handleMouseDown = (e: MouseEvent) => {
      const menu = menuRef.current;
      const target = e.target as Node;
      if (menu?.contains(target)) return;
      if (anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, onClose, anchor]);

  // Escape key.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open || !pos) return null;

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, minWidth, zIndex: 9999 }}
      className="bg-white border border-slate-200 rounded-lg shadow-lg"
      role="menu"
      data-testid="action-menu-portal"
    >
      {children}
    </div>,
    document.body,
  );
}
