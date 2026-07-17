/**
 * Motor de cálculo da Estimativa de Custo de Importação (Brasil).
 * Regras tributárias:
 *   VMLE   = VMCV + Acréscimos − Deduções
 *   VMLD   = VMLE + Frete Intl + Seguro Intl                          (base II)
 *   II     = VMLD × aliq_II
 *   IPI    = (VMLD + II) × aliq_IPI
 *   PIS    = VMLD × aliq_PIS
 *   COFINS = VMLD × aliq_COFINS
 *   ICMS   = (VMLD+II+IPI+PIS+COFINS+Desp.Aduaneiras) / (1 − aliq_ICMS) × aliq_ICMS
 *
 * Alíquotas são percentuais (ex. 14.4 = 14,4%).
 * Tudo em USD; conversão para BRL via usd_brl no momento do snapshot.
 */

export interface EstimateItemInput {
  id?: string;
  nome: string;
  ncm?: string;
  peso: number;
  quantidade: number;
  vmcv_unit_usd: number; // valor unitário FOB/EXW da mercadoria em USD
  aliq_ii: number;
  aliq_ipi: number;
  aliq_pis: number;
  aliq_cofins: number;
  aliq_icms: number;
  /** Destinação fiscal da mercadoria. Controla se o IPI entra na base do ICMS.
   *  - 'consumo_final' (default): uso/consumo/ativo imobilizado → IPI integra a base.
   *  - 'revenda_industrializacao': IPI fica fora da base (CF art. 155 §2º XI). */
  destinacao?: 'consumo_final' | 'revenda_industrializacao';
  /** Se true, aplica +1% de COFINS-Importação (Lei 12.844/13, art. 8º §21). */
  cofins_adicional?: boolean;
}

export interface EstimateExpenseInput {
  descricao: string;
  valor_brl: number;
  aduaneira: boolean;
  category?: 'origin' | 'freight' | 'destination' | 'local' | null;
}

export interface EstimateInput {
  acrescimos_usd: number;
  deducoes_usd: number;
  frete_intl_usd: number;
  seguro_intl_usd: number;
  usd_brl: number;
  rateio_metodo: 'valor' | 'peso' | 'quantidade';
  items: EstimateItemInput[];
  expenses: EstimateExpenseInput[];
  /** Taxa Siscomex (BRL, fixa por DI). Entra na base do ICMS e no total do custo. */
  taxa_siscomex_brl?: number;
  /** AFRMM em BRL. Entra na base do ICMS e no total do custo. */
  afrmm_brl?: number;
}

/**
 * Classificação automática de despesa aduaneira para composição da base do ICMS-Importação
 * (LC 87/96 art. 13 §1º III + STF Tema 1014).
 *
 * Entram na base: despesas cobradas do importador **até o desembaraço** — Siscomex, AFRMM,
 * capatazia/THC destino, armazenagem em ZONA PRIMÁRIA (recinto alfandegado), honorários de
 * despachante, taxas do porto/aduana, LI.
 *
 * NÃO entram: armazenagem em zona secundária, frete rodoviário nacional pós-desembaraço,
 * despesas de origem (EXW charges, frete internacional já embutido no VMLD), destination
 * charges genéricas do agente.
 */
const KEYWORDS_ADUANEIRAS = [
  'SISCOMEX',
  'AFRMM',
  'CAPATAZIA',
  'THC',
  'ZONA PRIMARIA', 'ZONA PRIMÁRIA',
  'DESPACHANTE',
  'HONORARIO', 'HONORÁRIO',
  'DESEMBARACO', 'DESEMBARAÇO',
  'TAXA DE EXPEDIENTE', 'TAXA EXPEDIENTE',
  'LICENCA DE IMPORT', 'LICENÇA DE IMPORT', 'LI IMPORTACAO', 'LI IMPORTAÇÃO',
  'ADICIONAL DE FRETE', // AFRMM alternativo
  'TAXA PORTUARIA', 'TAXA PORTUÁRIA',
];
const KEYWORDS_NAO_ADUANEIRAS = [
  'ZONA SECUNDARIA', 'ZONA SECUNDÁRIA',
  'FRETE RODOVIARIO', 'FRETE RODOVIÁRIO',
  'EXW',
  'OCEAN FREIGHT', 'FRETE INTERNACIONAL', 'FRETE MARITIMO', 'FRETE MARÍTIMO', 'FRETE AEREO', 'FRETE AÉREO',
  'SEGURO INTERNACIONAL',
];

function normalize(s: string): string {
  return (s || '').toUpperCase();
}

export function isDespesaAduaneira(descricao: string, category?: EstimateExpenseInput['category']): boolean {
  const d = normalize(descricao);
  if (KEYWORDS_NAO_ADUANEIRAS.some(k => d.includes(k))) return false;
  if (KEYWORDS_ADUANEIRAS.some(k => d.includes(k))) return true;
  // Origem e frete internacional nunca são aduaneiras (já compõem VMLD ou são fora do fato gerador).
  if (category === 'origin' || category === 'freight') return false;
  return false;
}

export interface ItemBreakdown {
  vmcv_usd: number;
  vmle_usd: number;
  frete_usd: number;
  seguro_usd: number;
  vmld_usd: number;
  ii_usd: number;
  ipi_usd: number;
  pis_usd: number;
  cofins_usd: number;
  icms_usd: number;
  despesas_usd: number;
  total_usd: number;
}

export interface EstimateBreakdown {
  vmcv_usd: number;
  vmle_usd: number;
  vmld_usd: number;
  ii_usd: number;
  ipi_usd: number;
  pis_usd: number;
  cofins_usd: number;
  icms_usd: number;
  despesas_aduaneiras_brl: number;
  despesas_nac_brl: number;
  despesas_nac_usd: number;
  subtotal_usd: number;
  total_usd: number;
  total_brl: number;
  itemBreakdowns: ItemBreakdown[];
  /** True quando o motor usou rateio igualitário porque o denominador escolhido era zero. */
  rateio_igualitario_fallback: boolean;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function calcImpostos(
  vmld: number,
  aliq_ii: number,
  aliq_ipi: number,
  aliq_pis: number,
  aliq_cofins: number,
  aliq_icms: number,
  desp_aduaneiras_usd: number,
  ipi_na_base_icms: boolean,
) {
  const ii = vmld * (aliq_ii / 100);
  const ipi = (vmld + ii) * (aliq_ipi / 100);
  const pis = vmld * (aliq_pis / 100);
  const cofins = vmld * (aliq_cofins / 100);
  const baseIcms = vmld + ii + (ipi_na_base_icms ? ipi : 0) + pis + cofins + desp_aduaneiras_usd;
  const aliqIcmsDec = aliq_icms / 100;
  const icms = aliqIcmsDec >= 1 ? 0 : (baseIcms / (1 - aliqIcmsDec)) * aliqIcmsDec;
  return { ii, ipi, pis, cofins, icms };
}

export function calcEstimativa(input: EstimateInput): EstimateBreakdown {
  const { items, expenses, frete_intl_usd, seguro_intl_usd, acrescimos_usd, deducoes_usd, usd_brl, rateio_metodo } = input;
  const taxa_siscomex_brl = Number(input.taxa_siscomex_brl || 0);
  const afrmm_brl = Number(input.afrmm_brl || 0);

  const totalVmcvUsd = items.reduce((s, i) => s + i.vmcv_unit_usd * i.quantidade, 0);
  const totalPeso = items.reduce((s, i) => s + i.peso * i.quantidade, 0);
  const totalQtd = items.reduce((s, i) => s + i.quantidade, 0);

  // Despesas nacionais = tudo que NÃO está embutido no VMLD (origem/frete já estão via frete_intl_usd/acrescimos).
  // Taxa Siscomex e AFRMM também compõem o custo nacional (e a base de ICMS).
  const despesas_nac_from_charges = expenses
    .filter(e => e.category === 'destination' || e.category === 'local' || !e.category)
    .reduce((s, e) => s + e.valor_brl, 0);
  const despesas_nac_brl = despesas_nac_from_charges + taxa_siscomex_brl + afrmm_brl;

  // Aduaneiras (base do ICMS): flag manual `aduaneira` prevalece; se falsa/ausente, aplica
  // classificação automática por palavras-chave (LC 87/96 art. 13 §1º III + STF Tema 1014).
  // Sempre soma Siscomex + AFRMM do header.
  const despesas_aduaneiras_brl = expenses
    .filter(e => (e.category === 'destination' || e.category === 'local' || !e.category))
    .filter(e => e.aduaneira || isDespesaAduaneira(e.descricao, e.category))
    .reduce((s, e) => s + e.valor_brl, 0) + taxa_siscomex_brl + afrmm_brl;

  const despesas_nac_usd = usd_brl > 0 ? despesas_nac_brl / usd_brl : 0;
  const despesas_aduaneiras_usd = usd_brl > 0 ? despesas_aduaneiras_brl / usd_brl : 0;

  // Determina denominador do rateio e detecta fallback igualitário.
  const denom = rateio_metodo === 'peso' ? totalPeso : rateio_metodo === 'quantidade' ? totalQtd : totalVmcvUsd;
  const fallback = denom <= 0 && items.length > 0;

  // Calcula breakdown bruto (sem arredondar) para somar totais com precisão.
  const itemBreakdownsRaw = items.map(item => {
    const vmcvItem = item.vmcv_unit_usd * item.quantidade;
    const pesoItem = item.peso * item.quantidade;
    const qtdItem = item.quantidade;
    let share: number;
    if (fallback) {
      share = 1 / items.length;
    } else if (rateio_metodo === 'peso') {
      share = pesoItem / totalPeso;
    } else if (rateio_metodo === 'quantidade') {
      share = qtdItem / totalQtd;
    } else {
      share = vmcvItem / totalVmcvUsd;
    }

    const acrescItem = acrescimos_usd * share;
    const deducItem = deducoes_usd * share;
    const freteItem = frete_intl_usd * share;
    const seguroItem = seguro_intl_usd * share;
    const despAduItem = despesas_aduaneiras_usd * share;
    const despNacItem = despesas_nac_usd * share;

    const vmle = vmcvItem + acrescItem - deducItem;
    const vmld = vmle + freteItem + seguroItem;
    const ipi_na_base_icms = (item.destinacao ?? 'consumo_final') === 'consumo_final';
    const aliq_cofins_efetiva = item.aliq_cofins + (item.cofins_adicional ? 1 : 0);
    const { ii, ipi, pis, cofins, icms } = calcImpostos(
      vmld, item.aliq_ii, item.aliq_ipi, item.aliq_pis, aliq_cofins_efetiva, item.aliq_icms, despAduItem, ipi_na_base_icms
    );
    const total = vmld + ii + ipi + pis + cofins + icms + despNacItem;

    return {
      vmcv_usd: vmcvItem,
      vmle_usd: vmle,
      frete_usd: freteItem,
      seguro_usd: seguroItem,
      vmld_usd: vmld,
      ii_usd: ii,
      ipi_usd: ipi,
      pis_usd: pis,
      cofins_usd: cofins,
      icms_usd: icms,
      despesas_usd: despNacItem,
      total_usd: total,
    };
  });

  // Versão arredondada para exibição por item.
  const itemBreakdowns: ItemBreakdown[] = itemBreakdownsRaw.map(b => ({
    vmcv_usd: round2(b.vmcv_usd),
    vmle_usd: round2(b.vmle_usd),
    frete_usd: round2(b.frete_usd),
    seguro_usd: round2(b.seguro_usd),
    vmld_usd: round2(b.vmld_usd),
    ii_usd: round2(b.ii_usd),
    ipi_usd: round2(b.ipi_usd),
    pis_usd: round2(b.pis_usd),
    cofins_usd: round2(b.cofins_usd),
    icms_usd: round2(b.icms_usd),
    despesas_usd: round2(b.despesas_usd),
    total_usd: round2(b.total_usd),
  }));

  // Totais consolidados a partir dos valores brutos (precisão preservada).
  const sum = (k: keyof ItemBreakdown) => itemBreakdownsRaw.reduce((s, b) => s + (b[k] as number), 0);
  const vmcv = sum('vmcv_usd');
  const vmle = sum('vmle_usd');
  const vmld = sum('vmld_usd');
  const ii = sum('ii_usd');
  const ipi = sum('ipi_usd');
  const pis = sum('pis_usd');
  const cofins = sum('cofins_usd');
  const icms = sum('icms_usd');
  const subtotal = vmld + ii + ipi + pis + cofins + icms;
  const total = subtotal + despesas_nac_usd;

  return {
    vmcv_usd: round2(vmcv),
    vmle_usd: round2(vmle),
    vmld_usd: round2(vmld),
    ii_usd: round2(ii),
    ipi_usd: round2(ipi),
    pis_usd: round2(pis),
    cofins_usd: round2(cofins),
    icms_usd: round2(icms),
    despesas_aduaneiras_brl: round2(despesas_aduaneiras_brl),
    despesas_nac_brl: round2(despesas_nac_brl),
    despesas_nac_usd: round2(despesas_nac_usd),
    subtotal_usd: round2(subtotal),
    total_usd: round2(total),
    total_brl: round2(total * usd_brl),
    itemBreakdowns,
    rateio_igualitario_fallback: fallback,
  };
}

export function toBRL(usd: number, rate: number): number {
  return round2(usd * rate);
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return round2((part / total) * 100);
}