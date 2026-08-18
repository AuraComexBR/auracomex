// Aba "Coleta" dentro do detalhe do shipment/embarque. Mostra o formulário
// de ordem de coleta (motorista, veículo, terminal, pátio, lacres, notas
// fiscais) e o botão de gerar o PDF entregue ao motorista.
//
// Só faz sentido quando o cliente do embarque faz coleta com frota própria
// (não uma transportadora terceirizada) — motorista/veículo são cadastrados
// vinculados ao client_id do embarque.

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  useColetaMotoristas,
  useColetaVeiculos,
  useColetaOrdem,
  useUpsertColetaOrdem,
  ColetaOrdemNotaFiscal,
} from '@/hooks/useColeta';
import { NovoMotoristaDialog, NovoVeiculoDialog } from './ColetaMotoristaVeiculoDialogs';
import { gerarDocumentoOrdemColeta } from '@/lib/gerarDocumentoOrdemColeta';
import { openSignedDoc } from '@/lib/storage';

interface Props {
  shipmentId: string;
  companyId: string;
  clientId: string | null;
  shipment: {
    reference_number: string;
    container_number: string | null;
    master_bl: string | null;
    house_bl: string | null;
    duimp_number: string | null;
  };
}

export function OrdemColetaTab({ shipmentId, companyId, clientId, shipment }: Props) {
  const { profile } = useAuth();
  const { data: ordem } = useColetaOrdem(shipmentId);
  const { data: motoristas = [] } = useColetaMotoristas(clientId ?? undefined);
  const { data: veiculos = [] } = useColetaVeiculos(clientId ?? undefined);
  const upsertOrdem = useUpsertColetaOrdem();

  const { data: company } = useQuery({
    queryKey: ['company-name', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('name').eq('id', companyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: client } = useQuery({
    queryKey: ['client-name', clientId],
    queryFn: async () => {
      const { data, error } = await supabase.from('clients').select('name').eq('id', clientId as string).single();
      if (error) throw error;
      return data;
    },
    enabled: !!clientId,
  });

  const [motoristaId, setMotoristaId] = useState<string | null>(null);
  const [veiculoId, setVeiculoId] = useState<string | null>(null);
  const [terminal, setTerminal] = useState('');
  const [patio, setPatio] = useState('');
  const [dataAgendada, setDataAgendada] = useState('');
  const [lacreEncontrado, setLacreEncontrado] = useState('');
  const [lacreAdicional, setLacreAdicional] = useState('');
  const [lacreIpa, setLacreIpa] = useState('');
  const [termoAvaria, setTermoAvaria] = useState('');
  const [pesoBrutoApurado, setPesoBrutoApurado] = useState('');
  const [notasFiscais, setNotasFiscais] = useState<ColetaOrdemNotaFiscal[]>([]);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!ordem) return;
    setMotoristaId(ordem.motorista_id);
    setVeiculoId(ordem.veiculo_id);
    setTerminal(ordem.terminal ?? '');
    setPatio(ordem.patio ?? '');
    setDataAgendada(ordem.data_agendada ? ordem.data_agendada.slice(0, 16) : '');
    setLacreEncontrado(ordem.lacre_encontrado ?? '');
    setLacreAdicional(ordem.lacre_adicional ?? '');
    setLacreIpa(ordem.lacre_ipa ?? '');
    setTermoAvaria(ordem.termo_avaria ?? '');
    setPesoBrutoApurado(ordem.peso_bruto_apurado?.toString() ?? '');
    setNotasFiscais((ordem as any).coleta_ordem_notas_fiscais ?? []);
  }, [ordem]);

  if (!clientId) {
    return (
      <Card className="glass">
        <CardContent className="p-6 text-sm text-muted-foreground text-center">
          Este embarque não tem um cliente vinculado — cadastre o cliente antes de criar a ordem de coleta.
        </CardContent>
      </Card>
    );
  }

  const salvar = async () => {
    try {
      await upsertOrdem.mutateAsync({
        id: ordem?.id,
        company_id: companyId,
        shipment_id: shipmentId,
        motorista_id: motoristaId,
        veiculo_id: veiculoId,
        terminal: terminal || null,
        patio: patio || null,
        data_agendada: dataAgendada ? new Date(dataAgendada).toISOString() : null,
        lacre_encontrado: lacreEncontrado || null,
        lacre_adicional: lacreAdicional || null,
        lacre_ipa: lacreIpa || null,
        termo_avaria: termoAvaria || null,
        peso_bruto_apurado: pesoBrutoApurado ? Number(pesoBrutoApurado) : null,
        created_by: profile?.user_id ?? null,
        notas_fiscais: notasFiscais,
      });
      toast.success('Ordem de coleta salva');
    } catch (err: any) {
      toast.error('Erro ao salvar ordem de coleta', { description: err.message });
    }
  };

  const gerarDocumento = async () => {
    if (!ordem?.id) {
      toast.error('Salve a ordem de coleta antes de gerar o documento');
      return;
    }
    const motorista = motoristas.find((m) => m.id === motoristaId) ?? null;
    const veiculo = veiculos.find((v) => v.id === veiculoId) ?? null;
    if (!motorista || !veiculo) {
      toast.error('Selecione motorista e veículo antes de gerar o documento');
      return;
    }

    setGerando(true);
    try {
      let numeroDocumento = ordem.numero_documento;
      if (!numeroDocumento) {
        const { data: numero, error } = await supabase.rpc('next_oc_number' as any, { p_company_id: companyId } as any);
        if (error) throw error;
        numeroDocumento = numero as string;
        await (supabase.from('coleta_ordens_coleta' as any).update({ numero_documento: numeroDocumento } as any).eq('id', ordem.id) as any);
      }

      const { path } = await gerarDocumentoOrdemColeta({
        companyId,
        companyName: company?.name ?? '',
        shipmentId,
        shipment,
        ordem: { ...ordem, numero_documento: numeroDocumento },
        notasFiscais,
        motorista,
        veiculo,
        clientName: client?.name ?? '',
        uploadedBy: profile?.user_id ?? null,
      });

      toast.success('Documento gerado');
      await openSignedDoc(path);
    } catch (err: any) {
      toast.error('Erro ao gerar documento', { description: err.message });
    } finally {
      setGerando(false);
    }
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Ordem de Coleta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Motorista</Label>
            <div className="flex gap-2">
              <Select value={motoristaId ?? undefined} onValueChange={setMotoristaId}>
                <SelectTrigger><SelectValue placeholder="Selecione o motorista" /></SelectTrigger>
                <SelectContent>
                  {motoristas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NovoMotoristaDialog companyId={companyId} clientId={clientId} onCreated={(m) => setMotoristaId(m.id)} />
            </div>
          </div>
          <div>
            <Label>Veículo</Label>
            <div className="flex gap-2">
              <Select value={veiculoId ?? undefined} onValueChange={setVeiculoId}>
                <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
                <SelectContent>
                  {veiculos.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.placa_cavalo} {v.placa_carreta ? `/ ${v.placa_carreta}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NovoVeiculoDialog companyId={companyId} clientId={clientId} onCreated={(v) => setVeiculoId(v.id)} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Terminal</Label>
            <Input value={terminal} onChange={(e) => setTerminal(e.target.value)} />
          </div>
          <div>
            <Label>Pátio</Label>
            <Input value={patio} onChange={(e) => setPatio(e.target.value)} />
          </div>
          <div>
            <Label>Data/hora agendada</Label>
            <Input type="datetime-local" value={dataAgendada} onChange={(e) => setDataAgendada(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <Label>Lacre encontrado</Label>
            <Input value={lacreEncontrado} onChange={(e) => setLacreEncontrado(e.target.value)} />
          </div>
          <div>
            <Label>Lacre adicional</Label>
            <Input value={lacreAdicional} onChange={(e) => setLacreAdicional(e.target.value)} />
          </div>
          <div>
            <Label>IPA</Label>
            <Input value={lacreIpa} onChange={(e) => setLacreIpa(e.target.value)} />
          </div>
          <div>
            <Label>Termo de avaria</Label>
            <Input value={termoAvaria} onChange={(e) => setTermoAvaria(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Peso bruto apurado (kg)</Label>
            <Input type="number" value={pesoBrutoApurado} onChange={(e) => setPesoBrutoApurado(e.target.value)} />
          </div>
        </div>

        <div>
          <Label>Notas fiscais (número / série / emissão / lote)</Label>
          {notasFiscais.map((nf, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 mt-1">
              <Input
                placeholder="Número"
                value={nf.numero}
                onChange={(e) => {
                  const next = [...notasFiscais];
                  next[i] = { ...next[i], numero: e.target.value };
                  setNotasFiscais(next);
                }}
              />
              <Input
                placeholder="Série"
                value={nf.serie ?? ''}
                onChange={(e) => {
                  const next = [...notasFiscais];
                  next[i] = { ...next[i], serie: e.target.value };
                  setNotasFiscais(next);
                }}
              />
              <Input
                type="date"
                value={nf.emissao ?? ''}
                onChange={(e) => {
                  const next = [...notasFiscais];
                  next[i] = { ...next[i], emissao: e.target.value };
                  setNotasFiscais(next);
                }}
              />
              <Input
                placeholder="Lote"
                value={nf.lote ?? ''}
                onChange={(e) => {
                  const next = [...notasFiscais];
                  next[i] = { ...next[i], lote: e.target.value };
                  setNotasFiscais(next);
                }}
              />
              <Button type="button" variant="ghost" onClick={() => setNotasFiscais(notasFiscais.filter((_, idx) => idx !== i))}>
                Remover
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => setNotasFiscais([...notasFiscais, { numero: '', serie: null, emissao: null, lote: null }])}
          >
            + Nota fiscal
          </Button>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={salvar} disabled={upsertOrdem.isPending}>Salvar</Button>
          <Button onClick={gerarDocumento} variant="secondary" disabled={gerando || !ordem?.id}>
            {gerando ? 'Gerando...' : 'Gerar documento'}
          </Button>
          {ordem?.numero_documento && (
            <span className="text-sm text-muted-foreground self-center">Doc. {ordem.numero_documento}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
