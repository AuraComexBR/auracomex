import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Mail, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_LABELS, getAssignableRolesForPlan } from '@/hooks/usePermissions';
import { useSubscription, PLAN_LABEL } from '@/hooks/useSubscription';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ALL_ASSIGNABLE_ROLES: AppRole[] = [
  'diretor', 'gerente',
  'coordenador_comercial', 'inside',
  'coordenador_operacional', 'operator',
  'coordenador_financeiro', 'financeiro',
  'salesperson', 'viewer',
];

const DEPARTMENTS = [
  'Comercial',
  'Operacional',
  'Financeiro',
  'Administrativo',
  'TI',
];

export function InviteUserSection() {
  const { t, language } = useLanguage();
  const { profile } = useAuth();
  const { data: sub } = useSubscription();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    role: 'operator' as AppRole,
    department: '',
  });

  const ASSIGNABLE_ROLES = getAssignableRolesForPlan(ALL_ASSIGNABLE_ROLES, sub?.plan);
  const isBasicPlan = sub?.plan === 'starter';

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: {
          email: form.email.trim(),
          full_name: form.fullName.trim(),
          company_id: profile.company_id,
          role: form.role,
          department: form.department || null,
          redirect_to: window.location.origin + '/first-access',
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`Convite enviado para ${form.email}`);
      queryClient.invalidateQueries({ queryKey: ['company-users'] });
      setOpen(false);
      setForm({ fullName: '', email: '', role: 'operator', department: '' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Convidar Usuário</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="w-4 h-4 mr-2" />
              Convidar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Novo Usuário</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                  placeholder="Maria Santos"
                />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="maria@empresa.com"
                />
                <p className="text-xs text-muted-foreground">
                  O usuário receberá um e-mail com link para definir a própria senha.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Cargo *</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]?.[language] || role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isBasicPlan && (
                    <p className="text-xs text-muted-foreground">
                      Plano Básico oferece papéis simples. Faça upgrade para Professional para liberar coordenadores, diretoria e vendedor com comissão.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                <Mail className="w-4 h-4 mr-2" />
                {creating ? 'Enviando...' : 'Enviar Convite'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Envie um convite por e-mail. O usuário define a própria senha ao aceitar o convite.
        </p>
      </CardContent>
    </Card>
  );
}
