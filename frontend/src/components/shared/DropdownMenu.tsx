import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DropdownMenuProps {
  /** Nội dung nút mở menu (vd icon ⋮). */
  trigger: ReactNode;
  /** Menu item — nhận `close` để đóng menu sau khi bấm. */
  children: (close: () => void) => ReactNode;
  /** Canh panel theo mép phải (mặc định) hay trái. */
  align?: 'left' | 'right';
  triggerClassName?: string;
  testId?: string;
  triggerLabel?: string;
}

/**
 * Menu thả xuống nhỏ, accessible: bấm trigger để mở; click-outside + Esc để đóng.
 * App chưa có component này — dùng chung cho cột thao tác (kebab) + nơi khác.
 */
export function DropdownMenu({
  trigger,
  children,
  align = 'right',
  triggerClassName,
  testId,
  triggerLabel,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
        triggerRef.current?.focus(); // trả focus về trigger khi đóng bằng Esc
      }
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Mở menu → đưa focus vào item đầu (chuẩn menu pattern, a11y — codex P2).
  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(idx + 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        data-testid={testId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        className={triggerClassName}
        onClick={() => setOpen((v) => !v)}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className={cn(
            'absolute z-20 mt-1 min-w-[10rem] rounded-md border border-slate-200 bg-white py-1 shadow-lg',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
  testId?: string;
}

/** 1 mục trong DropdownMenu (full-width, hover). `danger` = thao tác phá hủy (đỏ). */
export function DropdownItem({ onClick, children, danger, testId }: DropdownItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      data-testid={testId}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50',
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
