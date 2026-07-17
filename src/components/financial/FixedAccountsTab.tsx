import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Pencil, Play, CheckCircle2, Loader2 } from 'lucide-react';
import { useOverheadCategories, useOverheadEntries, useOverheadExpenses, OverheadExpense } from '@/hooks/useOverhead';
import { OverheadExpenseModal } from '@/components/overhead/OverheadExpenseModal';
import { OneOffExpenseModal } from '@/components/overhead/OneOffExpenseModal';

function currentMonthISO() {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}
function fmt(n: number, currency = 'BRL') {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
}
function fmtDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR');
}

export default function FixedAccountsTab() {
  const [referenceMonth, setReferenceMonth] = useState(currentMonthISO());
  const categories = useOverheadCategories();
  const expenses = useOverheadExpenses();
  const entries = useOverheadEntries(referenceMonth);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OverheadExpense | null>(null);
  const [oneOffOpen, setOneOffOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any | null>(null);
  const [payDate, setPayDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const totals = useMemo(() => {
    const list = entries.data || [];
    const paid = list.filter(e => e.status === 'paid').reduce((s, e) => s + Number(e.amount), 0);
    const pending = list.filter(e => e.status === 'pending').reduce((s, e) => s + Number(e.amount), 0);
    const late = list.filter(e => e.status === 'late').reduce((s, e) => s + Number(e.amount), 0);
    const total = paid + pending + late;
    return { paid, pending, late, total };
  }, [entries.data]);

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
                              {e.status !== 'paid' ? (
                                <Button size="sm" variant="outline"
                                  onClick={() => {
                                    setPayTarget(e);
                                    setPayDate(new Date().toISOString().slice(0, 10));
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
                            <td className="py-2 pr-3 text-right tabular-nums">{fmt(Number(e.amount), e.currency)}</td>
                            <td className="py-2 pr-3">
                              <StatusBadge status={overdue ? 'late' : e.status} />
                            </td>
                            <td className="py-2 pr-3 text-right space-x-1">
                              {e.status !== 'paid' ? (
                                <Button size="sm" variant="outline"
                                  onClick={() => {
                                    setPayTarget(e);
                                    setPayDate(new Date().toISOString().slice(0, 10));
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
          <div className="space-y-2">
            <Label>Data do pagamento</Label>
            <Input type="date" value={payDate} onChange={(ev) => setPayDate(ev.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayTarget(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (!payTarget || !payDate) return;
                entries.update.mutate(
                  { id: payTarget.id, patch: { status: 'paid', paid_at: new Date(payDate + 'T12:00:00').toISOString() } },
                  { onSuccess: () => setPayTarget(null) },
                );
              }}
            >
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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