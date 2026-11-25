import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Check, Loader2, Search, X } from 'lucide-react';
import { useListboxNav, laDangGoDau } from '@/hooks/useListboxNav';
import { smartMatch } from '@/components/fk-match';
import { LABEL_BASE, FIELD_ERROR_TEXT } from '@/constants/styles';
import { multiFKSelect as T } from '@/locales/vi';

export interface MultiFKOption {
  value: string;
  label: string;
  /** A second line under the label, e.g. who holds it now. Searched too. */
  hint?: string;
  /** Held elsewhere: shown, never chosen from here. */
  taken?: boolean;
}

interface MultiFKSelectProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiFKOption[];
  /** Labels of chosen values that are not among the options (a ward team no longer active, say). */
  selectedLabels?: Record<string, string>;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  testId?: string;
}

/**
 * Type-to-find MULTI select with chips: FKSelect's matching (accent-insensitive, initials) and keyboard, for picking
 * many. A chip is removed with its ×, or with Backspace in an empty search. Choosing keeps the list open, so several
 * are picked in a row; Escape or a click outside closes it.
 *
 * Test ids: `<testId>-trigger`, `-search`, `-option-<value>`, `-chip-<value>`, `-chip-remove-<value>`.
 */
export function MultiFKSelect({
  label,
  values,
  onChange,
  options,
  selectedLabels,
  loading = false,
  disabled = false,
  error,
  placeholder = T.placeholder,
  searchPlaceholder = T.searchPlaceholder,
  testId,
}: MultiFKSelectProps) {
  const baseId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tid = (suffix: string) => (testId ? `${testId}-${suffix}` : undefined);

  const chosen = new Set(values);
  const labelOf = (value: string) => options.find((o) => o.value === value)?.label ?? selectedLabels?.[value] ?? value;
  const visible = options.filter((o) => smartMatch(o.label, query) || (o.hint ? smartMatch(o.hint, query) : false));
  const listKey = visible.map((o) => o.value).join('\u0000');

  // Locked while open (the form switched to read-only): the list closes, so nothing can be chosen any more.
  const open = isOpen && !disabled;

  useEffect(() => {
    function outside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /** A chosen option is un-chosen; a taken one is never chosen from here (the hint says who holds it). */
  const toggle = (option: MultiFKOption) => {
    if (disabled) return;
    if (chosen.has(option.value)) onChange(values.filter((v) => v !== option.value));
    else if (!option.taken) onChange([...values, option.value]);
  };

  const remove = (value: string) => {
    if (disabled) return;
    onChange(values.filter((v) => v !== value));
  };

  const nav = useListboxNav({
    count: visible.length,
    resetKey: `${open}\u0000${query}\u0000${listKey}`,
    idPrefix: baseId,
    onSelect: (i) => {
      const option = visible[i];
      if (option) toggle(option);
    },
    onEscape: () => {
      setIsOpen(false);
      setQuery('');
    },
  });

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (laDangGoDau(e)) return;
    if (e.key === 'Backspace' && !query && values.length) {
      e.preventDefault();
      remove(values[values.length - 1]);
      return;
    }
    nav.onKeyDown(e);
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return; // a chip's own button handles its keys
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative" data-testid={testId}>
      <label className={LABEL_BASE}>{label}</label>
      <div
        role="combobox"
        tabIndex={0}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${baseId}-list`}
        aria-label={label}
        aria-disabled={disabled || undefined}
        onClick={disabled ? undefined : () => setIsOpen((was) => !was)}
        onKeyDown={disabled ? undefined : onTriggerKeyDown}
        data-testid={tid('trigger')}
        className={`w-full min-h-[42px] flex items-center justify-between gap-2 px-3 py-1.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          error ? 'border-red-300' : 'border-slate-300'
        } ${open ? 'ring-2 ring-blue-500 border-blue-500' : ''} ${disabled ? 'bg-slate-50 cursor-default' : 'bg-white cursor-pointer'}`}
      >
        <div className="flex flex-wrap gap-1.5 flex-1">
          {values.length === 0 && <span className="text-sm text-slate-400 py-1">{placeholder}</span>}
          {values.map((value) => (
            <span
              key={value}
              data-testid={tid(`chip-${value}`)}
              className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 text-xs px-2 py-1 rounded-full"
            >
              {labelOf(value)}
              {!disabled && (
                <button
                  type="button"
                  aria-label={T.remove(labelOf(value))}
                  data-testid={tid(`chip-remove-${value}`)}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(value);
                  }}
                  className="hover:bg-blue-100 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>
      {error && <p className={FIELD_ERROR_TEXT}>{error}</p>}

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden" data-testid={tid('dropdown')}>
          <div className="p-2 border-b border-slate-200">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-label={T.searchLabel(label)}
                aria-controls={`${baseId}-list`}
                aria-activedescendant={nav.activeDescendantId}
                data-testid={tid('search')}
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{T.selectedCount(values.length)}</p>
          </div>
          <div role="listbox" id={`${baseId}-list`} aria-label={label} aria-multiselectable="true" className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-sm text-slate-500">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin mr-2" />
                {T.loading}
              </div>
            ) : visible.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500" data-testid={tid(query.trim() ? 'no-result' : 'empty')}>
                {query.trim() ? T.noResult : T.empty}
              </div>
            ) : (
              visible.map((option, index) => {
                const selected = chosen.has(option.value);
                const active = index === nav.activeIndex;
                const blocked = option.taken && !selected;
                return (
                  <button
                    key={option.value}
                    id={nav.optionId(index)}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    aria-disabled={blocked || undefined}
                    data-taken={option.taken ? 'true' : undefined}
                    data-testid={tid(`option-${option.value}`)}
                    onClick={() => toggle(option)}
                    className={`w-full text-left px-4 py-2 text-sm flex items-start gap-2 ${
                      active ? 'bg-blue-100' : selected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    } ${blocked ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700'}`}
                  >
                    <span className="w-4 h-4 mt-0.5 shrink-0">{selected && <Check className="w-4 h-4 text-blue-600" />}</span>
                    <span className="flex-1">
                      <span className={selected ? 'font-medium text-blue-800' : ''}>{option.label}</span>
                      {option.hint && (
                        <span className={`block text-xs ${option.taken ? 'text-amber-700' : 'text-slate-500'}`}>{option.hint}</span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
