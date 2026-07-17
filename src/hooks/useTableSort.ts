import { useEffect, useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc' | null;
export type Accessor<T> = (row: T) => unknown;

export interface SortState {
  key: string | null;
  dir: SortDir;
}

export interface UseTableSortOptions {
  storageKey?: string;
}

function loadState(storageKey?: string): SortState {
  if (!storageKey) return { key: null, dir: null };
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { key: null, dir: null };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.key === 'string' && (parsed.dir === 'asc' || parsed.dir === 'desc')) {
      return { key: parsed.key, dir: parsed.dir };
    }
  } catch {
    // ignore
  }
  return { key: null, dir: null };
}

function compare(a: unknown, b: unknown): number {
  const aNil = a === null || a === undefined || a === '';
  const bNil = b === null || b === undefined || b === '';
  if (aNil && bNil) return 0;
  if (aNil) return 1; // nulls last
  if (bNil) return -1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;

  const as = String(a);
  const bs = String(b);

  // Try date parse if looks like an ISO date
  const aDate = Date.parse(as);
  const bDate = Date.parse(bs);
  if (!isNaN(aDate) && !isNaN(bDate) && /\d{4}-\d{2}-\d{2}/.test(as) && /\d{4}-\d{2}-\d{2}/.test(bs)) {
    return aDate - bDate;
  }

  const an = Number(as);
  const bn = Number(bs);
  if (!isNaN(an) && !isNaN(bn) && as.trim() !== '' && bs.trim() !== '') return an - bn;

  return as.localeCompare(bs, undefined, { sensitivity: 'base' });
}

export function useTableSort<T>(
  rows: T[],
  accessors: Record<string, Accessor<T>>,
  options: UseTableSortOptions = {},
) {
  const { storageKey } = options;
  const [state, setState] = useState<SortState>(() => loadState(storageKey));

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (state.key && state.dir) {
        localStorage.setItem(storageKey, JSON.stringify(state));
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      // ignore (private mode / quota)
    }
  }, [state, storageKey]);

  const toggleSort = (key: string) => {
    setState((prev) => {
      if (prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return { key: null, dir: null };
    });
  };

  const sorted = useMemo(() => {
    if (!state.key || !state.dir) return rows;
    const accessor = accessors[state.key];
    if (!accessor) return rows;
    const copy = [...rows];
    const mult = state.dir === 'asc' ? 1 : -1;
    copy.sort((a, b) => compare(accessor(a), accessor(b)) * mult);
    return copy;
  }, [rows, state, accessors]);

  return { sorted, sortState: state, toggleSort };
}