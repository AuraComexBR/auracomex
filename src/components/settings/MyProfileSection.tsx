import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export function MyProfileSection() {
  const { profile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || '');
    supabase
      .from('profiles')
      .select('phone')
      .eq('user_id', profile.user_id)
      .maybeSingle()
      .then(({ data }) => setPhone(((data as any)?.phone as string) || ''));
  }, [profile?.user_id]);

  async function handleSave() {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), phone: phone.trim() || null } as any)
      .eq('user_id', profile.user_id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Perfil atualizado');
  }

  if (!profile) return null;

  return (
    <Card className="glass">
      <CardHeader><CardTitle>Meu Perfil</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={profile.email} disabled />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-9999"
            maxLength={30}
          />
          <p className="text-xs text-muted-foreground">
            Exibido no cabeçalho das propostas em PDF que você gerar.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || !fullName.trim()}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </CardContent>
    </Card>
  );
}