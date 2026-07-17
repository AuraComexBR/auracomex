import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { openSignedDoc } from '@/lib/storage';
import { useQuery } from '@tanstack/react-query';
import { Search, FileText, Download, Eye, Radio } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useState } from 'react';

export default function Documents() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  const { data: documents = [] } = useQuery({
    queryKey: ['all-documents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*, shipments(reference_number), quotes(quote_number)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = documents.filter((d: any) =>
    d.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-slide-in">
      <h1 className="text-2xl font-bold tracking-tight">{t('nav.documents')}</h1>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <Card className="glass"><CardContent className="py-12 text-center text-muted-foreground">{t('common.no_data')}</CardContent></Card>
        ) : (
          filtered.map((doc: any) => (
            <Card key={doc.id} className="glass hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {doc.document_type} • {(doc.shipments as any)?.reference_number || (doc.quotes as any)?.quote_number || ''}
                      {doc.file_size ? ` • ${(doc.file_size / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {doc.visible_tracking && (
                    <span title="Visível no Tracking">
                      <Radio className="w-4 h-4 text-emerald-500" />
                    </span>
                  )}
                  {doc.file_url && (
                    <>
                      <Button variant="ghost" size="icon" title="Visualizar"
                        onClick={() => openSignedDoc(doc.file_url).catch((e) => toast.error(e.message))}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Baixar"
                        onClick={() => openSignedDoc(doc.file_url, true).catch((e) => toast.error(e.message))}>
                        <Download className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
