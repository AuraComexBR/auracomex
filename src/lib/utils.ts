import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import React from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Group amounts by currency from an array of items */
export function groupByCurrency<T>(
  items: T[],
  currencyGetter: (item: T) => string,
  amountGetter: (item: T) => number
): Record<string, number> {
  const map: Record<string, number> = {};
  items.forEach((item) => {
    const cur = currencyGetter(item) || 'USD';
    map[cur] = (map[cur] || 0) + amountGetter(item);
  });
  return map;
}

/** Format a currency map as React elements, one per line */
export function formatCurrencyMap(map: Record<string, number>): React.ReactNode {
  const entries = Object.entries(map);
  if (entries.length === 0) return '-';
  return entries.map(([cur, val]) =>
    React.createElement('span', { key: cur, className: 'block' }, `${cur} ${val.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
  );
}

/** Format a currency map as a short inline string (e.g. "USD 12.5K / BRL 8.2K") */
export function formatCurrencyMapShort(map: Record<string, number>): string {
  const entries = Object.entries(map);
  if (entries.length === 0) return '-';
  return entries.map(([cur, val]) => {
    const abs = Math.abs(val);
    const formatted = abs >= 1000 ? `${(val / 1000).toFixed(1)}K` : val.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${cur} ${formatted}`;
  }).join(' / ');
}

/** Retorna apenas dígitos */
export function onlyDigits(v: string | null | undefined): string {
  return (v || '').replace(/\D/g, '');
}

/** Formata CNPJ 00.000.000/0000-00 */
export function formatCnpj(v: string | null | undefined): string {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Formata CPF 000.000.000-00 */
export function formatCpf(v: string | null | undefined): string {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

/** Valida CPF pelos dígitos verificadores */
export function isValidCpf(v: string | null | undefined): boolean {
  const d = onlyDigits(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (base: number) => {
    let sum = 0;
    for (let i = 0; i < base; i++) sum += parseInt(d[i]) * (base + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === parseInt(d[9]) && calc(10) === parseInt(d[10]);
}

/** Formata documento conforme o tipo */
export function formatTaxId(taxId: string | null | undefined, type?: string | null): string {
  if (!taxId) return '';
  if (type === 'CPF') return formatCpf(taxId);
  if (type === 'CNPJ') return formatCnpj(taxId);
  return taxId;
}

/** Gera URL de rastreio pública do courier a partir do provedor e número. */
export function buildCourierTrackingUrl(
  provider: string | null | undefined,
  number: string | null | undefined
): string | null {
  if (!provider || !number) return null;
  const n = encodeURIComponent(number.trim());
  switch (provider.toUpperCase()) {
    case 'DHL':
      return `https://mydhl.express.dhl/br/pt/tracking.html#/results?id=${n}`;
    case 'FEDEX':
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case 'UPS':
      return `https://www.ups.com/track?tracknum=${n}`;
    case 'TNT':
      return `https://www.tnt.com/express/pt_br/site/shipping-tools/tracking.html?searchType=con&cons=${n}`;
    default:
      return null;
  }
}
