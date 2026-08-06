import React, { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

interface Props {
  value: string | number | null | undefined;
  onCommit: (v: any) => void;
  type?: 'text' | 'number';
  step?: string;
  className?: string;
  placeholder?: string;
  /** @deprecated não é mais usado — o campo só confirma (commit) ao perder o foco, não mais por um debounce enquanto digita. Mantido só pra não quebrar chamadas existentes. */
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
  title,
  uppercase = false,
  disabled = false,
}: Props) {
  const incoming = value == null ? '' : String(value);
  const [local, setLocal] = useState<string>(incoming);
  const focusedRef = useRef(false);

  // Ressincroniza quando dado remoto muda e o input não está focado
  useEffect(() => {
    if (!focusedRef.current && incoming !== local) {
      setLocal(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming]);

  const commit = (raw: string) => {
    if (raw === incoming) return;
    if (type === 'number') {
      const n = parseFloat(raw);
      onCommit(isNaN(n) ? 0 : n);
    } else {
      onCommit(uppercase ? raw.toUpperCase() : raw);
    }
  };

  // Antes confirmava (commit) sozinho 600ms depois da última tecla — o que
  // também empurrava o auto-save do lote (handleSave) pro meio da digitação.
  // Agora só atualiza o valor visual local ao digitar; a confirmação (e o
  // auto-save) só acontece quando o campo perde o foco (onBlur).
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = uppercase && type === 'text' ? e.target.value.toUpperCase() : e.target.value;
    setLocal(v);
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