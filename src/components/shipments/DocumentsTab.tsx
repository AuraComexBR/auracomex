import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { openSignedDoc } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { Upload, FileText, Download, Eye, Trash2, Radio } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useCallback } from 'react';

interface Props {
  shipmentId: string;
  companyId: string;
  isQuoteMode?: boolean;
  quoteId?: string;
  onGeneratePdf?: () => void;
}

export function DocumentsTab({ shipmentId, companyId, isQuoteMode, quoteId, onGeneratePdf }: Props) {
  const { t } = useLanguage();
  const { profile } = useAuth();

  const { data: documents = [], refetch } = useQuery({
    queryKey: ['documents', shipmentId, isQuoteMode ? 'quote' : 'shipment'],
    queryFn: async () => {
      if (isQuoteMode) {
        const { data, error } = await (supabase
          .from('documents')
          .select('*') as any)
          .eq('quote_id', shipmentId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      }
      let query = supabase
        .from('documents')
        .select('*');
      if (quoteId) {
        query = query.or(`shipment_id.eq.${shipmentId},quote_id.eq.${quoteId}`);
      } else {
        query = query.eq('shipment_id', shipmentId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      const path = `${companyId}/${shipmentId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('shipment-documents')
        .upload(path, file);

      if (uploadError) {
        toast.error(uploadError.message);
        continue;
      }

      await supabase.from('documents').insert({
        shipment_id: isQuoteMode ? null : shipmentId,
        quote_id: isQuoteMode ? shipmentId : null,
        company_id: companyId,
        name: file.name,
        file_url: path,
        file_size: file.size,
        uploaded_by: profile?.user_id,
        document_type: 'other' as any,
      } as any);
    }
    refetch();
    toast.success(`${files.length} arquivo(s) enviado(s)`);
  }, [shipmentId, companyId, profile, refetch]);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    // Reuse drop logic
    for (const file of Array.from(files)) {
      const path = `${companyId}/${shipmentId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('shipment-documents')
        .upload(path, file);
      if (uploadError) { toast.error(uploadError.message); continue; }
      await supabase.from('documents').insert({
        shipment_id: isQuoteMode ? null : shipmentId, quote_id: isQuoteMode ? shipmentId : null,
        company_id: companyId, name: file.name,
        file_url: path, file_size: file.size, uploaded_by: profile?.user_id, document_type: 'other' as any,
      } as any);
    }
    refetch();
    toast.success(`${files.length} arquivo(s) enviado(s)`);
  };

  return (
    <Card className="glass">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-semibold">{t('shipments.documents')}</CardTitle>
        <div className="flex gap-2">
          {onGeneratePdf && (
            <Button variant="outline" size="sm" onClick={onGeneratePdf}>
              <FileText className="w-4 h-4 mr-2" />
              Gerar PDF
            </Button>
          )}
          <label>
            <Button variant="outline" size="sm" asChild>
              <span><Upload className="w-4 h-4 mr-2" /> {t('common.upload')}</span>
            </Button>
            <input type="file" className="hidden" multiple onChange={handleFileInput} />
          </label>
        </div>
      </CardHeader>
      <CardContent>
        {/* Drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-border rounded-xl p-8 text-center mb-4 hover:border-primary/50 transition-colors"
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Arraste os arquivos aqui</p>
        </div>

        {/* Document list */}
        <div className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">{t('common.no_data')}</p>
          ) : (
            documents.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{doc.document_type} • {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    title={doc.visible_tracking ? 'Visível no Tracking' : 'Oculto no Tracking'}
                    onClick={async () => {
                      const { error } = await (supabase.from('documents').update({ visible_tracking: !doc.visible_tracking } as any).eq('id', doc.id) as any);
                      if (error) { toast.error(error.message); return; }
                      refetch();
                      toast.success(doc.visible_tracking ? 'Removido do tracking' : 'Disponível no tracking');
                    }}
                  >
                    <Radio className={`w-4 h-4 ${doc.visible_tracking ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Excluir" onClick={async () => {
                    const { error } = await supabase.from('documents').delete().eq('id', doc.id);
                    if (error) { toast.error(error.message); return; }
                    refetch();
                    toast.success('Documento excluído');
                  }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
