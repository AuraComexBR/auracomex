/**
 * Soma o valor total da carga (USD) a partir dos itens da aba Resumo da
 * Carga (quote_items / CargoItem). Usado tanto pela barra de totais dessa
 * aba quanto pelo "Custo" do cálculo automático do Seguro Internacional na
 * aba Taxas — assim o Custo não depende mais de existir uma Estimativa de
 * Custo criada.
 *
 * Só soma itens em USD (moeda default e mais comum pra valor de mercadoria
 * em importação). Itens em outra moeda são sinalizados via `hasNonUsd`, mas
 * não entram no total — evita conversão errada sem uma taxa de câmbio
 * confiável disponível nesta aba.
 */
export interface CargoValueLike {
  cargo_value?: number | string | null;
  cargo_value_currency?: string | null;
}

export interface CargoValueTotal {
  totalUsd: number;
  hasNonUsd: boolean;
}

export function calcTotalCargoValueUsd(items: CargoValueLike[] | null | undefined): CargoValueTotal {
  let totalUsd = 0;
  let hasNonUsd = false;
  for (const it of items || []) {
    const val = Number(it.cargo_value) || 0;
    if (val <= 0) continue;
    const cur = (it.cargo_value_currency || 'USD').toUpperCase();
    if (cur === 'USD') {
      totalUsd += val;
    } else {
      hasNonUsd = true;
    }
  }
  return { totalUsd: Math.round(totalUsd * 100) / 100, hasNonUsd };
}
