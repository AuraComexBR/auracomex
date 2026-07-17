import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

interface Props {
  value: string | number | null | undefined;
  onCommit: (v: any) => void;
  type?: 'text' | 'number';
  step?: string;
  className?: string;
  placeholder?: string;
  delay?: number;
  title?: string;
  uppercase?: boolean;
  disabled?: boolean;
}

export function DebouncedInput({
  value,
  onCommit,
  type = 'text',
  step,
  className,
  placeholder,
  delay = 600,
  title,
  uppercase = false,
  disabled = false,
}: Props) {
  const incoming = value == null ? '' : String(value);
  const [local, setLocal] = useState<string>(incoming);
  const focusedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ressincroniza quando dado remoto muda e o input não está focado
  useEffect(() => {
    if (!focusedRef.current && incoming !== local) {
      setLocal(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  const commit = (raw: string) => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (raw === incoming) return;
    if (type === 'number') {
      const n = parseFloat(raw);
      onCommit(isNaN(n) ? 0 : n);
    } else {
      onCommit(uppercase ? raw.toUpperCase() : raw);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = uppercase && type === 'text' ? e.target.value.toUpperCase() : e.target.value;
    setLocal(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(v), delay);
  };

  return (
    <Input
      className={className}
      type={type}
      step={step}
      placeholder={placeholder}
      title={title}
      disabled={disabled}
      value={local}
      onFocus={() => { focusedRef.current = true; }}
      onBlur={() => { focusedRef.current = false; commit(local); }}
      onChange={handleChange}
    />
  );
}