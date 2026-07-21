import { useState, useMemo, Fragment } from 'react';
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
import { Search, Pencil, Loader2, LogIn, KeyRound, Trash2, ChevronDown, ChevronUp, Users, Mail, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { CompanyUsersPanel } from './CompanyUsersPanel';

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

// Prioriza a contagem real de assentos comprada no Stripe (seats_active, vinda do webhook)
// sobre o limite manual de cortesia (seats_limit). Se nenhum dos dois estiver definido
// (ex: empresa ainda em trial, sem checkout feito), não mostra limite nenhum.
function planSeats(sub: any): number | null {
  if (!sub) return null;
  if (sub.seats_active != null) return sub.seats_active;
  if (sub.seats_limit != null) return sub.seats_limit;
  return null;
}

// Padrão de embarques/mês por plano (usado quando não há override manual em shipments_limit).
const PLAN_SHIPMENTS_DEFAULT: Record<string, number | null> = {
  starter: 30,
  professional: 100,
  business: null, // sem limite
};

// Prioriza um override manual de cortesia (shipments_limit) sobre o padrão do plano.
// Sem assinatura registrada, não mostra limite nenhum.
function planShipmentsLimit(sub: any): number | null {
  if (!sub) return null;
  if (sub.shipments_limit != null) return sub.shipments_limit;
  return PLAN_SHIPMENTS_DEFAULT[sub.plan] ?? null;
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

interface CompanyPlansTableProps {
  resettingPassword: string | null;
  onAccess: (companyId: string, companyName: string) => void;
  onEdit: (company: any) => void;
  onDelete: (companyId: string, companyName: string) => void;
  onResetPassword: (companyId: string, adminEmail: string) => void;
}

export function CompanyPlansTable({ resettingPassword, onAccess, onEdit, onDelete, onResetPassword }: CompanyPlansTableProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ plan: 'starter', status: 'trial', seatsLimit: '', shipmentsLimit: '' });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['superadmin-company-plans'],
    queryFn: async () => {
      const [companiesRes, subsRes, profilesRes, rolesRes, shipmentsRes] = await Promise.all([
        supabase.from('companies').select('id, name, cnpj, email').order('created_at', { ascending: false }),
        supabase.from('company_subscriptions' as any).select('*'),
        supabase.from('profiles').select('company_id, email, user_id'),
        supabase.from('user_roles').select('user_id, role'),
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

      const roleMap: Record<string, string> = {};
      (rolesRes.data || []).forEach((r: any) => { roleMap[r.user_id] = r.role; });

      const userCount: Record<string, number> = {};
      const adminMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => {
        if (roleMap[p.user_id] === 'superadmin') return;
        userCount[p.company_id] = (userCount[p.company_id] || 0) + 1;
        if (roleMap[p.user_id] === 'admin' && !adminMap[p.company_id]) {
          adminMap[p.company_id] = p.email;
        }
      });

      const shipmentCount: Record<string, number> = {};
      (shipmentsRes.data || []).forEach((s: any) => { shipmentCount[s.company_id] = (shipmentCount[s.company_id] || 0) + 1; });

      return (companiesRes.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        cnpj: c.cnpj,
        email: c.email,
        adminEmail: adminMap[c.id] || null,
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
        <CardTitle>Empresas & Planos</CardTitle>
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

        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="whitespace-nowrap">Usuários</TableHead>
                <TableHead>Embarques/mês</TableHead>
                <TableHead>MRR</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-6">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && filtered.map((row) => {
                const sub = row.sub;
                const statusMeta = sub ? STATUS_LABEL[sub.status] : null;
                const isExpanded = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell className="font-medium">
                        <div>{row.name}</div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-normal">
                          {row.cnpj && <span className="font-mono">{formatCnpj(row.cnpj)}</span>}
                          {row.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{row.email}</span>}
                        </div>
                      </TableCell>
                      <TableCell>{sub ? (PLAN_LABEL[sub.plan] || sub.plan) : '—'}</TableCell>
                      <TableCell>
                        {statusMeta ? (
                          <Badge variant="outline" className={statusMeta.cls}>{statusMeta.label}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <button
                          className="inline-flex items-center gap-1 text-sm hover:underline whitespace-nowrap"
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}
                        >
                          <Users className="w-3.5 h-3.5 shrink-0" />
                          <span>{row.users}{planSeats(sub) != null ? ` / ${planSeats(sub)}` : ' / ∞'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0" />}
                        </button>
                      </TableCell>
                      <TableCell>
                        {row.shipmentsThisMonth}{planShipmentsLimit(sub) != null ? ` / ${planShipmentsLimit(sub)}` : ' / ∞'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {sub?.mrr_cents ? fmtBRL(sub.mrr_cents) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Editar plano">
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onEdit(row)} title="Editar dados da empresa">
                            <Building2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onAccess(row.id, row.name)} title="Acessar sistema da empresa">
                            <LogIn className="w-4 h-4" />
                          </Button>
                          {row.adminEmail && (
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => onResetPassword(row.id, row.adminEmail)}
                              disabled={resettingPassword === row.id}
                              title={`Enviar recuperação para ${row.adminEmail}`}
                            >
                              {resettingPassword === row.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <KeyRound className="w-4 h-4" />}
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => onDelete(row.id, row.name)} className="text-destructive hover:text-destructive" title="Excluir empresa">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${row.id}-expanded`}>
                        <TableCell colSpan={7} className="bg-secondary/20 border-t-0">
                          <p className="text-sm font-medium mb-3">Usuários e Cargos</p>
                          <CompanyUsersPanel companyId={row.id} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
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
            {editTarget && (
              <p className="text-xs text-muted-foreground">
                Assentos: {editTarget.sub?.seats_active != null
                  ? `${editTarget.sub.seats_active} comprados no Stripe (automático)`
                  : editTarget.sub?.seats_limit != null
                    ? `${editTarget.sub.seats_limit} — cortesia manual, sem assinatura Stripe ainda`
                    : 'sem limite (empresa em trial, sem checkout)'}
                . O número de usuários é controlado pela compra no Stripe, não precisa preencher aqui.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Embarques/mês: segue automaticamente o padrão do plano selecionado acima (Básico: 30, Professional: 100,
              Business: ilimitado). Não precisa preencher nada aqui.
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
