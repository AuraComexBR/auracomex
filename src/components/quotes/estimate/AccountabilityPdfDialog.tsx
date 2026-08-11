import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AccountabilityRow, AccountabilityItemRow, AccountabilityCategoria } from '@/hooks/useAccountability';

interface Props {
  open: boolean;
  onClose: () => void;
  quote: any;
  accountability: AccountabilityRow;
  items: AccountabilityItemRow[];
}

const fmtBRL = (n: number) => (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const categoriaLabels: Record<AccountabilityCategoria, string> = {
  origin: 'Origem',
  freight: 'Frete/Seguro',
  destination: 'Destino',
  local: 'Local',
  tax: 'Imposto',
  afrmm: 'AFRMM',
  siscomex: 'Siscomex',
  other: 'Outro',
};

const th: React.CSSProperties = { background: '#f0f0f0', fontSize: 10, fontWeight: 700, padding: '5px 8px', borderBottom: '1px solid #ccc', textAlign: 'left' };
const td: React.CSSProperties = { fontSize: 10, padding: '4px 8px', borderBottom: '1px solid #eee' };
const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'monospace' };

const sheet: React.CSSProperties = {
  width: '210mm',
  minHeight: '294mm',
  padding: '12mm 14mm',
  boxSizing: 'border-box',
  background: '#fff',
  position: 'relative',
};

export function AccountabilityPdfDialog({ open, onClose, quote, accountability, items }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [company, setCompany] = useState<any>(null);
  const [client, setClient] = useState<any>(null);

  useEffect(() => {
    if (!open || !quote?.company_id) return;
    supabase.from('companies').select('*').eq('id', quote.company_id).single().then(r => setCompany(r.data));
    if (quote?.client_id) {
      supabase.from('clients').select('*').eq('id', quote.client_id).single().then(r => setClient(r.data));
    } else {
      setClient(null);
    }
  }, [open, quote?.company_id, quote?.client_id]);

  if (!open) return null;

  const totalOrcado = Number(accountability.total_orcado_brl || 0);
  const totalPago = Number(accountability.total_pago_brl || 0);
  const diferenca = Number(accountability.diferenca_brl ?? (totalPago - totalOrcado));

  async function handleDownload() {
    if (!ref.current) return;
    setDownloading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const filename = `prestacao_contas_${quote?.quote_number || accountability.id.slice(0, 8)}.pdf`;
      const blob: Blob = await html2pdf().set({
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      } as any).from(ref.current).outputPdf('blob');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);

      try {
        const path = `${quote.company_id}/${quote.id}/${Date.now()}_${filename}`;
        const up = await supabase.storage.from('shipment-documents').upload(path, blob, { contentType: 'application/pdf' });
        if (!up.error) {
          await supabase.from('documents').insert({
            quote_id: quote.id, shipment_id: quote.shipment_id || null,
            company_id: quote.company_id, name: filename, file_url: path,
            file_size: blob.size, document_type: 'other' as any,
            // Marca pra o portal de tracking (TrackingV2) poder liberar esse
            // PDF por cliente (ver TRACKING_DOC_CATEGORY_MAP em trackingFieldRegistry.ts).
            // visible_tracking=true é o requisito de base — quem controla se
            // aparece de fato pra ESSE cliente é o toggle correspondente em
            // Cadastros > Tracking.
            custom_category: 'tracking:accountability_pdf',
            visible_tracking: true,
          } as any);
        }
      } catch (e) { console.error(e); }

      toast.success('PDF gerado.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDownloading(false);
    }
  }

  const BRAND = (company as any)?.brand_primary_color || '#1a1a2e';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Prestação de Contas</DialogTitle>
          <Button onClick={handleDownload} disabled={downloading} size="sm">
            <Download className="w-4 h-4 mr-2" /> {downloading ? 'Gerando…' : 'Baixar PDF'}
          </Button>
        </DialogHeader>

        <div ref={ref} style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", color: BRAND, background: '#e5e5e5' }}>
          <section style={sheet}>
            {/* Header Empresa */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: 10, marginBottom: 15 }}>
              {company?.logo_url ? (
                <img src={company.logo_url} alt={company?.name || 'Logo'} crossOrigin="anonymous" style={{ maxHeight: 36, maxWidth: 180, objectFit: 'contain' }} />
              ) : (
                <div style={{ fontWeight: 700, fontSize: 14, color: BRAND }}>{company?.name || ''}</div>
              )}
              <div style={{ textAlign: 'right', fontSize: 9, color: '#444', lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700, fontSize: 11, color: BRAND }}>{(company?.name || '').toUpperCase()}</div>
                {company?.address && <div>{company.address}</div>}
                {company?.cnpj && <div>CNPJ: {company.cnpj}</div>}
                {company?.email && <div>{company.email}</div>}
                {company?.phone && <div>{company.phone}</div>}
              </div>
            </div>

            {/* Header Prestação */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: BRAND, color: '#fff', padding: '10px 15px', borderRadius: 4, marginBottom: 15 }}>
              <div style={{ fontSize: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>PRESTAÇÃO DE CONTAS — NUMERÁRIO</div>
                <div>{quote?.quote_number || '---'}</div>
                <div style={{ opacity: 0.8 }}>DATA: {new Date().toLocaleDateString('pt-BR')}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 10 }}>
                <div style={{ fontWeight: 700 }}>CLIENTE: {client?.name || '---'}</div>
                <div>CNPJ: {client?.tax_id || '---'}</div>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 15 }}>
              <thead>
                <tr>
                  <th style={{ ...th, background: BRAND, color: '#fff' }}>DESCRIÇÃO</th>
                  <th style={{ ...th, background: BRAND, color: '#fff', textAlign: 'right' }}>ORÇADO (R$)</th>
                  <th style={{ ...th, background: BRAND, color: '#fff', textAlign: 'right' }}>PAGO REAL (R$)</th>
                  <th style={{ ...th, background: BRAND, color: '#fff', textAlign: 'right' }}>DIFERENÇA (R$)</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const pago = item.valor_pago_brl ?? item.valor_orcado_brl;
                  const diff = Number(pago) - Number(item.valor_orcado_brl);
                  return (
                    <tr key={item.id}>
                      <td style={td}>[{categoriaLabels[item.categoria] || item.categoria}] {item.descricao}</td>
                      <td style={tdR}>{fmtBRL(item.valor_orcado_brl)}</td>
                      <td style={tdR}>{fmtBRL(pago)}</td>
                      <td style={{ ...tdR, color: diff > 0 ? '#b91c1c' : diff < 0 ? '#047857' : undefined }}>
                        {diff > 0 ? '+' : ''}{fmtBRL(diff)}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ background: '#f5f5f5', fontWeight: 700 }}>
                  <td style={td}>TOTAL</td>
                  <td style={tdR}>{fmtBRL(totalOrcado)}</td>
                  <td style={tdR}>{fmtBRL(totalPago)}</td>
                  <td style={{ ...tdR, color: diferenca > 0 ? '#b91c1c' : diferenca < 0 ? '#047857' : undefined }}>
                    {diferenca > 0 ? '+' : ''}{fmtBRL(diferenca)}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ border: `2px solid ${BRAND}`, marginBottom: 10 }}>
              <div style={{ background: BRAND, color: '#fff', padding: '4px 12px', fontSize: 10, fontWeight: 700 }}>
                RESULTADO DA PRESTAÇÃO DE CONTAS
              </div>
              <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: BRAND }}>
                  {diferenca > 0 ? 'ADICIONAL A COBRAR DO CLIENTE' : diferenca < 0 ? 'SALDO A DEVOLVER AO CLIENTE' : 'SEM DIFERENÇA — VALORES CONFEREM'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: BRAND }}>R$ {fmtBRL(Math.abs(diferenca))}</div>
              </div>
            </div>

            <div style={{ fontSize: 8, color: '#888', fontStyle: 'italic' }}>
              Valores orçados conforme Numerário aprovado em {new Date(accountability.created_at).toLocaleDateString('pt-BR')}. Câmbio de referência: R$ {(accountability.usd_brl || 0).toLocaleString('pt-BR', { minimumFractionDigits: 4 })}.
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
