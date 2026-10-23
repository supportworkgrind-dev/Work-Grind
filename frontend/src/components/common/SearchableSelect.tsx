'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import type { LocaleOption } from '@/lib/localeOptions';

type SearchableSelectProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: LocaleOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  /** Accessible name when no <label htmlFor> points at the trigger. */
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  /** Compact trigger text (e.g. "🇵🇰 +92") instead of the full option label. */
  renderValue?: (option: LocaleOption) => string;
  maxResults?: number;
};

/**
 * Searchable single-select in the style of CountrySelect, implemented as an
 * ARIA combobox + listbox: Arrow keys, Home/End, Enter, and Escape work, the
 * active option is announced, and clicks outside close it.
 */
export function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  ariaLabel,
  disabled = false,
  className = '',
  triggerClassName = '',
  renderValue,
  maxResults = 400,
}: SearchableSelectProps) {
  const generatedId = useId();
  const baseId = id ?? `select-${generatedId}`;
  const listId = `${baseId}-listbox`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = terms.length
      ? options.filter((option) => {
          const haystack = `${option.label} ${option.description ?? ''} ${option.keywords ?? ''}`.toLowerCase();
          return terms.every((term) => haystack.includes(term));
        })
      : options;
    return matches.slice(0, maxResults);
  }, [options, query, maxResults]);

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handlePointer);
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      window.clearTimeout(timer);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const openList = () => {
    if (disabled) return;
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
    setActiveIndex(selectedIndex < maxResults ? selectedIndex : 0);
    setOpen(true);
  };

  const close = (restoreFocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (restoreFocus) triggerRef.current?.focus();
  };

  const choose = (option: LocaleOption | undefined) => {
    if (!option) return;
    onChange(option.value);
    close(true);
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => Math.min(filtered.length - 1, index + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(Math.max(0, filtered.length - 1));
        break;
      case 'Enter':
        event.preventDefault();
        choose(filtered[activeIndex]);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const triggerText = selected
    ? (renderValue ? renderValue(selected) : `${selected.leading ? `${selected.leading} ` : ''}${selected.label}`)
    : value || placeholder;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={baseId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        {...(ariaLabel ? { 'aria-label': ariaLabel } : {})}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            openList();
          }
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-white py-2.5 px-3 text-left text-xs transition-all outline-none ${
          open ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'cursor-not-allowed bg-slate-50 opacity-60' : 'cursor-pointer'} ${triggerClassName}`}
      >
        <span className={`flex min-w-0 items-center gap-2 truncate ${selected || value ? 'font-medium text-slate-900' : 'text-slate-400'}`}>
          <span className="truncate">{triggerText}</span>
          {selected?.description && !renderValue && <span className="shrink-0 text-[10px] text-slate-400">{selected.description}</span>}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180 text-indigo-600' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[16rem] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-200/80">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={filtered[activeIndex] ? `${baseId}-option-${activeIndex}` : undefined}
              aria-label={searchPlaceholder}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
              onKeyDown={onSearchKeyDown}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label={ariaLabel ?? placeholder} className="max-h-56 space-y-0.5 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <li role="presentation" className="py-6 text-center text-xs text-slate-400">No matches for &ldquo;{query}&rdquo;</li>
            ) : filtered.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === activeIndex;
              return (
                <li
                  key={option.value}
                  id={`${baseId}-option-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs ${
                    isSelected ? 'bg-indigo-50 font-semibold text-indigo-700' : isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-700'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {option.leading && <span className="shrink-0 text-base leading-none">{option.leading}</span>}
                    <span className="truncate">{option.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {option.description && <span className="text-[10px] text-slate-400">{option.description}</span>}
                    {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600" />}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
