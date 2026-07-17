/**
 * Mapeamento Taxas (quote_charges) → Estimativa de Custo.
 * Tudo em USD internamente; despesas locais convertidas para BRL.
 */

export interface ChargeLike {
  id: string;
  description: string | null;
  leg: string | null;
  charge_type: string | null;
  billing_unit: string | null;
  currency: string | null;
  sell_amount: number | null;
  buy_amount: number | null;
  aduaneira?: boolean | null;
}

export interface FxRates {
  usd_brl: number;
  eur_brl: number;
}

export interface MappedExpense {
  descricao: string;
  valor_brl: number;
  valor_original: number;
  moeda_original: string;
  aduaneira: boolean;
  source_charge_id: string;
  category: 'origin' | 'freight' | 'destination' | 'local';
}

export interface MappedEstimate {
  frete_intl_usd: number;
  seguro_intl_usd: number;
  acrescimos_usd: number;
  deducoes_usd: number;
  expenses: MappedExpense[];
  ignored: Array<{ description: string; currency: string; amount: number }>;
}

const ADUANEIRA_KEYWORDS = ['ARMAZENAGEM', 'DESEMBARAÇO', 'DESEMBARACO', 'CAPATAZIA', 'ISPS', 'THC', 'TAXAS DE DESTINO'];
const FRETE_KEYWORDS = ['FRETE', 'FREIGHT', 'OCEAN FREIGHT', 'AIR FREIGHT'];
const SEGURO_KEYWORDS = ['SEGURO', 'INSURANCE'];

function hasKeyword(text: string, list: string[]): boolean {
  const up = (text || '').toUpperCase();
  return list.some(k => up.includes(k));
}

/** Retorna true se houver pelo menos uma taxa de seguro entre as charges (independente de valor). */
export function chargesHaveInsurance(charges: ChargeLike[] | null | undefined): boolean {
  if (!charges || charges.length === 0) return false;
  return charges.some(c => hasKeyword(c.description || '', SEGURO_KEYWORDS));
}

/** Converte qualquer moeda para USD usando o câmbio fornecido. Retorna null se não suportada. */
function toUSD(amount: number, currency: string, fx: FxRates): number | null {
  const cur = (currency || 'USD').toUpperCase();
  if (cur === 'USD') return amount;
  if (cur === 'BRL') return fx.usd_brl > 0 ? amount / fx.usd_brl : null;
  if (cur === 'EUR') return fx.usd_brl > 0 && fx.eur_brl > 0 ? (amount * fx.eur_brl) / fx.usd_brl : null;
  return null;
}

function toBRL(amount: number, currency: string, fx: FxRates): number | null {
  const cur = (currency || 'USD').toUpperCase();
  if (cur === 'BRL') return amount;
  if (cur === 'USD') return amount * fx.usd_brl;
  if (cur === 'EUR') return amount * fx.eur_brl;
  return null;
}

export function mapChargesToEstimate(
  charges: ChargeLike[],
  fx: FxRates,
  getMultiplier: (unit: string) => number
): MappedEstimate {
  const out: MappedEstimate = {
    frete_intl_usd: 0,
    seguro_intl_usd: 0,
    acrescimos_usd: 0,
    deducoes_usd: 0,
    expenses: [],
    ignored: [],
  };

  for (const c of charges) {
    const desc = (c.description || '').trim();
    const cur = (c.currency || 'USD').toUpperCase();
    const mult = getMultiplier(c.billing_unit || 'fixed');
    const rawAmount = (Number(c.sell_amount) || 0) * mult;
    if (rawAmount === 0) continue;

    const isDiscount = desc.toUpperCase().includes('DESCONTO');
    // Frete internacional: SOMENTE quando leg === 'freight' (inclui rodoviário internacional/Mercosul).
    // Frete com leg 'origin'/'destination' é doméstico e NÃO entra no VMLD nem no ICMS.
    const isFrete = c.leg === 'freight' && (hasKeyword(desc, FRETE_KEYWORDS) || c.charge_type === 'freight');
    const isSeguro = c.leg === 'freight' && hasKeyword(desc, SEGURO_KEYWORDS);
    const isFreteDomestico = hasKeyword(desc, FRETE_KEYWORDS) && c.leg !== 'freight';
    const isAduaneira = hasKeyword(desc, ADUANEIRA_KEYWORDS);

    // Calculamos o valor em BRL para exibição e armazenamento
    const brl = toBRL(rawAmount, cur, fx);

    if (isDiscount) {
      const usd = toUSD(Math.abs(rawAmount), cur, fx);
      if (usd == null) { out.ignored.push({ description: desc, currency: cur, amount: rawAmount }); continue; }
      out.deducoes_usd += usd;
      continue;
    }

    if (isFrete) {
      const usd = toUSD(rawAmount, cur, fx);
      if (usd == null) { out.ignored.push({ description: desc, currency: cur, amount: rawAmount }); continue; }
      out.frete_intl_usd += usd;
      
      if (brl != null) {
        out.expenses.push({
          descricao: desc.toUpperCase(),
          valor_brl: brl,
          valor_original: rawAmount,
          moeda_original: cur,
          aduaneira: typeof c.aduaneira === 'boolean' ? c.aduaneira : false,
          source_charge_id: c.id,
          category: 'freight'
        });
      }
      continue;
    }

    if (isSeguro) {
      const usd = toUSD(rawAmount, cur, fx);
      if (usd == null) { out.ignored.push({ description: desc, currency: cur, amount: rawAmount }); continue; }
      out.seguro_intl_usd += usd;
      
      if (brl != null) {
        out.expenses.push({
          descricao: desc.toUpperCase(),
          valor_brl: brl,
          valor_original: rawAmount,
          moeda_original: cur,
          aduaneira: typeof c.aduaneira === 'boolean' ? c.aduaneira : false,
          source_charge_id: c.id,
          category: 'freight' // Seguro entra no card de Frete
        });
      }
      continue;
    }

    if (c.leg === 'origin') {
      const usd = toUSD(rawAmount, cur, fx);
      if (usd != null) out.acrescimos_usd += usd;

      if (brl != null) {
        out.expenses.push({ 
          descricao: desc.toUpperCase(), 
          valor_brl: brl,
          valor_original: rawAmount,
          moeda_original: cur,
          aduaneira: typeof c.aduaneira === 'boolean' ? c.aduaneira : false, 
          source_charge_id: c.id,
          category: 'origin'
        });
      } else {
        out.ignored.push({ description: desc, currency: cur, amount: rawAmount });
      }
      continue;
    }

    if (c.leg === 'destination') {
      if (brl == null) { out.ignored.push({ description: desc, currency: cur, amount: rawAmount }); continue; }
      out.expenses.push({ 
        descricao: desc.toUpperCase(), 
        valor_brl: brl,
        valor_original: rawAmount,
        moeda_original: cur,
        aduaneira: isFreteDomestico
          ? false
          : (typeof c.aduaneira === 'boolean' ? c.aduaneira : isAduaneira),
        source_charge_id: c.id,
        category: 'destination'
      });
      continue;
    }

    // Fallback (leg desconhecido): trata como despesa local
    if (brl == null) { out.ignored.push({ description: desc, currency: cur, amount: rawAmount }); continue; }
    out.expenses.push({ 
      descricao: desc.toUpperCase(), 
      valor_brl: brl,
      valor_original: rawAmount,
      moeda_original: cur,
      aduaneira: isFreteDomestico
        ? false
        : (typeof c.aduaneira === 'boolean' ? c.aduaneira : isAduaneira),
      source_charge_id: c.id,
      category: 'local'
    });
  }

  // round 2 casas
  const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
  out.frete_intl_usd = r2(out.frete_intl_usd);
  out.seguro_intl_usd = r2(out.seguro_intl_usd);
  out.acrescimos_usd = r2(out.acrescimos_usd);
  out.deducoes_usd = r2(out.deducoes_usd);
  out.expenses = out.expenses.map(e => ({ 
    ...e, 
    valor_brl: r2(e.valor_brl),
    valor_original: r2(e.valor_original)
  }));

  return out;
}

// ... manter o restante do arquivo (mergeItemsWithQuoteItems)
export interface ExistingItem {
  id: string;
  quote_item_id: string | null;
  nome: string;
  ncm: string | null;
  peso: number;
  quantidade: number;
  vmcv_unit_usd: number;
  aliq_ii: number;
  aliq_ipi: number;
  aliq_pis: number;
  aliq_cofins: number;
  aliq_icms: number;
}

export interface QuoteItemLike {
  id: string;
  commodity: string | null;
  ncm_code: string | null;
  weight_kg: number | null;
  packages: number | null;
  container_qty: number | null;
}

export interface MergedItem {
  action: 'update' | 'insert';
  estimate_item_id?: string;
  data: {
    quote_item_id: string;
    nome: string;
    ncm: string | null;
    peso: number;
    quantidade: number;
    vmcv_unit_usd: number;
    aliq_ii: number;
    aliq_ipi: number;
    aliq_pis: number;
    aliq_cofins: number;
    aliq_icms: number;
  };
}

export function mergeItemsWithQuoteItems(existing: ExistingItem[], qItems: QuoteItemLike[]): MergedItem[] {
  const byQuoteItemId = new Map(existing.filter(e => e.quote_item_id).map(e => [e.quote_item_id!, e]));
  const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();
  const usedFallbackIds = new Set<string>();
  const byNameNcm = new Map<string, ExistingItem>();
  for (const e of existing) {
    if (e.quote_item_id) continue;
    byNameNcm.set(`${norm(e.nome)}|${norm(e.ncm)}`, e);
  }
  const merged: MergedItem[] = [];
  for (const qi of qItems) {
    let prev = byQuoteItemId.get(qi.id);
    if (!prev) {
      const key = `${norm(qi.commodity)}|${norm(qi.ncm_code)}`;
      const fb = byNameNcm.get(key);
      if (fb && !usedFallbackIds.has(fb.id)) {
        prev = fb;
        usedFallbackIds.add(fb.id);
      }
    }
    const nome = qi.commodity || prev?.nome || 'Item';
    const ncm = qi.ncm_code || prev?.ncm || null;
    const peso = Number(qi.weight_kg) || prev?.peso || 0;
    const quantidade = Number(qi.packages) || Number(qi.container_qty) || prev?.quantidade || 1;
    if (prev) {
      merged.push({
        action: 'update',
        estimate_item_id: prev.id,
        data: {
          quote_item_id: qi.id,
          nome, ncm, peso, quantidade,
          vmcv_unit_usd: prev.vmcv_unit_usd,
          aliq_ii: prev.aliq_ii, aliq_ipi: prev.aliq_ipi,
          aliq_pis: prev.aliq_pis, aliq_cofins: prev.aliq_cofins,
          aliq_icms: prev.aliq_icms,
        },
      });
    } else {
      merged.push({
        action: 'insert',
        data: {
          quote_item_id: qi.id,
          nome, ncm, peso, quantidade,
          vmcv_unit_usd: 0,
          aliq_ii: 0, aliq_ipi: 0,
          aliq_pis: 2.1, aliq_cofins: 9.65, aliq_icms: 18,
        },
      });
    }
  }
  return merged;
}
