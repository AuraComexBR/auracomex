// Upload do PDF da ordem de coleta (documento próprio da Aura, entregue ao
// motorista — não é o certificado oficial do terminal) pro bucket
// shipment-documents + registro em `documents`, mesmo caminho usado pela
// DocumentsTab. O PDF em si é gerado por OrdemColetaPdfDialog.tsx a partir
// de conteúdo React de verdade (ref visível dentro de um Dialog aberto) —
// NÃO tentar gerar a partir de um <div> off-screen criado via innerHTML;
// isso já causou PDF em branco (o html2canvas não captura de forma
// confiável elementos fora do fluxo visível de renderização, mesmo com
// z-index negativo ou delays de requestAnimationFrame — testado e falhou).

import { supabase } from '@/integrations/supabase/client';
import { DOCS_BUCKET } from '@/lib/storage';

interface SalvarDocumentoParams {
  pdfBlob: Blob;
  filename: string;
  companyId: string;
  shipmentId: string;
  ordemId: string;
  uploadedBy: string | null;
}

export async function salvarDocumentoOrdemColeta(
  p: SalvarDocumentoParams
): Promise<{ documentId: string; path: string }> {
  const path = `${p.companyId}/${p.shipmentId}/${Date.now()}_${p.filename}`;
  const { error: uploadError } = await supabase.storage.from(DOCS_BUCKET).upload(path, p.pdfBlob, {
    contentType: 'application/pdf',
  });
  if (uploadError) throw uploadError;

  const { data: docRow, error: docError } = await (supabase
    .from('documents')
    .insert({
      shipment_id: p.shipmentId,
      company_id: p.companyId,
      document_type: 'ordem_coleta',
      name: p.filename,
      file_url: path,
      uploaded_by: p.uploadedBy,
    } as any)
    .select('id')
    .single() as any);
  if (docError) throw docError;

  const { error: updateError } = await (supabase
    .from('coleta_ordens_coleta' as any)
    .update({ document_id: docRow.id } as any)
    .eq('id', p.ordemId) as any);
  if (updateError) throw updateError;

  return { documentId: docRow.id, path };
}
