import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, FileText, CheckCircle, XCircle, DollarSign } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ClientDebitNotePdfDialog } from './ClientDebitNotePdfDialog';

type DN = {
  id: string;
  dn_number: string;
  issue_date: string;
  due_date: string | null;
  currency: string;
  total_amount: number;
  status: string;
  client_id: string | null;
  bank_account_id: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  payment_reference: string | null;
  notes: string | null;
};

type Charge = { id: string; description: string; sell_amount: number; currency: string; leg: string };

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Rascunho', emitida: 'Emitida', paga: 'Paga', cancelada: 'Cancelada',
  em_conferencia: 'Rascunho', aprovada: 'Emitida', rejeitada: 'Cancelada',
};
const STATUS_COLOR: Record<string, string> = {
  pendente: 'bg-slate-500/20 text-slate-300',
  emitida: 'bg-primary/20 text-primary',
  paga: 'bg-emerald-500/20 text-emerald-300',
  cancelada: 'bg-red-500/20 text-red-300',
};

interface Props {
  quoteId: string;
  companyId: string;
  clientId: string | null;
}

export function ClientDebitNotesTab({ quoteId, companyId, clientId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [pdfDn, setPdfDn] = useState<DN | null>(null);
  const [payDn, setPayDn] = useState<DN | null>(null);

  const { data: notes = [] } = useQuery({
    queryKey: ['client_debit_notes', quoteId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('debit_notes' as any) as any)
        .select('*')
        .eq('quote_id', quoteId)
        .eq('kind', 'client_outgoing')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DN[];
    },
  });

  const { data: charges = [] } = useQuery({
    queryKey: ['quote_sell_charges', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_charges')
        .select('id, description, sell_amount, currency, leg')
        .eq('quote_id', quoteId);
      if (error) throw error;
      return (data ?? []).filter((c: any) => Number(c.sell_amount) > 0) as Charge[];
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['company_bank_accounts', companyId],
    queryFn: async () => {
      const { data } = await supabase.from('company_bank_accounts' as any)
        .select('*').eq('company_id', companyId).eq('active', true);
      return (data ?? []) as any[];
    },
  });

  async function deleteDn(id: string) {
    if (!confirm('Excluir esta DN?')) return;
    await supabase.from('accounts_receivable' as any).delete().eq('debit_note_id', id);
    const { error } = await supabase.from('debit_notes').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('DN excluída');
    qc.invalidateQueries({ queryKey: ['client_debit_notes', quoteId] });
    qc.invalidateQueries({ queryKey: ['accounts_receivable'] });
  }

  async function markPaid() {
    if (!payDn) return;
    const paid_amount = Number((document.getElementById('paid_amount_input') as HTMLInputElement)?.value || payDn.total_amount);
    const paid_at = (document.getElementById('paid_at_input') as HTMLInputElement)?.value || format(new Date(), 'yyyy-MM-dd');
    const payment_reference = (document.getElementById('paid_ref_input') as HTMLInputElement)?.value || null;
    const { error } = await supabase.from('debit_notes' as any).update({
      status: 'paga', paid_amount, paid_at, payment_reference,
    }).eq('id', payDn.id);
    if (error) return toast.error(error.message);
    await supabase.from('accounts_receivable' as any).update({
      status: 'recebido', received_at: paid_at, received_amount: paid_amount, receipt_reference: payment_reference,
    }).eq('debit_note_id', payDn.id);
    toast.success('DN marcada como paga');
    setPayDn(null);
    qc.invalidateQueries({ queryKey: ['client_debit_notes', quoteId] });
    qc.invalidateQueries({ queryKey: ['accounts_receivable'] });
  }

  async function cancelDn(id: string) {
    const { error } = await supabase.from('debit_notes' as any).update({ status: 'cancelada' }).eq('id', id);
    if (error) return toast.error(error.message);
    await supabase.from('accounts_receivable' as any).update({ status: 'cancelado' }).eq('debit_note_id', id);
    toast.success('DN cancelada');
    qc.invalidateQueries({ queryKey: ['client_debit_notes', quoteId] });
    qc.invalidateQueries({ queryKey: ['accounts_receivable'] });
  }

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5" /> Notas de Débito ao Cliente</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Documentos de cobrança emitidos ao importador/exportador com os dados bancários da sua empresa.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={!clientId}>
          <Plus className="w-4 h-4 mr-1" /> Emitir Nova DN
        </Button>
      </CardHeader>
      <CardContent>
        {!clientId && <p className="text-sm text-amber-400 mb-3">Defina o cliente na aba Geral antes de emitir DN.</p>}
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma DN emitida.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-40"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notes.map(dn => (
                <TableRow key={dn.id}>
                  <TableCell className="font-mono">{dn.dn_number}</TableCell>
                  <TableCell>{format(new Date(dn.issue_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{dn.due_date ? format(new Date(dn.due_date), 'dd/MM/yyyy') : '-'}</TableCell>
                  <TableCell className="font-mono">{dn.currency} {Number(dn.total_amount).toFixed(2)}</TableCell>
                  <TableCell><Badge className={STATUS_COLOR[dn.status] || 'bg-slate-500/20'}>{STATUS_LABEL[dn.status] || dn.status}</Badge></TableCell>
                  <TableCell className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Ver PDF" onClick={() => setPdfDn(dn)}><FileText className="w-4 h-4" /></Button>
                    {dn.status !== 'paga' && dn.status !== 'cancelada' && (
                      <>
                        <Button variant="ghost" size="icon" title="Marcar como paga" onClick={() => setPayDn(dn)}><CheckCircle className="w-4 h-4 text-emerald-400" /></Button>
                        <Button variant="ghost" size="icon" title="Cancelar" onClick={() => cancelDn(dn.id)}><XCircle className="w-4 h-4 text-amber-400" /></Button>
                      </>
                    )}
                    <Button variant="ghost" size="icon" title="Excluir" onClick={() => deleteDn(dn.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {createOpen && (
        <CreateClientDnDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          quoteId={quoteId}
          companyId={companyId}
          clientId={clientId!}
          charges={charges}
          bankAccounts={bankAccounts}
          userId={user?.id || null}
          onCreated={() => qc.invalidateQueries({ queryKey: ['client_debit_notes', quoteId] })}
        />
      )}

      {pdfDn && (
        <ClientDebitNotePdfDialog
          open={!!pdfDn}
          onClose={() => setPdfDn(null)}
          debitNoteId={pdfDn.id}
          companyId={companyId}
          quoteId={quoteId}
        />
      )}

      <Dialog open={!!payDn} onOpenChange={(o) => !o && setPayDn(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar DN como paga</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Data do pagamento</Label><Input id="paid_at_input" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} /></div>
            <div><Label>Valor recebido ({payDn?.currency})</Label><Input id="paid_amount_input" type="number" step="0.01" defaultValue={payDn?.total_amount} /></div>
            <div><Label>Referência (TED/PIX/SWIFT)</Label><Input id="paid_ref_input" placeholder="Opcional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDn(null)}>Cancelar</Button>
            <Button onClick={markPaid}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CreateClientDnDialog({
  open, onClose, quoteId, companyId, clientId, charges, bankAccounts, userId, onCreated,
}: {
  open: boolean; onClose: () => void; quoteId: string; companyId: string; clientId: string;
  charges: Charge[]; bankAccounts: any[]; userId: string | null; onCreated: () => void;
}) {
  // Moedas estrangeiras presentes nas taxas (sempre cobradas em BRL)
  const foreignCurrencies = useMemo(() => {
    const s = new Set<string>();
    for (const c of charges) if (c.currency !== 'BRL') s.add(c.currency);
    return Array.from(s);
  }, [charges]);

  const [selected, setSelected] = useState<Set<string>>(new Set(charges.map(c => c.id)));
  const [issueDate, setIssueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 15 * 86400000), 'yyyy-MM-dd'));
  const [bankId, setBankId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Modo de câmbio
  const [rateMode, setRateMode] = useState<'single' | 'per_currency'>('single');
  const [singleRate, setSingleRate] = useState<string>('5.00');
  const [ratesByCurrency, setRatesByCurrency] = useState<Record<string, string>>({});
  const [rowRateOverrides, setRowRateOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    setSelected(new Set(charges.map(c => c.id)));
    const defaultBank = bankAccounts.find(b => b.currency === 'BRL' && b.is_default)
      || bankAccounts.find(b => b.currency === 'BRL');
    setBankId(defaultBank?.id || '');
    setRatesByCurrency(prev => {
      const next = { ...prev };
      for (const cur of foreignCurrencies) if (!next[cur]) next[cur] = '5.00';
      return next;
    });
  }, [charges.length, bankAccounts.length, foreignCurrencies.join(',')]);

  function rateFor(cur: string): number {
    if (cur === 'BRL') return 1;
    if (rateMode === 'single') return Number(singleRate) || 0;
    return Number(ratesByCurrency[cur]) || 0;
  }

  function rateForRow(c: Charge): number {
    if (c.currency === 'BRL') return 1;
    const ov = rowRateOverrides[c.id];
    if (ov !== undefined && ov !== '') return Number(ov) || 0;
    return rateFor(c.currency);
  }

  const rows = charges.map(c => {
    const rate = rateForRow(c);
    const brl = Number(c.sell_amount) * rate;
    return { ...c, rate, brl };
  });

  const totalBRL = rows.filter(r => selected.has(r.id)).reduce((s, r) => s + r.brl, 0);

  function toggle(id: string) {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  }

  async function submit() {
    if (selected.size === 0) return toast.error('Selecione ao menos uma taxa');
    if (!bankId) return toast.error('Selecione a conta bancária em BRL');
    // Validar câmbios
    for (const cur of foreignCurrencies) {
      if (rateFor(cur) <= 0) return toast.error(`Informe a taxa de câmbio para ${cur}`);
    }
    setSaving(true);
    try {
      const { data: numData, error: nErr } = await supabase.rpc('next_dn_number' as any, { p_company_id: companyId });
      if (nErr) throw nErr;
      const dn_number = numData as unknown as string;

      const headerRate = rateMode === 'single'
        ? Number(singleRate) || 1
        : (foreignCurrencies.length ? rateFor(foreignCurrencies[0]) : 1);

      const { data: dn, error: dErr } = await supabase.from('debit_notes' as any).insert({
        company_id: companyId,
        quote_id: quoteId,
        client_id: clientId,
        kind: 'client_outgoing',
        dn_number,
        issue_date: issueDate,
        due_date: dueDate,
        currency: 'BRL',
        exchange_rate: headerRate,
        total_amount: totalBRL,
        status: 'emitida',
        bank_account_id: bankId,
        notes,
        created_by: userId,
      }).select().single();
      if (dErr) throw dErr;

      const items = rows
        .filter(r => selected.has(r.id))
        .map(r => ({
          debit_note_id: (dn as any).id,
          quote_charge_id: r.id,
          description: r.description,
          charged_amount: r.brl,           // valor final em BRL
          quoted_amount: Number(r.sell_amount), // valor original na moeda origem
          currency: r.currency,             // moeda ORIGINAL (para rastreio no PDF)
          exchange_rate: r.rate,
        }));
      const { error: iErr } = await supabase.from('debit_note_items').insert(items as any);
      if (iErr) throw iErr;

      // Cria Conta a Receber no Financeiro
      await supabase.from('accounts_receivable' as any).insert({
        company_id: companyId,
        source: 'debit_note',
        debit_note_id: (dn as any).id,
        quote_id: quoteId,
        client_id: clientId,
        bank_account_id: bankId,
        description: `DN ${dn_number}`,
        currency: 'BRL',
        amount: totalBRL,
        due_date: dueDate,
        status: 'aberto',
        created_by: userId,
      });

      toast.success(`DN ${dn_number} emitida`);
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Emitir Nota de Débito ao Cliente</DialogTitle></DialogHeader>
        {charges.length === 0 ? (
          <p className="text-sm text-muted-foreground">Não há taxas de venda nesta cotação.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Emissão</Label><Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} /></div>
              <div><Label>Vencimento</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
              <div>
                <Label>Conta bancária (BRL)</Label>
                <Select value={bankId} onValueChange={setBankId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {bankAccounts.filter(b => b.currency === 'BRL').map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.bank_name} — {b.account_holder}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {foreignCurrencies.length > 0 && (
              <div className="border border-border rounded p-3 space-y-3 bg-muted/20">
                <div className="text-sm font-medium">Taxa de câmbio (cobrança em BRL)</div>
                <RadioGroup
                  value={rateMode}
                  onValueChange={(v) => setRateMode(v as any)}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="single" id="rm_single" />
                    <Label htmlFor="rm_single" className="cursor-pointer">Mesma taxa para todas as moedas</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="per_currency" id="rm_per" />
                    <Label htmlFor="rm_per" className="cursor-pointer">Uma taxa por moeda</Label>
                  </div>
                </RadioGroup>
                {rateMode === 'single' ? (
                  <div className="max-w-xs">
                    <Label>Taxa (BRL por 1 unidade estrangeira)</Label>
                    <Input type="number" step="0.0001" value={singleRate} onChange={e => setSingleRate(e.target.value)} />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {foreignCurrencies.map(cur => (
                      <div key={cur}>
                        <Label>1 {cur} = ? BRL</Label>
                        <Input
                          type="number" step="0.0001"
                          value={ratesByCurrency[cur] ?? ''}
                          onChange={e => setRatesByCurrency(p => ({ ...p, [cur]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="border border-border rounded max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor origem</TableHead>
                    <TableHead className="text-right">Câmbio</TableHead>
                    <TableHead className="text-right">Valor BRL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></TableCell>
                      <TableCell>{r.description}</TableCell>
                      <TableCell className="text-right font-mono">{r.currency} {Number(r.sell_amount).toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        {r.currency === 'BRL' ? (
                          <span className="font-mono">—</span>
                        ) : (
                          <Input
                            type="number" step="0.0001"
                            className="h-8 w-24 text-right font-mono ml-auto"
                            value={rowRateOverrides[r.id] ?? r.rate.toString()}
                            onChange={e => setRowRateOverrides(p => ({ ...p, [r.id]: e.target.value }))}
                            placeholder={rateFor(r.currency).toFixed(4)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">BRL {r.brl.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center">
              <Textarea placeholder="Observações (opcional)" value={notes} onChange={e => setNotes(e.target.value)} className="max-w-md" />
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Total a cobrar</div>
                <div className="text-xl font-bold font-mono">BRL {totalBRL.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving || charges.length === 0}>Emitir DN</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
