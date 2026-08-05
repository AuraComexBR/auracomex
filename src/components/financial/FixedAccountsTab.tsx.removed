import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Play, CheckCircle2, Loader2, Paperclip } from 'lucide-react';
import { useOverheadCategories, useOverheadEntries, useOverheadExpenses, OverheadExpense } from '@/hooks/useOverhead';
import { OverheadExpenseModal } from '@/components/overhead/OverheadExpenseModal';
import { OneOffExpenseModal } from '@/components/overhead/OneOffExpenseModal';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { DOCS_BUCKET, openSignedDoc } from '@/lib/storage';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { toast } from 'sonner';

function currentMonthISO() {
  // Monta a string a partir do ano/mês LOCAIS, sem passar por toISOString()
  // (que converte pra UTC). Em fusos atrás de UTC (ex: Brasil, UTC-3), depois
  // das ~21h locais o toISOString() já cai no dia seguinte em UTC, então o
  // mês "atual" virava "YYYY-MM-02" em vez de "YYYY-MM-01" — como a busca de
  // lançamentos filtra por igualdade exata de reference_month, isso fazia a
  // tela do mês atual carregar vazia (só corrigia ao trocar de mês, porque o
  // seletor sempre monta a data como "YYYY-MM-01" manualmente).
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

export default function FixedAccountsTab() {
  const { profile } = useAuth();
  const companyId = profile?.company_id;
  const [referenceMonth, setReferenceMonth] = useState(currentMonthISO());
  const categories = useOverheadCategories();
  const expenses = useOverheadExpenses();
  const entries = useOverheadEntries(referenceMonth);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OverheadExpense | null>(null);
  const [oneOffOpen, setOneOffOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [payFile, setPayFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);

  // Despesas podem ser lançadas em moedas diferentes (BRL/USD/EUR) — os KPIs
  // do Resumo somam tudo, então precisam converter pra BRL antes de somar,
  // senão o total exibido como "R$" mistura valores de moedas diferentes.
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
    const paid = list.filter(e => e.status === 'paid').reduce((s, e) => s + toBRL(Number(e.amount), e.currency), 0);
    const pending = list.filter(e => e.status === 'pending').reduce((s, e) => s + toBRL(Number(e.amount), e.currency), 0);
    const late = list.filter(e => e.status === 'late').reduce((s, e) => s + toBRL(Number(e.amount), e.currency), 0);
    const total = paid + pending + late;
    return { paid, pending, late, total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.data, usdBrl, eurBrl]);

  const expensesById = useMemo(() => new Map((expenses.data || []).map(e => [e.id, e])), [expenses.data]);
  const categoriesById = useMemo(() => new Map((categories.data || []).map(c => [c.id, c])), [categories.data]);

  const oneOffEntries = useMemo(
    () => (entries.data || []).filter(e => expensesById.get(e.overhead_expense_id)?.active === false),
    [entries.data, expensesById],
  );
  const recurringEntries = useMemo(
    () => (entries.data || []).filter(e => expensesById.get(e.overhead_expense_id)?.active !== false),
    [entries.data, expensesById],
  );

  return (
    <div className="space-y-4">
      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList>
          <TabsTrigger value="summary">Resumo</TabsTrigger>
          <TabsTrigger value="entries">Despesas Geral</TabsTrigger>
          <TabsTrigger value="expenses">Despesas Recorrentes</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
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
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="Previsto" value={totals.total} />
                <KPI label="Pago" value={totals.paid} tone="success" />
                <KPI label="Em aberto" value={totals.pending} tone="warning" />
                <KPI label="Atrasado" value={totals.late} tone="danger" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ENTRIES */}
        <TabsContent value="entries" className="space-y-4">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CardTitle>Despesas avulsas do mês</CardTitle>
                <Input
                  type="month"
                  className="w-40"
                  value={referenceMonth.slice(0, 7)}
                  onChange={(e) => setReferenceMonth(e.target.value + '-01')}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setOneOffOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Despesa avulsa
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {entries.isLoading ? (
                <div className="py-10 text-center text-muted-foreground">Carregando...</div>
              ) : oneOffEntries.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground text-sm">
                  Nenhuma despesa avulsa neste mês. Clique em "Despesa avulsa" para adicionar.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border/50">
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
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Pagar
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

        {/* EXPENSES */}
        <TabsContent value="expenses">
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>Despesas recorrentes</CardTitle>
                <Input
                  type="month"
                  className="w-40"
                  value={referenceMonth.slice(0, 7)}
                  onChange={(e) => setReferenceMonth(e.target.value + '-01')}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => entries.generate.mutate()} disabled={entries.generate.isPending}>
                  {entries.generate.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                  Gerar lançamentos do mês
                </Button>
                <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
                  <Plus className="w-4 h-4 mr-1" /> Nova despesa
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(expenses.data || []).length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Nenhuma despesa cadastrada.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border/50">
                        <th className="py-2 pr-3">Descrição</th>
                        <th className="py-2 pr-3">Categoria</th>
                        <th className="py-2 pr-3">Recorrência</th>
                        <th className="py-2 pr-3">Venc.</th>
                        <th className="py-2 pr-3 text-right">Valor</th>
                        <th className="py-2 pr-3">Ativa</th>
                        <th className="py-2 pr-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(expenses.data || []).filter(x => x.active !== false || !x.name?.startsWith('[Avulso]')).map((exp) => {
                        const cat = exp.category_id ? categoriesById.get(exp.category_id) : null;
                        return (
                          <tr key={exp.id} className="border-b border-border/30">
                            <td className="py-2 pr-3">{exp.name}</td>
                            <td className="py-2 pr-3">{cat ? <Badge variant="secondary">{cat.name}</Badge> : '—'}</td>
                            <td className="py-2 pr-3 capitalize">{exp.recurrence}</td>
                            <td className="py-2 pr-3">dia {exp.due_day}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{fmt(Number(exp.amount_default), exp.currency)}</td>
                            <td className="py-2 pr-3">
                              <Switch checked={exp.active} onCheckedChange={(v) => expenses.upsert.mutate({ id: exp.id, name: exp.name, active: v } as any)} />
                            </td>
                            <td className="py-2 pr-3 text-right space-x-1">
                              <Button size="icon" variant="ghost" onClick={() => { setEditing(exp); setModalOpen(true); }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost"><Trash2 className="w-3.5 h-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
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
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Pagar
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

        {/* CATEGORIES */}
        <TabsContent value="categories">
          <Card className="glass">
            <CardHeader><CardTitle>Categorias</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <NewCategoryForm onCreate={(name, color) => categories.upsert.mutate({ name, color, active: true } as any)} />
              <div className="space-y-2">
                {(categories.data || []).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 rounded-md border border-border/50 bg-muted/10 p-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: c.color || '#007BFF' }} />
                    <Input className="max-w-xs" value={c.name} onChange={(e) => categories.upsert.mutate({ ...c, name: e.target.value } as any)} />
                    <Input type="color" className="w-14 p-1" value={c.color || '#007BFF'} onChange={(e) => categories.upsert.mutate({ ...c, color: e.target.value } as any)} />
                    <Switch checked={c.active} onCheckedChange={(v) => categories.upsert.mutate({ ...c, active: v } as any)} />
                    <Button size="icon" variant="ghost" onClick={() => categories.remove.mutate(c.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
                {(categories.data || []).length === 0 && (
                  <div className="text-sm text-muted-foreground text-center py-6">Nenhuma categoria cadastrada.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <OverheadExpenseModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        expense={editing}
        categories={categories.data || []}
      />

      <OneOffExpenseModal
        open={oneOffOpen}
        onOpenChange={setOneOffOpen}
        referenceMonth={referenceMonth}
        categories={categories.data || []}
      />

      <Dialog open={!!payTarget} onOpenChange={(o) => !o && setPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            {payTarget && (
              <DialogDescription>
                {expensesById.get(payTarget.overhead_expense_id)?.name || 'Lançamento'} — {fmt(Number(payTarget.amount), payTarget.currency)}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
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
              {uploadingReceipt ? 'Enviando…' : 'Confirmar pagamento'}
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

function KPI({ label, value, tone }: { label: string; value: number; tone?: 'success' | 'warning' | 'danger' }) {
  const toneClass = tone === 'success' ? 'text-emerald-400'
    : tone === 'warning' ? 'text-amber-400'
    : tone === 'danger' ? 'text-destructive'
    : 'text-foreground';
  return (
    <Card className="glass">
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold tabular-nums ${toneClass}`}>{fmt(value)}</p>
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

function NewCategoryForm({ onCreate }: { onCreate: (name: string, color: string) => void }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#007BFF');
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        <Label>Nova categoria</Label>
        <Input placeholder="Ex.: Software, Aluguel, Salários" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Input type="color" className="w-14 p-1" value={color} onChange={(e) => setColor(e.target.value)} />
      <Button onClick={() => { if (name.trim()) { onCreate(name.trim(), color); setName(''); } }}>
        <Plus className="w-4 h-4 mr-1" /> Adicionar
      </Button>
    </div>
  );
}