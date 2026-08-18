// Aba "Coleta" dentro do detalhe do shipment/embarque. Cada container do
// embarque tem sua própria ordem de coleta (motorista/cavalo/carreta/lacres/
// NF podem mudar de um container pro outro), então primeiro escolhe o
// container e só depois preenche/edita os dados daquela ordem específica.
//
// Só faz sentido quando o cliente do embarque faz coleta com frota própria
// (não uma transportadora terceirizada) — motorista/cavalo/carreta são
// cadastrados vinculados ao client_id do embarque. Cavalo e carreta são
// cadastros independentes porque a combinação muda no dia a dia.

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { parseContainerNumbers } from '@/lib/containerNumbers';

// datetime-local não carrega timezone — value/onChange dele é sempre "hora
// da parede" do navegador. new Date(str)/toISOString() e slice(0,16) num
// timestamptz misturam local com UTC e desalinham a hora exibida a cada
// ida-e-volta do banco (parecia "não salvar" mas na real salvava com o
// fuso errado). Estas duas funções convertem timestamptz <-> string local
// sempre à mão, sem passar pelo relógio UTC do Date.toISOString().
function timestamptzToLocalInput(ts: string | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function localInputToTimestamptz(local: string): string | null {
  if (!local) return null;
  const [datePart, timePart] = local.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  return d.toISOString();
}
import {
  useColetaMotoristas,
  useColetaCavalos,
  useColetaCarretas,
  useColetaOrdens,
  useUpsertColetaOrdem,
  ColetaOrdemNotaFiscal,
} from '@/hooks/useColeta';
import { NovoMotoristaDialog, NovoCavaloDialog, NovaCarretaDialog } from './ColetaMotoristaVeiculoDialogs';
import { OrdemColetaPdfDialog } from './OrdemColetaPdfDialog';

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
  const queryClient = useQueryClient();
  const { data: ordens = [] } = useColetaOrdens(shipmentId);
  const { data: motoristas = [] } = useColetaMotoristas(clientId ?? undefined);
  const { data: cavalos = [] } = useColetaCavalos(clientId ?? undefined);
  const { data: carretas = [] } = useColetaCarretas(clientId ?? undefined);
  const upsertOrdem = useUpsertColetaOrdem();

  const containers = useMemo(() => parseContainerNumbers(shipment.container_number), [shipment.container_number]);
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);

  // Container selecionado por padrão: o primeiro sem ordem ainda, ou o
  // primeiro da lista se todos já tiverem.
  useEffect(() => {
    if (selectedContainer || containers.length === 0) return;
    const semOrdem = containers.find((c) => !ordens.some((o) => o.container_number === c));
    setSelectedContainer(semOrdem ?? containers[0]);
  }, [containers, ordens, selectedContainer]);

  const ordem = containers.length > 0
    ? ordens.find((o) => o.container_number === selectedContainer)
    : ordens[0]; // embarque sem container cadastrado (ex.: LCL/aéreo) — uma ordem só

  const { data: company } = useQuery({
    queryKey: ['company-name-logo', companyId],
    queryFn: async () => {
      const { data, error } = await (supabase.from('companies').select('name, logo_url') as any).eq('id', companyId).single();
      if (error) throw error;
      return data as { name: string; logo_url: string | null };
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
  const [cavaloId, setCavaloId] = useState<string | null>(null);
  const [carretaId, setCarretaId] = useState<string | null>(null);
  const [terminal, setTerminal] = useState('');
  const [patio, setPatio] = useState('');
  const [dataAgendada, setDataAgendada] = useState('');
  const [lacreEncontrado, setLacreEncontrado] = useState('');
  const [lacreAdicional, setLacreAdicional] = useState('');
  const [lacreIpa, setLacreIpa] = useState('');
  const [termoAvaria, setTermoAvaria] = useState('');
  const [pesoBrutoApurado, setPesoBrutoApurado] = useState('');
  const [pesoLiquidoApurado, setPesoLiquidoApurado] = useState('');
  const [notasFiscais, setNotasFiscais] = useState<ColetaOrdemNotaFiscal[]>([]);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);

  // Recarrega o formulário sempre que troca de container ou os dados da
  // ordem daquele container mudam — some (fica tudo em branco) se o
  // container escolhido ainda não tem ordem criada.
  useEffect(() => {
    if (!ordem) {
      setMotoristaId(null);
      setCavaloId(null);
      setCarretaId(null);
      setTerminal('');
      setPatio('');
      setDataAgendada('');
      setLacreEncontrado('');
      setLacreAdicional('');
      setLacreIpa('');
      setTermoAvaria('');
      setPesoBrutoApurado('');
      setPesoLiquidoApurado('');
      setNotasFiscais([]);
      return;
    }
    setMotoristaId(ordem.motorista_id);
    setCavaloId(ordem.cavalo_id);
    setCarretaId(ordem.carreta_id);
    setTerminal(ordem.terminal ?? '');
    setPatio(ordem.patio ?? '');
    setDataAgendada(timestamptzToLocalInput(ordem.data_agendada));
    setLacreEncontrado(ordem.lacre_encontrado ?? '');
    setLacreAdicional(ordem.lacre_adicional ?? '');
    setLacreIpa(ordem.lacre_ipa ?? '');
    setTermoAvaria(ordem.termo_avaria ?? '');
    setPesoBrutoApurado(ordem.peso_bruto_apurado?.toString() ?? '');
    setPesoLiquidoApurado(ordem.peso_liquido_apurado?.toString() ?? '');
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
        container_number: containers.length > 0 ? selectedContainer : null,
        motorista_id: motoristaId,
        cavalo_id: cavaloId,
        carreta_id: carretaId,
        terminal: terminal || null,
        patio: patio || null,
        data_agendada: localInputToTimestamptz(dataAgendada),
        lacre_encontrado: lacreEncontrado || null,
        lacre_adicional: lacreAdicional || null,
        lacre_ipa: lacreIpa || null,
        termo_avaria: termoAvaria || null,
        peso_bruto_apurado: pesoBrutoApurado ? Number(pesoBrutoApurado) : null,
        peso_liquido_apurado: pesoLiquidoApurado ? Number(pesoLiquidoApurado) : null,
        created_by: profile?.user_id ?? null,
        notas_fiscais: notasFiscais,
      });
      toast.success('Ordem de coleta salva');
    } catch (err: any) {
      toast.error('Erro ao salvar ordem de coleta', { description: err.message });
    }
  };

  const motoristaSelecionado = motoristas.find((m) => m.id === motoristaId) ?? null;
  const cavaloSelecionado = cavalos.find((c) => c.id === cavaloId) ?? null;
  const carretaSelecionada = carretas.find((c) => c.id === carretaId) ?? null;

  const abrirGeracaoDocumento = () => {
    if (!ordem?.id) {
      toast.error('Salve a ordem de coleta antes de gerar o documento');
      return;
    }
    if (!motoristaSelecionado || !cavaloSelecionado) {
      toast.error('Selecione motorista e cavalo antes de gerar o documento');
      return;
    }
    setPdfDialogOpen(true);
  };

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Ordem de Coleta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {containers.length > 1 && (
          <div>
            <Label>Container</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {containers.map((c) => {
                const temOrdem = ordens.some((o) => o.container_number === c);
                return (
                  <Button
                    key={c}
                    type="button"
                    variant={selectedContainer === c ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setSelectedContainer(c)}
                  >
                    {temOrdem ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
                    {c}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
        {containers.length === 1 && (
          <div className="text-sm text-muted-foreground">Container: <span className="font-mono">{containers[0]}</span></div>
        )}

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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Cavalo</Label>
            <div className="flex gap-2">
              <Select value={cavaloId ?? undefined} onValueChange={setCavaloId}>
                <SelectTrigger><SelectValue placeholder="Selecione o cavalo" /></SelectTrigger>
                <SelectContent>
                  {cavalos.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.placa} {c.modelo ? `— ${c.modelo}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NovoCavaloDialog companyId={companyId} clientId={clientId} onCreated={(c) => setCavaloId(c.id)} />
            </div>
          </div>
          <div>
            <Label>Carreta</Label>
            <div className="flex gap-2">
              <Select value={carretaId ?? undefined} onValueChange={setCarretaId}>
                <SelectTrigger><SelectValue placeholder="Selecione a carreta" /></SelectTrigger>
                <SelectContent>
                  {carretas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.placa} {c.tipo ? `— ${c.tipo}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <NovaCarretaDialog companyId={companyId} clientId={clientId} onCreated={(c) => setCarretaId(c.id)} />
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
          <div>
            <Label>Peso líquido apurado (kg)</Label>
            <Input type="number" value={pesoLiquidoApurado} onChange={(e) => setPesoLiquidoApurado(e.target.value)} />
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
          <Button onClick={abrirGeracaoDocumento} variant="secondary" disabled={!ordem?.id}>
            Gerar documento
          </Button>
          {ordem?.numero_documento && (
            <span className="text-sm text-muted-foreground self-center">Doc. {ordem.numero_documento}</span>
          )}
        </div>
      </CardContent>

      {ordem?.id && motoristaSelecionado && cavaloSelecionado && (
        <OrdemColetaPdfDialog
          open={pdfDialogOpen}
          onClose={() => setPdfDialogOpen(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['coleta_ordens_coleta', shipmentId] })}
          companyId={companyId}
          companyName={company?.name ?? ''}
          companyLogoUrl={company?.logo_url ?? null}
          shipmentId={shipmentId}
          ordem={ordem}
          notasFiscais={notasFiscais}
          motorista={motoristaSelecionado}
          cavalo={cavaloSelecionado}
          carreta={carretaSelecionada}
          shipment={{ ...shipment, container_number: ordem.container_number ?? shipment.container_number }}
          clientName={client?.name ?? ''}
          uploadedBy={profile?.user_id ?? null}
        />
      )}
    </Card>
  );
}
