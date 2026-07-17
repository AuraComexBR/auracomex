import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { BackupSection } from './BackupSection';

export function DataManagementSection() {
  const { t } = useLanguage();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [quoteSearch, setQuoteSearch] = useState('');
  const [shipmentSearch, setShipmentSearch] = useState('');

  const { data: quotes = [] } = useQuery({
    queryKey: ['settings-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotes')
        .select('id, quote_number, status, created_at, clients(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: shipments = [] } = useQuery({
    queryKey: ['settings-shipments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipments')
        .select('id, reference_number, status, created_at, clients(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function deleteQuote(id: string) {
    try {
      await supabase.from('quote_charges').delete().eq('quote_id', id);
      await supabase.from('quote_items').delete().eq('quote_id', id);
      const { error } = await supabase.from('quotes').delete().eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['settings-quotes'] });
      toast.success(t('common.delete') + ' ✓');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function deleteShipment(id: string) {
    try {
      const { error } = await supabase.from('shipments').delete().eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['settings-shipments'] });
      toast.success(t('common.delete') + ' ✓');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const filteredQuotes = quotes.filter((q: any) =>
    q.quote_number?.toLowerCase().includes(quoteSearch.toLowerCase()) ||
    (q.clients as any)?.name?.toLowerCase().includes(quoteSearch.toLowerCase())
  );

  const filteredShipments = shipments.filter((s: any) =>
    s.reference_number?.toLowerCase().includes(shipmentSearch.toLowerCase()) ||
    (s.clients as any)?.name?.toLowerCase().includes(shipmentSearch.toLowerCase())
  );

  return (
    <>
      <BackupSection />

      {/* Quotes */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>{t('quotes.title')} ({quotes.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={t('common.search')} value={quoteSearch} onChange={e => setQuoteSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('quotes.number')}</TableHead>
                  <TableHead>{t('shipments.client')}</TableHead>
                  <TableHead>{t('shipments.status')}</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-sm">{q.quote_number}</TableCell>
                    <TableCell>{(q.clients as any)?.name || '-'}</TableCell>
                    <TableCell><StatusBadge status={q.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(q.created_at), 'dd/MM/yy')}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('common.delete')} {q.quote_number}?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteQuote(q.id)} className="bg-destructive text-destructive-foreground">
                              {t('common.delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Shipments */}
      <Card className="glass">
        <CardHeader>
          <CardTitle>{t('shipments.title')} ({shipments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder={t('common.search')} value={shipmentSearch} onChange={e => setShipmentSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('shipments.reference')}</TableHead>
                  <TableHead>{t('shipments.client')}</TableHead>
                  <TableHead>{t('shipments.status')}</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredShipments.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{s.reference_number}</TableCell>
                    <TableCell>{(s.clients as any)?.name || '-'}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(s.created_at), 'dd/MM/yy')}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t('common.delete')} {s.reference_number}?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteShipment(s.id)} className="bg-destructive text-destructive-foreground">
                              {t('common.delete')}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
