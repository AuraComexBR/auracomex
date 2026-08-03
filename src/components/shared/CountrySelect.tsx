import { useState, useEffect, useRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { countryCodeToFlag } from '@/lib/countryFlag';
import { COUNTRIES, resolveCountryCode } from '@/lib/countries';

interface CountrySelectProps {
  /** Stores/receives a 2-letter ISO country code (e.g. "BR"), not the country name. */
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  className?: string;
}

export function CountrySelect({ value, onChange, placeholder = 'País...', className }: CountrySelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) { setQuery(''); return; }
    // `value` should be a code, but tolerate legacy free-form names too.
    const code = resolveCountryCode(value) || value.toUpperCase();
    const found = COUNTRIES.find((c) => c.code === code);
    setQuery(found ? found.name : value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (query.length < 1) return [];
    const q = query.toLowerCase();
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query]);

  function handleInputChange(val: string) {
    setQuery(val);
    setOpen(true);
    if (!val) onChange('');
  }

  function handleSelect(country: typeof COUNTRIES[0]) {
    setQuery(country.name);
    onChange(country.code);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => { if (query.length >= 1) setOpen(true); }}
        placeholder={placeholder}
        className="text-xs"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border bg-popover shadow-lg">
          {filtered.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => handleSelect(c)}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
            >
              <span className="text-base">{countryCodeToFlag(c.code)}</span>
              <span className="truncate">{c.name}</span>
              <span className="text-muted-foreground text-xs ml-auto">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
