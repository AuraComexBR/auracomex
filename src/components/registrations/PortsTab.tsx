import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Pencil, Trash2, Ship, Plane, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CountrySelect } from '@/components/shared/CountrySelect';

const PORT_TYPES = ['sea', 'air', 'both'] as const;

export function PortsTab() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    city: '',
    country_code: '',
    country_name: '',
    type: 'sea' as string,
  });

  // Lista de países que realmente têm portos/aeroportos cadastrados, pra
  // popular o filtro (em vez da lista genérica de todos os países do mundo).
  const { data: countryOptions = [] } = useQuery({
    queryKey: ['ports-countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ports')
        .select('country_code, country_name')
        // Sem isso o PostgREST corta em 1000 linhas por padrão, o que
        // deixaria países de fora da lista do filtro.
        .limit(20000);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const row of (data || []) as any[]) {
        if (row.country_code && !map.has(row.country_code)) {
          map.set(row.country_code, row.country_name || row.country_code);
        }
      }
      return Array.from(map.entries())
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    },
  });

  // Só busca (e mostra) a listagem depois que o usuário escolhe um país —
  // com milhares de portos/aeroportos cadastrados, não faz sentido carregar
  // ou exibir tudo de cara.
  const { data: ports = [], isLoading } = useQuery({
    queryKey: ['ports-management', countryFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ports')
        .select('*')
        .eq('country_code', countryFilter)
        .order('code')
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!countryFilter,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.code.trim() || !form.name.trim() || !form.country_code.trim()) {
        throw new Error('Código, nome e país são obrigatórios');
      }

      const payload = {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        city: form.city.trim() || null,
        country_code: form.country_code.trim().toUpperCase(),
        country_name: form.country_name.trim() || null,
        type: form.type,
      };

      if (editingId) {
        const { error } = await supabase.from('ports').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ports').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ports-management'] });
      setShowForm(false);
      setEditingId(null);
      resetForm();
      toast.success(editingId ? 'Porto atualizado' : 'Porto cadastrado');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ports').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ports-management'] });
      toast.success('Porto removido');
    },
    onError: (err: any) => toast.error(err.message),
  });

  function resetForm() {
    setForm({ code: '', name: '', city: '', country_code: '', country_name: '', type: 'sea' });
  }

  function openEdit(port: any) {
    setForm({
      code: port.code || '',
      name: port.name || '',
      city: port.city || '',
      country_code: port.country_code || '',
      country_name: port.country_name || '',
      type: port.type || 'sea',
    });
    setEditingId(port.id);
    setShowForm(true);
  }

  const typeIcon = (type: string) => {
    if (type === 'air') return <Plane className="w-3.5 h-3.5 text-blue-400" />;
    if (type === 'sea') return <Ship className="w-3.5 h-3.5 text-cyan-400" />;
    return <MapPin className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const typeLabel = (type: string) => {
    if (type === 'air') return 'Aeroporto';
    if (type === 'sea') return 'Porto';
    return 'Ambos';
  };

  const typeColor = (type: string) => {
    if (type === 'air') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    if (type === 'sea') return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20';
    return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
  };

  const filtered = ports.filter((p: any) => {
    const term = search.toLowerCase();
    return (
      p.code?.toLowerCase().includes(term) ||
      p.name?.toLowerCase().includes(term) ||
      p.city?.toLowerCase().includes(term) ||
      p.country_code?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, nome ou cidade..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecione um país..." />
            </SelectTrigger>
            <SelectContent>
              {countryOptions.map((c) => (
                <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Porto/Aeroporto
        </Button>
      </div>

      <Card className="glass">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>País</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!countryFilter ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Selecione um país acima para ver os portos e aeroportos cadastrados.
                  </TableCell>
                </TableRow>
              ) : isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Nenhum porto encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p: any) => (
                  <TableRow key={p.id} className="hover:bg-secondary/50">
                    <TableCell className="font-mono font-semibold text-xs">{p.code}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${typeColor(p.type)} flex items-center gap-1 w-fit`}>
                        {typeIcon(p.type)} {typeLabel(p.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.city || '-'}</TableCell>
                    <TableCell>{p.country_code}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Porto/Aeroporto' : 'Novo Porto/Aeroporto'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Código (IATA/LOCODE)</Label>
                <Input
                  placeholder="BRSSZ"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  maxLength={10}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sea">Porto Marítimo</SelectItem>
                    <SelectItem value="air">Aeroporto</SelectItem>
                    <SelectItem value="both">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                placeholder="Port of Santos"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input
                placeholder="Santos"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Código do País</Label>
                <Input
                  placeholder="BR"
                  value={form.country_code}
                  onChange={(e) => setForm({ ...form, country_code: e.target.value.toUpperCase() })}
                  maxLength={2}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Nome do País</Label>
                <Input
                  placeholder="Brazil"
                  value={form.country_name}
                  onChange={(e) => setForm({ ...form, country_name: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!form.code.trim() || !form.name.trim() || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Salvando...' : editingId ? 'Salvar' : 'Cadastrar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
