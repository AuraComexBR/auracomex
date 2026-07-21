import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const PLAN_LABEL: Record<string, string> = {
  starter: 'Básico',
  professional: 'Professional',
  business: 'Business',
};

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  trial: { label: 'Trial', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  active: { label: 'Ativo', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  past_due: { label: 'Em atraso', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  canceled: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground border-border' },
};

function fmtBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CompanyPlansTable() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ plan: 'starter', status: 'trial', seatsLimit: '', shipmentsLimit: '' });
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['superadmin-company-plans'],
    queryFn: async () => {
      const [companiesRes, subsRes, profilesRes, shipmentsRes] = await Promise.all([
        supabase.from('companies').select('id, name'),
        supabase.from('company_subscriptions' as any).select('*'),
        supabase.from('profiles').select('company_id'),
        (() => {
          const monthStart = new Date();
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);
          return supabase.from('shipments').select('company_id, created_at').gte('created_at', monthStart.toISOString());
        })(),
      ]);
      if (companiesRes.error) throw companiesRes.error;

      const subsByCompany: Record<string, any> = {};
      (subsRes.data || []).forEach((s: any) => { subsByCompany[s.company_id] = s; });

      const userCount: Record<string, number> = {};
      (profilesRes.data || []).forEach((p: any) => { userCount[p.company_id] = (userCount[p.company_id] || 0) + 1; });

      const shipmentCount: Record<string, number> = {};
      (shipmentsRes.data || []).forEach((s: any) => { shipmentCount[s.company_id] = (shipmentCount[s.company_id] || 0) + 1; });

      return (companiesRes.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        sub: subsByCompany[c.id] || null,
        users: userCount[c.id] || 0,
        shipmentsThisMonth: shipmentCount[c.id] || 0,
      }));
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (search && !r.name?.toLowerCase().includes(search.toLowerCase())) return false;
      if (planFilter !== 'all' && r.sub?.plan !== planFilter) return false;
      if (statusFilter !== 'all' && r.sub?.status !== statusFilter) return false;
      return true;
    });
  }, [rows, search, planFilter, statusFilter]);

  function openEdit(row: any) {
    setEditTarget(row);
    setEditForm({
      plan: row.sub?.plan || 'starter',
      status: row.sub?.status || 'trial',
      seatsLimit: row.sub?.seats_limit != null ? String(row.sub.seats_limit) : '',
      shipmentsLimit: row.sub?.shipments_limit != null ? String(row.sub.shipments_limit) : '',
    });
  }

  async function handleSaveEdit() {
    if (!editTarget) return;
    setSaving(true);
    try {
      const payload = {
        company_id: editTarget.id,
        plan: editForm.plan,
        status: editForm.status,
        seats_limit: editForm.seatsLimit.trim() === '' ? null : parseInt(editForm.seatsLimit, 10),
        shipments_limit: editForm.shipmentsLimit.trim() === '' ? null : parseInt(editForm.shipmentsLimit, 10),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('company_subscriptions' as any)
        .upsert(payload as any, { onConflict: 'company_id' });
      if (error) throw error;
      toast.success('Plano atualizado');
      queryClient.invalidateQueries({ queryKey: ['superadmin-company-plans'] });
      queryClient.invalidateQueries({ queryKey: ['platform-metrics'] });
      setEditTarget(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Planos & Assinaturas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar empresa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="sm:w-44"><SelectValue placeholder="Plano" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os planos</SelectItem>
              {Object.keys(PLAN_LABEL).map((p) => (
                <SelectItem key={p} value={p}>{PLAN_LABEL[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.keys(STATUS_LABEL).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="max-h-[480px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usuários</TableHead>
                <TableHead>Embarques/mês</TableHead>
                <TableHead>MRR</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && filtered.map((row) => {
                const sub = row.sub;
                const statusMeta = sub ? STATUS_LABEL[sub.status] : null;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{sub ? (PLAN_LABEL[sub.plan] || sub.plan) : '—'}</TableCell>
                    <TableCell>
                      {statusMeta ? (
                        <Badge variant="outline" className={statusMeta.cls}>{statusMeta.label}</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {row.users}{sub?.seats_limit != null ? ` / ${sub.seats_limit}` : ''}
                    </TableCell>
                    <TableCell>
                      {row.shipmentsThisMonth}{sub?.shipments_limit != null ? ` / ${sub.shipments_limit}` : ' / ∞'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {sub?.mrr_cents ? fmtBRL(sub.mrr_cents) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Nenhuma empresa encontrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar plano — {editTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={editForm.plan} onValueChange={(v) => setEditForm({ ...editForm, plan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(PLAN_LABEL).map((p) => (
                    <SelectItem key={p} value={p}>{PLAN_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(STATUS_LABEL).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Limite de usuários</Label>
                <Input
                  value={editForm.seatsLimit}
                  onChange={(e) => setEditForm({ ...editForm, seatsLimit: e.target.value.replace(/\D/g, '') })}
                  placeholder="Ilimitado"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-2">
                <Label>Limite de embarques/mês</Label>
                <Input
                  value={editForm.shipmentsLimit}
                  onChange={(e) => setEditForm({ ...editForm, shipmentsLimit: e.target.value.replace(/\D/g, '') })}
                  placeholder="Ilimitado"
                  inputMode="numeric"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Deixe os campos de limite vazios pra "ilimitado". Isso é uma cortesia manual — não altera nada no Stripe;
              se a empresa tiver assinatura ativa lá, o próximo evento de webhook pode sobrescrever esses valores.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
