import { supabase } from '@/integrations/supabase/client';

export async function syncGeneralFieldsToEstimate(estimateId: string, quote: any, quotePartners: any[]) {
  if (!estimateId || !quote) return;

  const patch: any = {};
  
  // 1. Cia / Carrier (se estiver vazio)
  const mode = quote.transport_mode;
  let suggested = '';
  if (mode === 'air') {
    const ciaAerea = quotePartners?.find((qp: any) => 
      (qp.clients?.partner_category === 'air_carrier') || (qp.partner_category === 'air_carrier')
    );
    suggested = ciaAerea?.clients?.name || ciaAerea?.name || 'CONSOLIDADO';
  } else if (mode === 'ocean_lcl') {
    suggested = 'CONSOLIDADO';
  } else if (mode === 'ocean_fcl') {
    const armador = quotePartners?.find((qp: any) => 
      (qp.clients?.partner_category === 'ocean_carrier') || (qp.partner_category === 'ocean_carrier')
    );
    suggested = armador?.clients?.name || armador?.name || '';
  }

  // Só preenche se estiver vazio no banco (conforme lógica anterior) ou se quisermos forçar
  // Para ser automático e evitar divergência, o usuário quer que "traga a informação"
  // Mas para não sobrescrever customizações manuais se ele editou, vamos checar o atual
  const { data: current } = await (supabase as any)
    .from('cost_estimates')
    .select('carrier, transito, incoterm, rota_origem, rota_destino')
    .eq('id', estimateId)
    .single();

  if (current) {
    if (!current.carrier && suggested) patch.carrier = suggested;
    
    // Para Trânsito, Incoterm, Rota, o usuário disse "deve considerar exibir a mesma data/origem/etc"
    // Então vamos sincronizar se estiver diferente
    const generalTransit = String(quote.transit_time || '');
    if (current.transito !== generalTransit) patch.transito = generalTransit;

    const generalIncoterm = quote.incoterm || '';
    if (current.incoterm !== generalIncoterm) patch.incoterm = generalIncoterm;

    if (current.rota_origem !== (quote.origin || '')) patch.rota_origem = quote.origin || '';
    if (current.rota_destino !== (quote.destination || '')) patch.rota_destino = quote.destination || '';
  }

  if (Object.keys(patch).length > 0) {
    await (supabase as any).from('cost_estimates').update(patch).eq('id', estimateId);
  }
}
