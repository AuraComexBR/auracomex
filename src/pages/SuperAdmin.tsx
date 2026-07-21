import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Plus, Users, Mail, Eye, EyeOff, Pencil, Trash2, Loader2, Search, KeyRound, LogIn, LogOut, LayoutDashboard, CreditCard, LifeBuoy, Megaphone, Palette } from 'lucide-react';
import { PlatformLogo } from '@/components/shared/PlatformLogo';
import { toast } from 'sonner';

import { CompanyCreateDialog } from '@/components/superadmin/CompanyCreateDialog';
import { CompanyEditDialog } from '@/components/superadmin/CompanyEditDialog';
import { CompanyCard } from '@/components/superadmin/CompanyCard';
import { RenewAccessDialog } from '@/components/superadmin/RenewAccessDialog';
import { PlatformLogoUpload } from '@/components/superadmin/PlatformLogoUpload';
import { ReleasesPanel } from '@/components/superadmin/ReleasesPanel';
import { SupportTicketsPanel } from '@/components/superadmin/SupportTicketsPanel';
import { PlatformMetrics } from '@/components/superadmin/PlatformMetrics';
import { CompanyPlansTable } from '@/components/superadmin/CompanyPlansTable';

function cleanCnpj(value: string) {
  return value.replace(/\D/g, '');
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

const ADMIN_TABS = ['visao-geral', 'empresas', 'planos', 'suporte', 'releases', 'marca'] as const;
type AdminTab = typeof ADMIN_TABS[number];

export default function SuperAdmin() {
  const { signOut, switchCompany } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ id: '', name: '', cnpj: '', email: '', phone: '', address: '', accessExpiresAt: '', isForeign: false, estimateEnabled: false });
  const [renewTarget, setRenewTarget] = useState<{ id: string; name: string } | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const hash = window.location.hash.replace('#', '');
    return (ADMIN_TABS as readonly string[]).includes(hash) ? (hash as AdminTab) : 'visao-geral';
  });

  function handleTabChange(value: string) {
    setActiveTab(value as AdminTab);
    window.history.replaceState(null, '', `#${value}`);
  }

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ['superadmin-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('company_id, email, user_id');

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const roleMap: Record<string, string> = {};
      (roles || []).forEach((r) => { roleMap[r.user_id] = r.role; });

      const countMap: Record<string, number> = {};
      const adminMap: Record<string, string> = {};
      (profiles || []).forEach((p) => {
        if (roleMap[p.user_id] === 'superadmin') return;
        countMap[p.company_id] = (countMap[p.company_id] || 0) + 1;
        if (roleMap[p.user_id] === 'admin' && !adminMap[p.company_id]) {
          adminMap[p.company_id] = p.email;
        }
      });

      return (data || []).map((c) => ({
        ...c,
        userCount: countMap[c.id] || 0,
        adminEmail: adminMap[c.id] || null,
      }));
    },
  });

  async function handleResetPassword(companyId: string, adminEmail: string) {
    setResettingPassword(companyId);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(adminEmail, {
        redirectTo: window.location.origin + '/first-access',
      });
      if (error) throw error;
      toast.success(`Email de recuperação enviado para ${adminEmail}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResettingPassword(null);
    }
  }

  async function handleAccessCompany(companyId: string, companyName: string) {
    try {
      await switchCompany(companyId, companyName);
      queryClient.clear();
      navigate('/');
    } catch (err: any) {
      toast.error('Erro ao acessar empresa: ' + err.message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success(`Empresa "${deleteTarget.name}" excluída.`);
      queryClient.invalidateQueries({ queryKey: ['superadmin-companies'] });
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  }

  function openEdit(company: any) {
    setEditForm({
      id: company.id,
      name: company.name || '',
      cnpj: company.cnpj || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      accessExpiresAt: company.access_expires_at || '',
      isForeign: company.is_foreign || false,
      estimateEnabled: !!company.estimate_enabled,
    });
    setEditOpen(true);
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <PlatformLogo size={44} className="rounded-lg" iconClassName="w-5 h-5" />
          <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground">
            <LogOut className="w-4 h-4 mr-2" />Sair
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="flex h-auto justify-start gap-1 p-1 w-full overflow-x-auto overflow-y-hidden flex-nowrap">
            <TabsTrigger value="visao-geral" className="gap-1.5"><LayoutDashboard className="w-4 h-4" />Visão Geral</TabsTrigger>
            <TabsTrigger value="empresas" className="gap-1.5"><Building2 className="w-4 h-4" />Empresas</TabsTrigger>
            <TabsTrigger value="planos" className="gap-1.5"><CreditCard className="w-4 h-4" />Planos</TabsTrigger>
            <TabsTrigger value="suporte" className="gap-1.5"><LifeBuoy className="w-4 h-4" />Suporte</TabsTrigger>
            <TabsTrigger value="releases" className="gap-1.5"><Megaphone className="w-4 h-4" />Releases</TabsTrigger>
            <TabsTrigger value="marca" className="gap-1.5"><Palette className="w-4 h-4" />Marca</TabsTrigger>
          </TabsList>

          {/* Visão Geral */}
          <TabsContent value="visao-geral" className="space-y-4 mt-4">
            <PlatformMetrics />
          </TabsContent>

          {/* Empresas */}
          <TabsContent value="empresas" className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Empresas</h2>
                <p className="text-muted-foreground text-sm">
                  {companies.length} empresa{companies.length !== 1 ? 's' : ''} cadastrada{companies.length !== 1 ? 's' : ''}
                </p>
              </div>

              <CompanyCreateDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['superadmin-companies'] })}
              />
            </div>

            <div className="grid gap-4">
              {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}
              {companies.map((company) => (
                <CompanyCard
                  key={company.id}
                  company={company}
                  resettingPassword={resettingPassword}
                  onAccess={() => handleAccessCompany(company.id, company.name)}
                  onEdit={() => openEdit(company)}
                  onDelete={() => setDeleteTarget({ id: company.id, name: company.name })}
                  onResetPassword={() => company.adminEmail && handleResetPassword(company.id, company.adminEmail)}
                  onRenew={() => setRenewTarget({ id: company.id, name: company.name })}
                />
              ))}
              {!isLoading && companies.length === 0 && (
                <div className="text-center py-16">
                  <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
                  <p className="text-muted-foreground">Nenhuma empresa cadastrada.</p>
                  <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />Cadastrar Primeira Empresa
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Planos */}
          <TabsContent value="planos" className="space-y-6 mt-4">
            <CompanyPlansTable />
          </TabsContent>

          {/* Suporte */}
          <TabsContent value="suporte" className="space-y-6 mt-4">
            <SupportTicketsPanel />
          </TabsContent>

          {/* Releases */}
          <TabsContent value="releases" className="space-y-6 mt-4">
            <ReleasesPanel />
          </TabsContent>

          {/* Marca */}
          <TabsContent value="marca" className="space-y-6 mt-4">
            <PlatformLogoUpload />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}
      <CompanyEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editForm={editForm}
        setEditForm={setEditForm}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['superadmin-companies'] })}
      />

      {/* Renew Access Dialog */}
      {renewTarget && (
        <RenewAccessDialog
          open={!!renewTarget}
          onOpenChange={(open) => !open && setRenewTarget(null)}
          companyId={renewTarget.id}
          companyName={renewTarget.name}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['superadmin-companies'] })}
        />
      )}


      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a empresa <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita e todos os dados associados serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
