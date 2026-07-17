import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CheckCircle, Wallet, AlertTriangle, CalendarClock } from 'lucide-react';
import { format, isBefore, addDays, startOfDay } from 'date-fns';
import { toast } from 'sonner';

type AP = {
  id: string;
  source: string;
  debit_note_id: string | null;
  quote_id: string | null;
  shipment_id: string | null;
  partner_id: string | null;
  description: string;
  currency: string;
  amount: number;
  due_date: string;
  status: 'aberto' | 'pago' | 'atrasado' | 'cancelado';
  paid_at: string | null;
  payment_method: string | null;
  receipt_url: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Em aberto',
  pago: 'Pago',
  atrasado: 'Atrasado',
  cancelado: 'Cancelado',
};
const STATUS_COLOR: Record<string, string> = {
  aberto: 'bg-slate-500/20 text-slate-300',
  pago: 'bg-emerald-500/20 text-emerald-300',
  atrasado: 'bg-red-500/20 text-red-300',
  cancelado: 'bg-muted text-muted-foreground',
};

export default function AccountsPayableTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [payTarget, setPayTarget] = useState<AP | null>(null);
  const [payForm, setPayForm] = useState({ paid_at: format(new Date(), 'yyyy-MM-dd'), payment_method: '' });

  const { data: rows = [], refetch } = useQuery({
    queryKey: ['accounts_payable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_payable' as any)
        .select('*')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AP[];
    },
  });

  const partners = useQuery({
    queryKey: ['ap-partners'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name');
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });
  const partnerMap = new Map((partners.data ?? []).map((p) => [p.id, p.name]));

  const quoteIds = Array.from(new Set(rows.map((r) => r.quote_id).filter(Boolean))) as string[];
  const shipmentIds = Array.from(new Set(rows.map((r) => r.shipment_id).filter(Boolean))) as string[];

  const quotesQ = useQuery({
    queryKey: ['ap-quotes', quoteIds.join(',')],
    enabled: quoteIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('quotes').select('id, base_reference').in('id', quoteIds);
      return (data ?? []) as Array<{ id: string; base_reference: string | null }>;
    },
  });
  const shipmentsQ = useQuery({
    queryKey: ['ap-shipments', shipmentIds.join(',')],
    enabled: shipmentIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('shipments').select('id, reference_number').in('id', shipmentIds);
      return (data ?? []) as Array<{ id: string; reference_number: string | null }>;
    },
  });
  const quoteMap = new Map((quotesQ.data ?? []).map((q) => [q.id, q.base_reference]));
  const shipmentMap = new Map((shipmentsQ.data ?? []).map((s) => [s.id, s.reference_number]));

  const today = startOfDay(new Date());
  const enriched = rows.map((r) => {
    const due = new Date(r.due_date);
    const overdue = r.status === 'aberto' && isBefore(due, today);
    return { ...r, status: overdue ? ('atrasado' as const) : r.status };
  });

  const filtered = enriched.filter((r) => statusFilter === 'todos' || r.status === statusFilter);

  const kpis = useMemo(() => {
    const in7 = addDays(today, 7);
    let vencidos = 0, aVencer = 0, pagos = 0, aberto = 0;
    for (const r of enriched) {
      const amt = Number(r.amount) || 0;
      if (r.status === 'pago') pagos += amt;
      else if (r.status === 'atrasado') vencidos += amt;
      else if (r.status === 'aberto') {
        aberto += amt;
        if (isBefore(new Date(r.due_date), in7)) aVencer += amt;
      }
    }
    return { vencidos, aVencer, pagos, aberto };
  }, [enriched, today]);

  async function markPaid() {
    if (!payTarget) return;
    const { error } = await supabase
      .from('accounts_payable' as any)
      .update({
        status: 'pago',
        paid_at: payForm.paid_at,
        payment_method: payForm.payment_method || null,
      })
      .eq('id', payTarget.id);
    if (error) return toast.error('Erro ao registrar pagamento', { description: error.message });

    if (payTarget.debit_note_id) {
      await supabase.from('debit_notes' as any).update({ status: 'paga' }).eq('id', payTarget.debit_note_id);
    }

    toast.success('Pagamento registrado');
    setPayTarget(null);
    refetch();
    qc.invalidateQueries({ queryKey: ['debit_notes'] });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi title="A vencer (7d)" value={kpis.aVencer} icon={<CalendarClock className="w-4 h-4" />} tone="amber" />
        <Kpi title="Vencidos" value={kpis.vencidos} icon={<AlertTriangle className="w-4 h-4" />} tone="red" />
        <Kpi title="Em aberto" value={kpis.aberto} icon={<Wallet className="w-4 h-4" />} tone="slate" />
        <Kpi title="Pagos" value={kpis.pagos} icon={<CheckCircle className="w-4 h-4" />} tone="emerald" />
      </div>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Contas a Pagar</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aberto">Em aberto</SelectItem>
              <SelectItem value="atrasado">Atrasados</SelectItem>
              <SelectItem value="pago">Pagos</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conta encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs uppercase text-muted-foreground">{r.source}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell>{r.partner_id ? partnerMap.get(r.partner_id) ?? '—' : '—'}</TableCell>
                    <TableCell>
                      {r.shipment_id && shipmentMap.get(r.shipment_id) ? (
                        <Link to={`/shipments/${r.shipment_id}`} className="text-primary hover:underline font-mono text-xs">
                          {shipmentMap.get(r.shipment_id)}
                        </Link>
                      ) : r.quote_id && quoteMap.get(r.quote_id) ? (
                        <Link to={`/quotes/${r.quote_id}`} className="text-primary hover:underline font-mono text-xs">
                          {quoteMap.get(r.quote_id)}
                        </Link>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">Sem vínculo</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(r.due_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      {r.paid_at ? (
                        <span className="text-emerald-300">{format(new Date(r.paid_at), 'dd/MM/yyyy')}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.currency} {Number(r.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLOR[r.status]} variant="secondary">
                        {STATUS_LABEL[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status !== 'pago' && r.status !== 'cancelado' && (
                        <Button size="sm" variant="outline" onClick={() => { setPayTarget(r); setPayForm({ paid_at: format(new Date(), 'yyyy-MM-dd'), payment_method: '' }); }}>
                          Pagar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          {payTarget && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {payTarget.description} — {payTarget.currency} {Number(payTarget.amount).toFixed(2)}
              </div>
              <div>
                <Label>Data do pagamento</Label>
                <Input type="date" value={payForm.paid_at} onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })} />
              </div>
              <div>
                <Label>Forma de pagamento</Label>
                <Input placeholder="Ex: TED, Boleto, PIX" value={payForm.payment_method} onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayTarget(null)}>Cancelar</Button>
            <Button onClick={markPaid}>Confirmar pagamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone: string }) {
  const toneMap: Record<string, string> = {
    amber: 'text-amber-400',
    red: 'text-red-400',
    emerald: 'text-emerald-400',
    slate: 'text-slate-300',
  };
  return (
    <Card className="glass">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{title}</span>
          <span className={toneMap[tone]}>{icon}</span>
        </div>
        <div className={`text-xl font-semibold tabular-nums mt-1 ${toneMap[tone]}`}>
          {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })}
        </div>
      </CardContent>
    </Card>
  );
}