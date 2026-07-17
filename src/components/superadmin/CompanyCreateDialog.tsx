import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Plus, Eye, EyeOff, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';

const PERIOD_OPTIONS = [
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: '180', label: '180 dias' },
  { value: '365', label: '1 ano' },
];

function cleanCnpj(value: string) { return value.replace(/\D/g, ''); }

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

interface CompanyForm {
  companyName: string; companyCnpj: string; companyEmail: string;
  companyPhone: string; companyAddress: string;
  adminName: string; adminEmail: string; adminPassword: string;
  accessPeriod: string; isForeign: boolean;
}

const emptyForm: CompanyForm = {
  companyName: '', companyCnpj: '', companyEmail: '', companyPhone: '', companyAddress: '',
  adminName: '', adminEmail: '', adminPassword: '', accessPeriod: '30', isForeign: false,
};

function isFormDirty(form: CompanyForm): boolean {
  return form.companyName !== '' || form.companyCnpj !== '' || form.companyEmail !== '' ||
    form.companyPhone !== '' || form.companyAddress !== '' || form.adminName !== '' ||
    form.adminEmail !== '' || form.adminPassword !== '';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CompanyCreateDialog({ open, onOpenChange, onSuccess }: Props) {
  const [form, setForm] = useState<CompanyForm>({ ...emptyForm });
  const [creating, setCreating] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next && isFormDirty(form)) {
      setConfirmClose(true);
      return;
    }
    if (!next) setForm({ ...emptyForm });
    onOpenChange(next);
  }

  function handleConfirmDiscard() {
    setConfirmClose(false);
    setForm({ ...emptyForm });
    onOpenChange(false);
  }

  async function lookupCnpj() {
    const clean = cleanCnpj(form.companyCnpj);
    if (clean.length !== 14) { toast.error('CNPJ deve ter 14 dígitos'); return; }
    setLookingUp(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
      if (!res.ok) throw new Error('not found');
      const data = await res.json();
      const address = [data.logradouro, data.numero, data.complemento, data.bairro,
        data.municipio ? `${data.municipio}/${data.uf}` : '', data.cep].filter(Boolean).join(', ');
      const phone = data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0, 2)}) ${data.ddd_telefone_1.slice(2)}` : '';
      setForm(prev => ({
        ...prev,
        companyName: data.razao_social || data.nome_fantasia || prev.companyName,
        companyEmail: data.email || prev.companyEmail,
        companyPhone: phone || prev.companyPhone,
        companyAddress: address || prev.companyAddress,
      }));
      toast.success('Dados do CNPJ encontrados!');
    } catch { toast.error('CNPJ não encontrado na base da Receita Federal'); }
    finally { setLookingUp(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.isForeign && cleanCnpj(form.companyCnpj).length !== 14) {
      toast.error('CNPJ é obrigatório para empresas nacionais');
      return;
    }
    setCreating(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + parseInt(form.accessPeriod));

      const { data: company, error: companyError } = await supabase.from('companies').insert({
        name: form.companyName.trim(),
        cnpj: form.isForeign ? null : (cleanCnpj(form.companyCnpj) || null),
        email: form.companyEmail.trim() || null,
        phone: form.companyPhone.trim() || null,
        address: form.companyAddress.trim() || null,
        access_expires_at: expiresAt.toISOString(),
        is_foreign: form.isForeign,
      } as any).select().single();
      if (companyError) throw companyError;

      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: form.adminEmail.trim(), password: form.adminPassword,
          full_name: form.adminName.trim(), company_id: company.id, role: 'admin',
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('Empresa e administrador criados com sucesso!');
      onSuccess();
      onOpenChange(false);
      setForm({ ...emptyForm });
    } catch (err: any) { toast.error(err.message); }
    finally { setCreating(false); }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger asChild>
          <Button><Plus className="w-4 h-4 mr-2" />Nova Empresa</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => { if (isFormDirty(form)) { e.preventDefault(); setConfirmClose(true); } }}>
          <DialogHeader><DialogTitle>Cadastrar Nova Empresa</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3 border-b pb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados da Empresa</h3>

              {/* Foreign company toggle */}
              <div className="flex items-center gap-3">
                <Switch checked={form.isForeign} onCheckedChange={(v) => setForm({ ...form, isForeign: v, companyCnpj: v ? '' : form.companyCnpj })} />
                <Label className="cursor-pointer">Empresa do Exterior</Label>
              </div>

              {!form.isForeign && (
                <div className="space-y-2">
                  <Label>CNPJ *</Label>
                  <div className="flex gap-2">
                    <Input value={formatCnpj(form.companyCnpj)} onChange={(e) => setForm({ ...form, companyCnpj: cleanCnpj(e.target.value) })} placeholder="00.000.000/0000-00" className="font-mono" maxLength={18} />
                    <Button type="button" variant="outline" onClick={lookupCnpj} disabled={lookingUp || cleanCnpj(form.companyCnpj).length !== 14} className="shrink-0">
                      {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4 mr-1" />Consultar</>}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Nome da Empresa *</Label>
                <Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required placeholder="Acme Logistics Ltda" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} placeholder="contato@empresa.com" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={form.companyPhone} onChange={(e) => setForm({ ...form, companyPhone: e.target.value })} placeholder="(11) 99999-0000" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço</Label>
                <Input value={form.companyAddress} onChange={(e) => setForm({ ...form, companyAddress: e.target.value })} placeholder="Rua, número, bairro, cidade/UF" />
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Responsável / Admin</h3>
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} required placeholder="João Silva" />
              </div>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} required placeholder="joao@empresa.com" />
              </div>
              <div className="space-y-2">
                <Label>Senha Temporária *</Label>
                <div className="relative">
                  <Input type={showPassword ? 'text' : 'password'} value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required minLength={6} placeholder="Min. 6 caracteres" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">O usuário precisará alterar a senha no primeiro login.</p>
              </div>
            </div>
            <div className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Período de Acesso</h3>
              <div className="space-y-2">
                <Label>Validade do Acesso *</Label>
                <Select value={form.accessPeriod} onValueChange={(v) => setForm({ ...form, accessPeriod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">A empresa terá acesso ao sistema por este período a partir de hoje.</p>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? 'Criando...' : 'Criar Empresa + Admin'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar cadastro?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem dados preenchidos que serão perdidos. Deseja realmente sair sem salvar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDiscard}>Descartar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
