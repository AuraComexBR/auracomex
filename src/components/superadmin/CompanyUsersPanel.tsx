import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ROLE_LABELS } from '@/hooks/usePermissions';
import { Loader2, UserPlus, Mail, Power, PowerOff } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ASSIGNABLE_ROLES: AppRole[] = [
  'admin', 'diretor', 'gerente',
  'coordenador_comercial', 'inside',
  'coordenador_operacional', 'operator',
  'coordenador_financeiro', 'financeiro',
  'salesperson', 'viewer',
];

interface CompanyUsersPanelProps {
  companyId: string;
}

export function CompanyUsersPanel({ companyId }: CompanyUsersPanelProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', role: 'admin' as AppRole });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['company-users-admin', companyId],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('company_id', companyId)
        .order('full_name');
      if (error) throw error;

      const userIds = (profiles || []).map((p) => p.user_id);
      if (userIds.length === 0) return [];

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      const roleMap: Record<string, string> = {};
      (roles || []).forEach((r) => { roleMap[r.user_id] = r.role; });

      const filtered = (profiles || [])
        .filter((p) => roleMap[p.user_id] !== 'superadmin')
        .map((p) => ({
          ...p,
          role: roleMap[p.user_id] || 'operator',
        }));

      let statuses: Record<string, boolean> = {};
      try {
        const { data } = await supabase.functions.invoke('manage-user', {
          body: { action: 'list_status', user_ids: filtered.map((u) => u.user_id) },
        });
        statuses = data?.statuses || {};
      } catch {/* ignore */}

      return filtered.map((u) => ({ ...u, active: statuses[u.user_id] ?? true }));
    },
  });

  async function handleRoleChange(userId: string, newRole: AppRole) {
    const { error } = await supabase
      .from('user_roles')
      .upsert({ user_id: userId, role: newRole } as any, { onConflict: 'user_id' } as any);

    if (error) {
      toast.error(error.message);
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['company-users-admin', companyId] });
    toast.success('Cargo atualizado com sucesso');
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: form.email.trim(),
          full_name: form.fullName.trim(),
          company_id: companyId,
          role: form.role,
          redirect_to: window.location.origin + '/first-access',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Convite enviado para ${form.email}`);
      queryClient.invalidateQueries({ queryKey: ['company-users-admin', companyId] });
      setOpen(false);
      setForm({ fullName: '', email: '', role: 'admin' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  }

  async function handleToggleActive(userId: string, nextActive: boolean) {
    try {
      const { data, error } = await supabase.functions.invoke('manage-user', {
        body: { action: 'toggle_active', user_id: userId, active: nextActive },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(nextActive ? 'Usuário ativado' : 'Usuário desativado');
      queryClient.invalidateQueries({ queryKey: ['company-users-admin', companyId] });
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando usuários...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <UserPlus className="w-4 h-4 mr-2" />Convidar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Cargo *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>{ROLE_LABELS[role]?.pt || role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={sending}>
                <Mail className="w-4 h-4 mr-2" />
                {sending ? 'Enviando...' : 'Enviar Convite'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {users.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">Nenhum usuário cadastrado.</p>
      )}
      {users.map((u) => (
        <div key={u.user_id} className="flex items-center gap-3 justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {u.full_name}
              {!u.active && <span className="ml-2 text-xs text-destructive">(inativo)</span>}
            </p>
            <p className="text-xs text-muted-foreground truncate">{u.email}</p>
          </div>
          <Select
            value={u.role}
            onValueChange={(v) => handleRoleChange(u.user_id, v as AppRole)}
          >
            <SelectTrigger className="w-48 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]?.pt || role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="shrink-0"
                title={u.active ? 'Desativar usuário' : 'Ativar usuário'}
              >
                {u.active ? <PowerOff className="w-4 h-4 text-destructive" /> : <Power className="w-4 h-4 text-emerald-500" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{u.active ? 'Desativar usuário?' : 'Ativar usuário?'}</AlertDialogTitle>
                <AlertDialogDescription>
                  {u.active
                    ? `${u.full_name} não conseguirá mais fazer login até ser reativado.`
                    : `${u.full_name} voltará a ter acesso ao sistema.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleToggleActive(u.user_id, !u.active)}>
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ))}
    </div>
  );
}
