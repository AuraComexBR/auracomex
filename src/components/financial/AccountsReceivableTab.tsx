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

type AR = {
  id: string;
  source: string;
  debit_note_id: string | null;
  quote_id: string | null;
  shipment_id: string | null;
  client_id: string | null;
  description: string;
  currency: string;
  amount: number;
  due_date: string;
  status: 'aberto' | 'recebido' | 'atrasado' | 'cancelado';
  received_at: string | null;
  receipt_reference: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Em aberto', recebido: 'Recebido', atrasado: 'Atrasado', cancelado: 'Cancelado',
};
const STATUS_COLOR: Record<string, string> = {
  aberto: 'bg-slate-500/20 text-slate-300',
  recebido: 'bg-emerald-500/20 text-emerald-300',
  atrasado: 'bg-red-500/20 text-red-300',
  cancelado: 'bg-muted text-muted-foreground',
};

export default function AccountsReceivableTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [target, setTarget] = useState<AR | null>(null);
  const [form, setForm] = useState({ received_at: format(new Date(), 'yyyy-MM-dd'), receipt_reference: '' });

  const { data: rows = [], refetch } = useQuery({
    queryKey: ['accounts_receivable'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounts_receivable' as any)
        .select('*')
        .order('due_date', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AR[];
    },
  });

  const clients = useQuery({
    queryKey: ['ar-clients'],
    queryFn: async () => {
      const { data } = await supabase.from('clients').select('id, name');
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });
  const clientMap = new Map((clients.data ?? []).map((p) => [p.id, p.name]));

  const quoteIds = Array.from(new Set(rows.map((r) => r.quote_id).filter(Boolean))) as string[];
  const quotesQ = useQuery({
    queryKey: ['ar-quotes', quoteIds.join(',')],
    enabled: quoteIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from('quotes').select('id, base_reference').in('id', quoteIds);
      return (data ?? []) as Array<{ id: string; base_reference: string | null }>;
    },
  });
  const quoteMap = new Map((quotesQ.data ?? []).map((q) => [q.id, q.base_reference]));

  const today = startOfDay(new Date());
  const enriched = rows.map((r) => {
    const due = new Date(r.due_date);
    const overdue = r.status === 'aberto' && isBefore(due, today);
    return { ...r, status: overdue ? ('atrasado' as const) : r.status };
  });

  const filtered = enriched.filter((r) => statusFilter === 'todos' || r.status === statusFilter);

  const kpis = useMemo(() => {
    const in7 = addDays(today, 7);
    let vencidos = 0, aVencer = 0, recebidos = 0, aberto = 0;
    for (const r of enriched) {
      const amt = Number(r.amount) || 0;
      if (r.status === 'recebido') recebidos += amt;
      else if (r.status === 'atrasado') vencidos += amt;
      else if (r.status === 'aberto') {
        aberto += amt;
        if (isBefore(new Date(r.due_date), in7)) aVencer += amt;
      }
    }
    return { vencidos, aVencer, recebidos, aberto };
  }, [enriched, today]);

  async function markReceived() {
    if (!target) return;
    const { error } = await supabase
      .from('accounts_receivable' as any)
      .update({
        status: 'recebido',
        received_at: form.received_at,
        received_amount: target.amount,
        receipt_reference: form.receipt_reference || null,
      })
      .eq('id', target.id);
    if (error) return toast.error('Erro ao registrar recebimento', { description: error.message });

    if (target.debit_note_id) {
      await supabase.from('debit_notes' as any).update({
        status: 'paga', paid_at: form.received_at, paid_amount: target.amount, payment_reference: form.receipt_reference || null,
      }).eq('id', target.debit_note_id);
    }

    toast.success('Recebimento registrado');
    setTarget(null);
    refetch();
    qc.invalidateQueries({ queryKey: ['client_debit_notes'] });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Kpi title="A receber (7d)" value={kpis.aVencer} icon={<CalendarClock className="w-4 h-4" />} tone="amber" />
        <Kpi title="Atrasados" value={kpis.vencidos} icon={<AlertTriangle className="w-4 h-4" />} tone="red" />
        <Kpi title="Em aberto" value={kpis.aberto} icon={<Wallet className="w-4 h-4" />} tone="slate" />
        <Kpi title="Recebidos" value={kpis.recebidos} icon={<CheckCircle className="w-4 h-4" />} tone="emerald" />
      </div>

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Contas a Receber</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="aberto">Em aberto</SelectItem>
              <SelectItem value="atrasado">Atrasados</SelectItem>
              <SelectItem value="recebido">Recebidos</SelectItem>
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
                  <TableHead>Cliente</TableHead>
                  <TableHead>Processo</TableHead>
                  <TableHead>Vencimento</TableHead>
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
                    <TableCell>{r.client_id ? clientMap.get(r.client_id) ?? '—' : '—'}</TableCell>
                    <TableCell>
                      {r.quote_id && quoteMap.get(r.quote_id) ? (
                        <Link to={`/quotes/${r.quote_id}`} className="text-primary hover:underline font-mono text-xs">
                          {quoteMap.get(r.quote_id)}
                        </Link>
                      ) : (
                        <Badge variant="secondary" className="bg-muted text-muted-foreground text-xs">—</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(r.due_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.currency} {Number(r.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLOR[r.status]} variant="secondary">
                        {STATUS_LABEL[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status !== 'recebido' && r.status !== 'cancelado' && (
                        <Button size="sm" variant="outline" onClick={() => { setTarget(r); setForm({ received_at: format(new Date(), 'yyyy-MM-dd'), receipt_reference: '' }); }}>
                          Receber
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

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar recebimento</DialogTitle></DialogHeader>
          {target && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {target.description} — {target.currency} {Number(target.amount).toFixed(2)}
              </div>
              <div>
                <Label>Data do recebimento</Label>
                <Input type="date" value={form.received_at} onChange={(e) => setForm({ ...form, received_at: e.target.value })} />
              </div>
              <div>
                <Label>Referência (TED/PIX/SWIFT)</Label>
                <Input placeholder="Opcional" value={form.receipt_reference} onChange={(e) => setForm({ ...form, receipt_reference: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancelar</Button>
            <Button onClick={markReceived}>Confirmar recebimento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone: string }) {
  const toneMap: Record<string, string> = {
    amber: 'text-amber-400', red: 'text-red-400', emerald: 'text-emerald-400', slate: 'text-slate-300',
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