import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Play, CheckCircle2, Loader2, Paperclip, TrendingUp, TrendingDown } from 'lucide-react';
import { useOverheadCategories, useOverheadEntries, useOverheadExpenses, OverheadExpense } from '@/hooks/useOverhead';
import { TransactionModal } from '@/components/overhead/TransactionModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DOCS_BUCKET, openSignedDoc } from '@/lib/storage';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { toast } from 'sonner';

// "Geral" — despesas e receitas da empresa sem vínculo com processo/cotação
// (ex-"Despesas Fixas"). Cada lançamento carrega um "kind" (despesa/receita)
// e pode ser recorrente ou avulso — a categoria dedicada de gestão virou a
// aba "Categoria", uma irmã desta na Movimentações.
function currentMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function fmt(n: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}
function fmtDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR');
}

export default function GeneralTab() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const [referenceMonth, setReferenceMonth] = useState(currentMonthISO());
  const categories = useOverheadCategories();
  const expenses = useOverheadExpenses();
  const entries = useOverheadEntries(referenceMonth);

  const [addOpen, setAddOpen] = useState<'despesa' | 'receita' | null>(null);
  const [editing, setEditing] = useState<OverheadExpense | null>(null);
  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [payFile, setPayFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  const { usdBrl, eurBrl } = useExchangeRate();
  function toBRL(amount: number, currency: string): number {
    const cur = (currency || 'BRL').toUpperCase();
    if (cur === 'BRL') return amount;
    if (cur === 'USD') return amount * (usdBrl || 0);
    if (cur === 'EUR') return amount * (eurBrl || 0);
    return amount;
  }

  const totals = useMemo(() => {
    const list = entries.data || [];
    const byKind = (kind: 'despesa' | 'receita') => {
      const l = list.filter((e) => e.kind === kind);
      const paid = l.filter((e) => e.status === 'paid').reduce((s, e) => s + toBRL(Number(e.amount), e.currency), 0);
      const pending = l.filter((e) => e.status === 'pending').reduce((s, e) => s + toBRL(Number(e.amount), e.currency), 0);
      const late = l.filter((e) => e.status === 'late').reduce((s, e) => s + toBRL(Number(e.amount), e.currency), 0);
      return { paid, pending, late, total: paid + pending + late };
    };
    const despesa = byKind('despesa');
    const receita = byKind('receita');
    return { despesa, receita, saldoRealizado: receita.paid - despesa.paid, saldoPrevisto: receita.total - despesa.total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.data, usdBrl, eurBrl]);

  const expensesById = useMemo(() => new Map((expenses.data || []).map((e) => [e.id, e])), [expenses.data]);
  const categoriesById = useMemo(() => new Map((categories.data || []).map((c) => [c.id, c])), [categories.data]);

  const oneOffEntries = useMemo(
    () => (entries.data || []).filter((e) => expensesById.get(e.overhead_expense_id)?.active === false),
    [entries.data, expensesById],
  );
  const recurringEntries = useMemo(
    () => (entries.data || []).filter((e) => expensesById.get(e.overhead_expense_id)?.active !== false),
    [entries.data, expensesById],
  );
  const recurringExpenses = useMemo(
    () => (expenses.data || []).filter((x) => x.active !== false || !x.name?.startsWith('[Avulso]')),
    [expenses.data],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">Despesas e receitas da empresa, sem vínculo com processo.</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAddOpen('despesa')}>
            <TrendingDown className="w-4 h-4 mr-1" /> Adicionar Despesa
          </Button>
          <Button variant="outline" onClick={() => setAddOpen('receita')}>
            <TrendingUp className="w-4 h-4 mr-1" /> Adicionar Receita
          </Button>
        </div>
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Resumo</TabsTrigger>
          <TabsTrigger value="entries">Lançamentos</TabsTrigger>
          <TabsTrigger value="expenses">Recorrentes</TabsTrigger>
        </TabsList>

        {/* SUMMARY */}
        <TabsContent value="summary" className="space-y-4">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center gap-3">
              <CardTitle>Resumo do mês</CardTitle>
              <Input
                type="month"
                className="w-40"
                value={referenceMonth.slice(0, 7)}
                onChange={(e) => setReferenceMonth(e.target.value + '-01')}
              />
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Despesas</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPI label="Previsto" value={totals.despesa.total} />
                  <KPI label="Pago" value={totals.despesa.paid} tone="success" />
                  <KPI label="Em aberto" value={totals.despesa.pending} tone="warning" />
                  <KPI label="Atrasado" value={totals.despesa.late} tone="danger" />
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Receitas</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KPI label="Previsto" value={totals.receita.total} />
                  <KPI label="Recebido" value={totals.receita.paid} tone="success" />
                  <KPI label="Em aberto" value={totals.receita.pending} tone="warning" />
                  <KPI label="Atrasado" value={totals.receita.late} tone="danger" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border/50">
                <KPI label="Saldo realizado (recebido - pago)" value={totals.saldoRealizado} tone={totals.saldoRealizado >= 0 ? 'success' : 'danger'} big />
                <KPI label="Saldo previsto (total receita - total despesa)" value={totals.saldoPrevisto} tone={totals.saldoPrevisto >= 0 ? 'success' : 'danger'} big />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LANÇAMENTOS AVULSOS */}
        <TabsContent value="entries" className="space-y-4">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CardTitle>Lançamentos avulsos do mês</CardTitle>
                <Input
                  type="month"
                  className="w-40"
                  value={referenceMonth.slice(0, 7)}
                  onChange={(e) => setReferenceMonth(e.target.value + '-01')}
                />
              </div>
            </CardHeader>
            <CardContent>
              {entries.isLoading ? (
                <div className="py-10 text-center text-muted-foreground">Carregando...</div>
              ) : oneOffEntries.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  Nenhum lançamento avulso neste mês. Use "Adicionar Despesa" ou "Adicionar Receita" acima (deixe "Recorrente" desligado).
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border/50">
                        <th className="py-2 pr-3">Tipo</th>
                        <th className="py-2 pr-3">Descrição</th>
                        <th className="py-2 pr-3">Categoria</th>
                        <th className="py-2 pr-3">Vencimento</th>
                        <th className="py-2 pr-3 text-right">Valor</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {oneOffEntries.map((e) => {
                        const exp = expensesById.get(e.overhead_expense_id);
                        const cat = exp?.category_id ? categoriesById.get(exp.category_id) : null;
                        const overdue = e.status === 'pending' && new Date(e.due_date) < new Date();
                        return (
                          <tr key={e.id} className="border-b border-border/30">
                            <td className="py-2 pr-3"><KindBadge kind={e.kind} /></td>
                            <td className="py-2 pr-3">{(exp?.name || '—').replace(/^\[Avulso\]\s*/, '')}</td>
                            <td className="py-2 pr-3">
                              {cat ? <Badge variant="secondary" style={{ borderColor: cat.color || undefined }}>{cat.name}</Badge> : '—'}
                            </td>
                            <td className={`py-2 pr-3 ${overdue ? 'text-destructive font-medium' : ''}`}>{fmtDate(e.due_date)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{fmt(Number(e.amount), e.currency)}</td>
                            <td className="py-2 pr-3">
                              <StatusBadge status={overdue ? 'late' : e.status} />
                            </td>
                            <td className="py-2 pr-3 text-right space-x-1">
                              {e.payment_proof_url && (
                                <Button size="icon" variant="ghost" title="Ver comprovante"
                                  onClick={() => openSignedDoc(e.payment_proof_url!).catch((err: any) => toast.error(err.message))}>
                                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              )}
                              {e.status !== 'paid' ? (
                                <Button size="sm" variant="outline"
                                  onClick={() => {
                                    setPayTarget(e);
                                    setPayDate(new Date().toISOString().slice(0, 10));
                                    setPayFile(null);
                                  }}>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {e.kind === 'receita' ? 'Receber' : 'Pagar'}
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost"
                                  onClick={() => entries.update.mutate({ id: e.id, patch: { status: 'pending', paid_at: null } })}>
                                  Desfazer
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" onClick={() => entries.remove.mutate(e.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RECORRENTES */}
        <TabsContent value="expenses">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>Recorrentes cadastradas</CardTitle>
                <Input
                  type="month"
                  className="w-40"
                  value={referenceMonth.slice(0, 7)}
                  onChange={(e) => setReferenceMonth(e.target.value + '-01')}
                />
              </div>
              <Button variant="outline" onClick={() => entries.generate.mutate()} disabled={entries.generate.isPending}>
                {entries.generate.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                Gerar lançamentos do mês
              </Button>
            </CardHeader>
            <CardContent>
              {recurringExpenses.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma despesa/receita recorrente cadastrada.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border/50">
                        <th className="py-2 pr-3">Tipo</th>
                        <th className="py-2 pr-3">Descrição</th>
                        <th className="py-2 pr-3">Categoria</th>
                        <th className="py-2 pr-3">Recorrência</th>
                        <th className="py-2 pr-3">Venc.</th>
                        <th className="py-2 pr-3 text-right">Valor</th>
                        <th className="py-2 pr-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurringExpenses.map((exp) => {
                        const cat = exp.category_id ? categoriesById.get(exp.category_id) : null;
                        return (
                          <tr key={exp.id} className="border-b border-border/30">
                            <td className="py-2 pr-3"><KindBadge kind={exp.kind} /></td>
                            <td className="py-2 pr-3">{exp.name}</td>
                            <td className="py-2 pr-3">{cat ? <Badge variant="secondary">{cat.name}</Badge> : '—'}</td>
                            <td className="py-2 pr-3 capitalize">{exp.recurrence}</td>
                            <td className="py-2 pr-3">dia {exp.due_day}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{fmt(Number(exp.amount_default), exp.currency)}</td>
                            <td className="py-2 pr-3 text-right space-x-1">
                              <Button size="icon" variant="ghost" onClick={() => setEditing(exp)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost"><Trash2 className="w-3.5 h-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir?</AlertDialogTitle>
                                    <AlertDialogDescription>Todos os lançamentos vinculados serão removidos.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => expenses.remove.mutate(exp.id)}>Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass mt-4">
            <CardHeader>
              <CardTitle>Lançamentos recorrentes do mês</CardTitle>
            </CardHeader>
            <CardContent>
              {recurringEntries.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum lançamento recorrente neste mês. Clique em "Gerar lançamentos do mês".
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border/50">
                        <th className="py-2 pr-3">Tipo</th>
                        <th className="py-2 pr-3">Descrição</th>
                        <th className="py-2 pr-3">Categoria</th>
                        <th className="py-2 pr-3">Vencimento</th>
                        <th className="py-2 pr-3 text-right">Valor</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2 pr-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurringEntries.map((e) => {
                        const exp = expensesById.get(e.overhead_expense_id);
                        const cat = exp?.category_id ? categoriesById.get(exp.category_id) : null;
                        const overdue = e.status === 'pending' && new Date(e.due_date) < new Date();
                        return (
                          <tr key={e.id} className="border-b border-border/30">
                            <td className="py-2 pr-3"><KindBadge kind={e.kind} /></td>
                            <td className="py-2 pr-3">{exp?.name || '—'}</td>
                            <td className="py-2 pr-3">
                              {cat ? <Badge variant="secondary" style={{ borderColor: cat.color || undefined }}>{cat.name}</Badge> : '—'}
                            </td>
                            <td className={`py-2 pr-3 ${overdue ? 'text-destructive font-medium' : ''}`}>{fmtDate(e.due_date)}</td>
                            <td className="py-2 pr-3 text-right">
                              <EditableAmountCell
                                value={Number(e.amount)}
                                currency={e.currency}
                                disabled={e.status === 'paid'}
                                onSave={(v) => entries.update.mutate({ id: e.id, patch: { amount: v } })}
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <StatusBadge status={overdue ? 'late' : e.status} />
                            </td>
                            <td className="py-2 pr-3 text-right space-x-1">
                              {e.payment_proof_url && (
                                <Button size="icon" variant="ghost" title="Ver comprovante"
                                  onClick={() => openSignedDoc(e.payment_proof_url!).catch((err: any) => toast.error(err.message))}>
                                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              )}
                              {e.status !== 'paid' ? (
                                <Button size="sm" variant="outline"
                                  onClick={() => {
                                    setPayTarget(e);
                                    setPayDate(new Date().toISOString().slice(0, 10));
                                    setPayFile(null);
                                  }}>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {e.kind === 'receita' ? 'Receber' : 'Pagar'}
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost"
                                  onClick={() => entries.update.mutate({ id: e.id, patch: { status: 'pending', paid_at: null } })}>
                                  Desfazer
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" onClick={() => entries.remove.mutate(e.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TransactionModal
        open={!!addOpen}
        onOpenChange={(o) => { if (!o) setAddOpen(null); }}
        kind={addOpen || 'despesa'}
        expense={null}
        referenceMonth={referenceMonth}
        categories={categories.data || []}
      />

      <TransactionModal
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        kind={editing?.kind || 'despesa'}
        expense={editing}
        referenceMonth={referenceMonth}
        categories={categories.data || []}
      />

      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{payTarget?.kind === 'receita' ? 'Registrar recebimento' : 'Registrar pagamento'}</DialogTitle>
            {payTarget && (
              <DialogDescription>
                {expensesById.get(payTarget.overhead_expense_id)?.name || 'Lançamento'} — {fmt(Number(payTarget.amount), payTarget.currency)}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={payDate} onChange={(ev) => setPayDate(ev.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Comprovante (opcional)</Label>
              <Input type="file" accept="application/pdf,image/*" onChange={(ev) => setPayFile(ev.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayTarget(null)} disabled={uploadingReceipt}>Cancelar</Button>
            <Button
              disabled={uploadingReceipt}
              onClick={async () => {
                if (!payTarget || !payDate) return;
                let payment_proof_url: string | null = null;
                if (payFile) {
                  setUploadingReceipt(true);
                  const path = `${companyId}/receipts/overhead/${payTarget.id}/${Date.now()}_${payFile.name}`;
                  const { error: upErr } = await supabase.storage.from(DOCS_BUCKET).upload(path, payFile);
                  setUploadingReceipt(false);
                  if (upErr) return toast.error('Erro ao anexar comprovante', { description: upErr.message });
                  payment_proof_url = path;
                }
                entries.update.mutate(
                  {
                    id: payTarget.id,
                    patch: {
                      status: 'paid',
                      paid_at: new Date(payDate + 'T12:00:00').toISOString(),
                      ...(payment_proof_url ? { payment_proof_url } : {}),
                    },
                  },
                  { onSuccess: () => { setPayTarget(null); setPayFile(null); } },
                );
              }}
            >
              {uploadingReceipt ? 'Enviando…' : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditableAmountCell({ value, currency, disabled, onSave }: { value: number; currency: string; disabled?: boolean; onSave: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  if (disabled) {
    return <span className="tabular-nums">{fmt(value, currency)}</span>;
  }

  return (
    <Input
      type="number"
      step="0.01"
      className="w-28 h-8 text-right ml-auto tabular-nums"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const n = Number(draft);
        if (isFinite(n) && n >= 0 && n !== value) onSave(n);
        else setDraft(String(value));
      }}
    />
  );
}

function KPI({ label, value, tone, big }: { label: string; value: number; tone?: 'success' | 'warning' | 'danger'; big?: boolean }) {
  const toneClass = tone === 'success' ? 'text-emerald-400'
    : tone === 'warning' ? 'text-amber-400'
    : tone === 'danger' ? 'text-destructive'
    : 'text-foreground';
  return (
    <Card className="glass">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`${big ? 'text-2xl' : 'text-xl'} font-semibold tabular-nums ${toneClass}`}>{fmt(value)}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    pending: { label: 'Pendente', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    paid: { label: 'Pago', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    late: { label: 'Atrasado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
    cancelled: { label: 'Cancelado', className: 'bg-muted text-muted-foreground border-border' },
  };
  const m = map[status] || map.pending;
  return <Badge variant="outline" className={m.className}>{m.label}</Badge>;
}

function KindBadge({ kind }: { kind: 'despesa' | 'receita' }) {
  return kind === 'receita' ? (
    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
      <TrendingUp className="w-3 h-3" /> Receita
    </Badge>
  ) : (
    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
      <TrendingDown className="w-3 h-3" /> Despesa
    </Badge>
  );
}
