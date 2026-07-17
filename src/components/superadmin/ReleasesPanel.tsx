import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Highlight = { icon: string; label: string; description: string };
type Release = {
  id?: string;
  version: string;
  title: string;
  summary: string;
  highlights: Highlight[];
  is_major: boolean;
  published_at: string;
};

const empty = (): Release => ({
  version: '', title: '', summary: '', highlights: [{ icon: 'Sparkles', label: '', description: '' }],
  is_major: false, published_at: new Date().toISOString().slice(0, 10),
});

export function ReleasesPanel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Release>(empty());

  const { data: releases = [] } = useQuery({
    queryKey: ['app_releases_admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_releases' as any).select('*').order('published_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  function openNew() { setForm(empty()); setOpen(true); }
  function openEdit(r: any) {
    setForm({
      id: r.id, version: r.version, title: r.title, summary: r.summary || '',
      highlights: r.highlights || [], is_major: r.is_major,
      published_at: (r.published_at || '').slice(0, 10),
    });
    setOpen(true);
  }

  async function save() {
    if (!form.version || !form.title) { toast.error('Informe versão e título'); return; }
    const payload: any = {
      version: form.version, title: form.title, summary: form.summary,
      highlights: form.highlights.filter(h => h.label),
      is_major: form.is_major,
      published_at: new Date(form.published_at).toISOString(),
      created_by: user?.id,
    };
    const q = form.id
      ? supabase.from('app_releases' as any).update(payload).eq('id', form.id)
      : supabase.from('app_releases' as any).insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success('Release salva');
    setOpen(false);
    qc.invalidateQueries({ queryKey: ['app_releases_admin'] });
    qc.invalidateQueries({ queryKey: ['app_releases'] });
  }

  async function remove(id: string) {
    if (!confirm('Excluir esta versão?')) return;
    const { error } = await supabase.from('app_releases' as any).delete().eq('id', id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['app_releases_admin'] });
    qc.invalidateQueries({ queryKey: ['app_releases'] });
  }

  function updateHl(i: number, k: keyof Highlight, v: string) {
    setForm(f => ({ ...f, highlights: f.highlights.map((h, idx) => idx === i ? { ...h, [k]: v } : h) }));
  }
  function addHl() { setForm(f => ({ ...f, highlights: [...f.highlights, { icon: 'Sparkles', label: '', description: '' }] })); }
  function removeHl(i: number) { setForm(f => ({ ...f, highlights: f.highlights.filter((_, idx) => idx !== i) })); }

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Releases / Novidades</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Nova versão</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Versão</TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Publicação</TableHead>
              <TableHead>Major</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {releases.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">v{r.version}</TableCell>
                <TableCell>{r.title}</TableCell>
                <TableCell>{format(new Date(r.published_at), 'dd/MM/yyyy')}</TableCell>
                <TableCell>{r.is_major && <Badge className="bg-primary/20 text-primary">major</Badge>}</TableCell>
                <TableCell className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Editar versão' : 'Nova versão'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Versão *</Label><Input placeholder="1.2.0" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} /></div>
              <div className="col-span-2"><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            </div>
            <div><Label>Resumo</Label><Textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data de publicação</Label><Input type="date" value={form.published_at} onChange={e => setForm({ ...form, published_at: e.target.value })} /></div>
              <div className="flex items-end gap-2 pb-2"><Switch checked={form.is_major} onCheckedChange={v => setForm({ ...form, is_major: v })} /><Label>Grande atualização (major)</Label></div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Destaques</Label>
                <Button size="sm" variant="outline" onClick={addHl}><Plus className="w-3 h-3 mr-1" />Adicionar</Button>
              </div>
              <div className="space-y-2">
                {form.highlights.map((h, i) => (
                  <div key={i} className="grid grid-cols-[100px_1fr_2fr_auto] gap-2 items-start">
                    <Input placeholder="Ícone lucide" value={h.icon} onChange={e => updateHl(i, 'icon', e.target.value)} />
                    <Input placeholder="Label" value={h.label} onChange={e => updateHl(i, 'label', e.target.value)} />
                    <Input placeholder="Descrição" value={h.description} onChange={e => updateHl(i, 'description', e.target.value)} />
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeHl(i)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Nome do ícone lucide-react (ex: Rocket, FileText, DollarSign, Palette, Ship).</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}