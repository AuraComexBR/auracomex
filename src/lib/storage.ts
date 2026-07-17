import { supabase } from '@/integrations/supabase/client';

export const DOCS_BUCKET = 'shipment-documents';

/**
 * Extrai o caminho (path) do storage a partir de:
 *  - uma URL pública antiga (…/object/public/shipment-documents/PATH)
 *  - uma URL assinada (…/object/sign/shipment-documents/PATH?token=…)
 *  - ou um path cru já salvo (companyId/…/arquivo.pdf)
 */
export function extractDocPath(fileUrlOrPath: string | null | undefined): string {
  if (!fileUrlOrPath) return '';
  const value = String(fileUrlOrPath);
  for (const marker of [
    `/object/public/${DOCS_BUCKET}/`,
    `/object/sign/${DOCS_BUCKET}/`,
    `/${DOCS_BUCKET}/`,
  ]) {
    const i = value.indexOf(marker);
    if (i !== -1) {
      return decodeURIComponent(value.slice(i + marker.length).split('?')[0]);
    }
  }
  return value; // já é um path
}

/**
 * Gera uma URL assinada temporária (expira em 1h) e abre/baixa o documento.
 * Funciona para usuários autenticados (bucket privado).
 */
export async function openSignedDoc(
  fileUrlOrPath: string | null | undefined,
  download = false,
): Promise<void> {
  if (!fileUrlOrPath) return;
  const path = extractDocPath(fileUrlOrPath);
  const { data, error } = await supabase.storage
    .from(DOCS_BUCKET)
    .createSignedUrl(path, 60 * 60, download ? { download: true } : undefined);

  if (data?.signedUrl) {
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  // Fallback: arquivo antigo cuja URL http ainda possa abrir
  const value = String(fileUrlOrPath);
  if (value.startsWith('http')) {
    window.open(value, '_blank', 'noopener,noreferrer');
    return;
  }
  throw error || new Error('Não foi possível gerar o link do documento');
}
