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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value || '');
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
    setQuery(display);
    onChange(port.code);
    setOpen(false);
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
        placeholder={placeholder}
        className="font-mono text-xs"
        disabled={disabled}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover shadow-lg">
          {results.map((port) => (
            <button
              key={port.id}
              type="button"
              onClick={() => handleSelect(port)}
              className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
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
