// Hooks React Query para o módulo de Coleta (ordem de coleta com frota
// própria do cliente). Segue o mesmo padrão de outros hooks do projeto.
//
// Cavalo (trator) e carreta são cadastros independentes — no dia a dia a
// combinação muda (a mesma carreta pode ir com cavalos diferentes e
// vice-versa), então não dá pra tratar como um único "veículo".

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ColetaMotorista {
  id: string;
  company_id: string;
  client_id: string;
  nome: string;
  cpf: string | null;
  cnh: string | null;
  rg: string | null;
  orgao_emissor: string | null;
  cnh_emissao: string | null;
  telefone: string | null;
  nextel: string | null;
  active: boolean;
}

export interface ColetaCavalo {
  id: string;
  company_id: string;
  client_id: string;
  placa: string;
  cor: string | null;
  modelo: string | null;
  active: boolean;
}

export interface ColetaCarreta {
  id: string;
  company_id: string;
  client_id: string;
  placa: string;
  tipo: string | null;
  active: boolean;
}

export interface ColetaOrdemNotaFiscal {
  id?: string;
  ordem_coleta_id?: string;
  numero: string;
  serie: string | null;
  emissao: string | null;
  lote: string | null;
}

export interface ColetaOrdemColeta {
  id: string;
  company_id: string;
  shipment_id: string;
  motorista_id: string | null;
  cavalo_id: string | null;
  carreta_id: string | null;
  numero_documento: string | null;
  terminal: string | null;
  patio: string | null;
  data_agendada: string | null;
  status: 'agendada' | 'realizada' | 'cancelada' | 'no_show';
  lacre_encontrado: string | null;
  lacre_adicional: string | null;
  lacre_ipa: string | null;
  termo_avaria: string | null;
  peso_bruto_apurado: number | null;
  document_id: string | null;
}

// ---------------------------------------------------------------------------
// Motoristas
// ---------------------------------------------------------------------------

export function useColetaMotoristas(clientId: string | undefined) {
  return useQuery({
    queryKey: ['coleta_motoristas', clientId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('coleta_motoristas' as any)
        .select('*') as any)
        .eq('client_id', clientId)
        .eq('active', true)
        .order('nome');
      if (error) throw error;
      return (data || []) as ColetaMotorista[];
    },
    enabled: !!clientId,
  });
}

export function useCreateColetaMotorista() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<ColetaMotorista, 'id' | 'active'>) => {
      const { data, error } = await (supabase
        .from('coleta_motoristas' as any)
        .insert(payload as any)
        .select()
        .single() as any);
      if (error) throw error;
      return data as ColetaMotorista;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['coleta_motoristas', variables.client_id] });
    },
  });
}

// ---------------------------------------------------------------------------
// Cavalos (trator)
// ---------------------------------------------------------------------------

export function useColetaCavalos(clientId: string | undefined) {
  return useQuery({
    queryKey: ['coleta_cavalos', clientId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('coleta_cavalos' as any)
        .select('*') as any)
        .eq('client_id', clientId)
        .eq('active', true)
        .order('placa');
      if (error) throw error;
      return (data || []) as ColetaCavalo[];
    },
    enabled: !!clientId,
  });
}

export function useCreateColetaCavalo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<ColetaCavalo, 'id' | 'active'>) => {
      const { data, error } = await (supabase
        .from('coleta_cavalos' as any)
        .insert(payload as any)
        .select()
        .single() as any);
      if (error) throw error;
      return data as ColetaCavalo;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['coleta_cavalos', variables.client_id] });
    },
  });
}

// ---------------------------------------------------------------------------
// Carretas
// ---------------------------------------------------------------------------

export function useColetaCarretas(clientId: string | undefined) {
  return useQuery({
    queryKey: ['coleta_carretas', clientId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('coleta_carretas' as any)
        .select('*') as any)
        .eq('client_id', clientId)
        .eq('active', true)
        .order('placa');
      if (error) throw error;
      return (data || []) as ColetaCarreta[];
    },
    enabled: !!clientId,
  });
}

export function useCreateColetaCarreta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<ColetaCarreta, 'id' | 'active'>) => {
      const { data, error } = await (supabase
        .from('coleta_carretas' as any)
        .insert(payload as any)
        .select()
        .single() as any);
      if (error) throw error;
      return data as ColetaCarreta;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['coleta_carretas', variables.client_id] });
    },
  });
}

// ---------------------------------------------------------------------------
// Ordem de coleta
// ---------------------------------------------------------------------------

export function useColetaOrdem(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ['coleta_ordem_coleta', shipmentId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('coleta_ordens_coleta' as any)
        .select('*, coleta_ordem_notas_fiscais(*)') as any)
        .eq('shipment_id', shipmentId)
        .maybeSingle();
      if (error) throw error;
      return data as (ColetaOrdemColeta & { coleta_ordem_notas_fiscais: ColetaOrdemNotaFiscal[] }) | null;
    },
    enabled: !!shipmentId,
  });
}

export function useUpsertColetaOrdem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      company_id: string;
      shipment_id: string;
      motorista_id: string | null;
      cavalo_id: string | null;
      carreta_id: string | null;
      terminal: string | null;
      patio: string | null;
      data_agendada: string | null;
      lacre_encontrado: string | null;
      lacre_adicional: string | null;
      lacre_ipa: string | null;
      termo_avaria: string | null;
      peso_bruto_apurado: number | null;
      created_by?: string | null;
      notas_fiscais: ColetaOrdemNotaFiscal[];
    }) => {
      const { notas_fiscais, id, ...ordem } = payload;

      let ordemId = id;

      if (id) {
        const { error } = await (supabase.from('coleta_ordens_coleta' as any).update(ordem as any).eq('id', id) as any);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase
          .from('coleta_ordens_coleta' as any)
          .insert(ordem as any)
          .select('id')
          .single() as any);
        if (error) throw error;
        ordemId = data.id;
      }

      // Substitui as notas fiscais (simples: apaga e reinsere)
      await (supabase.from('coleta_ordem_notas_fiscais' as any).delete().eq('ordem_coleta_id', ordemId) as any);
      if (notas_fiscais.length > 0) {
        const { error } = await (supabase.from('coleta_ordem_notas_fiscais' as any).insert(
          notas_fiscais.map((nf) => ({ ...nf, ordem_coleta_id: ordemId })) as any
        ) as any);
        if (error) throw error;
      }

      return ordemId as string;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['coleta_ordem_coleta', variables.shipment_id] });
    },
  });
}
