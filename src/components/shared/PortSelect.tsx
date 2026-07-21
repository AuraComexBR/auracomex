import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MapPin, Plane, Ship } from 'lucide-react';

interface Port {
  id: string;
  code: string;
  name: string;
  city: string | null;
  country_code: string;
  country_name: string | null;
  type: string;
}

interface PortSelectProps {
  value: string;
  onChange: (code: string) => void;
  transportMode?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function getPortType(transportMode?: string): string | null {
  if (!transportMode) return null;
  if (transportMode === 'air') return 'air';
  if (transportMode.startsWith('ocean')) return 'sea';
  return null; // road/multimodal: show all
}

export function PortSelect({ value, onChange, transportMode, placeholder = 'Buscar porto/aeroporto...', className, disabled }: PortSelectProps) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<Port[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // Guarda o código do último porto selecionado/exibido, pra não sobrescrever
  // o texto amigável ("CÓDIGO - Nome") com o código puro assim que o valor
  // volta do componente pai (que só guarda o código).
  const lastKnownCodeRef = useRef<string | null>(null);

  useEffect(() => {
    // Se o valor recebido é o mesmo porto que acabamos de exibir com nome
    // (seleção local ou lookup), não mexe na exibição.
    if (value && lastKnownCodeRef.current === value) return;

    if (!value) {
      setQuery('');
      lastKnownCodeRef.current = null;
      return;
    }

    // Valor veio de fora (ex: cotação já existente) — busca o nome do porto
    // pra exibir "CÓDIGO - Nome" em vez do código sozinho.
    setQuery(value);
    let cancelled = false;
    supabase
      .from('ports')
      .select('code, name')
      .eq('code', value)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          lastKnownCodeRef.current = value;
          setQuery(`${data.code} - ${data.name}`);
        } else {
          lastKnownCodeRef.current = value;
        }
      });
    return () => { cancelled = true; };
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function search(term: string) {
    if (term.length < 2) { setResults([]); return; }
    setLoading(true);

    const portType = getPortType(transportMode);
    let q = supabase
      .from('ports')
      .select('*')
      .or(`code.ilike.%${term}%,name.ilike.%${term}%,city.ilike.%${term}%`)
      .limit(15);

    if (portType) {
      q = q.or(`type.eq.${portType},type.eq.both`);
    }

    const { data } = await q.order('code');
    setResults((data as Port[]) || []);
    setHighlighted(0);
    setLoading(false);
  }

  function handleInputChange(val: string) {
    setQuery(val);
    setOpen(true);
    search(val);
    if (!val) onChange('');
  }

  function handleSelect(port: Port) {
    const display = `${port.code} - ${port.name}`;
    lastKnownCodeRef.current = port.code;
    setQuery(display);
    onChange(port.code);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = results[highlighted] || results[0];
      if (chosen) handleSelect(chosen);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  const TypeIcon = ({ type }: { type: string }) => {
    if (type === 'air') return <Plane className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    if (type === 'sea') return <Ship className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    return <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => { if (query.length >= 2) { setOpen(true); search(query); } }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="font-mono text-xs"
        disabled={disabled}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover shadow-lg">
          {results.map((port, idx) => (
            <button
              key={port.id}
              type="button"
              onClick={() => handleSelect(port)}
              onMouseEnter={() => setHighlighted(idx)}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 text-left text-sm transition-colors',
                idx === highlighted ? 'bg-accent' : 'hover:bg-accent'
              )}
            >
              <TypeIcon type={port.type} />
              <span className="font-mono font-semibold text-xs">{port.code}</span>
              <span className="text-muted-foreground truncate">
                {port.name}, {port.city} ({port.country_code})
              </span>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && !loading && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-3 text-sm text-muted-foreground shadow-lg">
          Nenhum resultado encontrado
        </div>
      )}
    </div>
  );
}
