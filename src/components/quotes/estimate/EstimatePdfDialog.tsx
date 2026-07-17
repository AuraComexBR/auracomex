import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { EstimateRow, EstimateItemRow, EstimateExpenseRow } from '@/hooks/useCostEstimate';
import { EstimateBreakdown, calcEstimativa, pct } from '@/lib/costEstimate';

interface Props {
  open: boolean;
  onClose: () => void;
  quote: any;
  estimate: EstimateRow;
  items: EstimateItemRow[];
  expenses: EstimateExpenseRow[];
  breakdown: EstimateBreakdown | null;
  hasInsurance?: boolean;
}

const fmtUSD = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const th: React.CSSProperties = { background: '#f0f0f0', fontSize: 10, fontWeight: 700, padding: '5px 8px', borderBottom: '1px solid #ccc', textAlign: 'left' };
const td: React.CSSProperties = { fontSize: 10, padding: '4px 8px', borderBottom: '1px solid #eee' };
const tdR: React.CSSProperties = { ...td, textAlign: 'right', fontFamily: 'monospace' };

const sheet: React.CSSProperties = {
  width: '210mm',
  minHeight: '297mm',
  padding: '12mm 14mm',
  boxSizing: 'border-box',
  pageBreakAfter: 'always',
  breakAfter: 'page',
  background: '#fff',
  position: 'relative',
};
const sheetLast: React.CSSProperties = { ...sheet, pageBreakAfter: 'auto', breakAfter: 'auto' };
const avoidBreak: React.CSSProperties = { pageBreakInside: 'avoid', breakInside: 'avoid' };

export function EstimatePdfDialog({ open, onClose, quote, estimate, items, expenses, breakdown, hasInsurance = true }: Props) {
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

  if (!open || !breakdown) return null;

  const rate = estimate.usd_brl || 0;
  const totalUsd = breakdown.total_usd;
  const totalPeso = items.reduce((s, i) => s + Number(i.peso) * Number(i.quantidade), 0);
  const totalQtd = items.reduce((s, i) => s + Number(i.quantidade), 0);

  async function handleDownload() {
    if (!ref.current) return;
    setDownloading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const filename = `estimativa_${quote?.quote_number || estimate.id.slice(0, 8)}.pdf`;
      const blob: Blob = await html2pdf().set({
        margin: 0,
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: '.pdf-avoid-break' },
      } as any).from(ref.current).outputPdf('blob');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);

      try {
        const path = `${quote.company_id}/${quote.id}/${Date.now()}_${filename}`;
        const up = await supabase.storage.from('shipment-documents').upload(path, blob, { contentType: 'application/pdf' });
        if (!up.error) {
          const { data: { publicUrl } } = supabase.storage.from('shipment-documents').getPublicUrl(path);
          await supabase.from('documents').insert({
            quote_id: quote.id, shipment_id: quote.shipment_id || null,
            company_id: quote.company_id, name: filename, file_url: publicUrl,
            file_size: blob.size, document_type: 'other' as any,
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

  const rows: Array<[string, number, boolean, boolean, boolean]> = (() => {
    const list: Array<[string, number, boolean, boolean, boolean]> = [
      ['Valor da mercadoria (VMCV)', breakdown.vmcv_usd, true, false, true],
    ];

    // Origem
    expenses.filter(e => e.category === 'origin').forEach(e => {
      list.push([e.descricao, (e.valor_brl || 0) / rate, false, false, true]);
    });

    list.push(['Valor no embarque (VMLE)', breakdown.vmle_usd, true, false, true]);

    // Frete/Seguro
    expenses.filter(e => e.category === 'freight').forEach(e => {
      list.push([e.descricao, (e.valor_brl || 0) / rate, false, false, true]);
    });

    list.push(
      ['Valor desembaraçado (VMLD)', breakdown.vmld_usd, true, false, true],
      ['I.I.', breakdown.ii_usd, false, false, true],
      ['I.P.I.', breakdown.ipi_usd, false, false, true],
      ['P.I.S.', breakdown.pis_usd, false, false, true],
      ['COFINS', breakdown.cofins_usd, false, false, true],
      ['I.C.M.S.', breakdown.icms_usd, false, false, true],
      ['SUBTOTAL', breakdown.subtotal_usd, true, false, true]
    );

    // Nacionais
    expenses.filter(e => e.category === 'destination' || e.category === 'local' || !e.category).forEach(e => {
      list.push([e.descricao, (e.valor_brl || 0) / rate, false, false, true]);
    });

    list.push(['TOTAL', breakdown.total_usd, true, false, true]);
    return list;
  })();

  const BRAND = (company as any)?.brand_primary_color || '#1a1a2e';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Estimativa de Custo</DialogTitle>
          <Button onClick={handleDownload} disabled={downloading} size="sm">
            <Download className="w-4 h-4 mr-2" /> {downloading ? 'Gerando…' : 'Baixar PDF'}
          </Button>
        </DialogHeader>

        <div ref={ref} style={{ fontFamily: "'Segoe UI', system-ui, sans-serif", color: BRAND, background: '#e5e5e5' }}>
        {/* ============= FOLHA 1: Resumo ============= */}
        <section className="pdf-avoid-break" style={items.length === 0 && expenses.length <= 12 ? sheetLast : sheet}>
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

          {/* Header Estimativa */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: BRAND, color: '#fff', padding: '10px 15px', borderRadius: 4, marginBottom: 15 }}>
            <div style={{ fontSize: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>ESTIMATIVA DE CUSTOS DE IMPORTAÇÃO</div>
              <div>{quote?.quote_number || '---'}</div>
              <div style={{ opacity: 0.8 }}>DATA: {new Date().toLocaleDateString('pt-BR')}</div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10 }}>
              <div style={{ fontWeight: 700 }}>CLIENTE: {client?.name || '---'}</div>
              <div>CNPJ: {client?.tax_id || '---'}</div>
            </div>
          </div>

          {/* Resumo Consolidado (Primeira Folha) */}
          <div style={{ fontWeight: 700, fontSize: 11, margin: '15px 0 8px', textTransform: 'uppercase', color: BRAND, borderLeft: `4px solid ${BRAND}`, paddingLeft: 8 }}>Resumo da Estimativa</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 15 }}>
            <div style={{ fontSize: 9 }}>
              <div style={{ padding: '4px 0', borderBottom: '1px solid #eee' }}><strong>INCOTERM:</strong> {estimate.incoterm || '-'}</div>
              <div style={{ padding: '4px 0', borderBottom: '1px solid #eee' }}><strong>FREQUÊNCIA:</strong> {estimate.frequencia || '-'}</div>
              <div style={{ padding: '4px 0', borderBottom: '1px solid #eee' }}><strong>TRÂNSITO:</strong> {estimate.transito || '-'}</div>
              <div style={{ padding: '4px 0', borderBottom: '1px solid #eee' }}><strong>CARRIER:</strong> {estimate.carrier || '-'}</div>
            </div>
            <div style={{ fontSize: 9 }}>
              <div style={{ padding: '4px 0', borderBottom: '1px solid #eee' }}><strong>ORIGEM:</strong> {estimate.rota_origem || '-'}</div>
              <div style={{ padding: '4px 0', borderBottom: '1px solid #eee' }}><strong>DESTINO:</strong> {estimate.rota_destino || '-'}</div>
              <div style={{ padding: '4px 0', borderBottom: '1px solid #eee' }}><strong>PESO TOTAL:</strong> {fmtUSD(totalPeso)} kg</div>
              <div style={{ padding: '4px 0', borderBottom: '1px solid #eee' }}><strong>TAXA CAMBIAL:</strong> R$ {fmtBRL(rate)}</div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
            <thead>
              <tr>
                <th style={{ ...th, background: BRAND, color: '#fff' }}>DESCRIÇÃO DOS CUSTOS</th>
                <th style={{ ...th, background: BRAND, color: '#fff', textAlign: 'right' }}>VALOR US$</th>
                <th style={{ ...th, background: BRAND, color: '#fff', textAlign: 'right' }}>VALOR R$</th>
                <th style={{ ...th, background: BRAND, color: '#fff', textAlign: 'right' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, val, bold, notContracted, showPct]) => (
                <tr key={label} style={bold ? { background: '#f5f5f5', fontWeight: 700 } : {}}>
                  <td style={td}>{label}</td>
                  {notContracted ? (
                    <>
                      <td colSpan={2} style={{ ...tdR, fontStyle: 'italic', color: '#888' }}>Seguro não contratado</td>
                      <td style={tdR}>—</td>
                    </>
                  ) : (
                    <>
                      <td style={tdR}>{fmtUSD(val)}</td>
                      <td style={tdR}>{fmtBRL(val * rate)}</td>
                      <td style={tdR}>{showPct && Math.abs(val) > 0 ? pct(val, totalUsd).toFixed(2) : '—'}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {expenses.length > 0 && expenses.length <= 12 && (
            <div className="pdf-avoid-break" style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 10, marginBottom: 6, color: BRAND }}>DETALHAMENTO DE DESPESAS NACIONAIS / ADUANEIRAS</div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, fontSize: 8 }}>DESCRIÇÃO</th>
                    <th style={{ ...th, fontSize: 8, textAlign: 'right' }}>VALOR R$</th>
                    <th style={{ ...th, fontSize: 8, textAlign: 'center' }}>TIPO</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(e => (
                    <tr key={e.id}>
                      <td style={{ ...td, fontSize: 8 }}>{e.descricao}</td>
                      <td style={{ ...tdR, fontSize: 8 }}>{fmtBRL(Number(e.valor_brl))}</td>
                      <td style={{ ...td, fontSize: 8, textAlign: 'center' }}>{e.aduaneira ? 'ADUANEIRA' : 'LOCAL'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ============= FOLHA 2 (opcional): Despesas nacionais longas ============= */}
        {expenses.length > 12 && (
          <section className="pdf-avoid-break" style={items.length === 0 ? sheetLast : sheet}>
            <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 8, color: BRAND, borderLeft: `4px solid ${BRAND}`, paddingLeft: 8, textTransform: 'uppercase' }}>
              Detalhamento de Despesas Nacionais / Aduaneiras
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, fontSize: 9 }}>DESCRIÇÃO</th>
                  <th style={{ ...th, fontSize: 9, textAlign: 'right' }}>VALOR R$</th>
                  <th style={{ ...th, fontSize: 9, textAlign: 'center' }}>TIPO</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td style={{ ...td, fontSize: 9 }}>{e.descricao}</td>
                    <td style={{ ...tdR, fontSize: 9 }}>{fmtBRL(Number(e.valor_brl))}</td>
                    <td style={{ ...td, fontSize: 9, textAlign: 'center' }}>{e.aduaneira ? 'ADUANEIRA' : 'LOCAL'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ============= 1 FOLHA POR ITEM ============= */}
        {items.map((item, idx) => {
            const b = breakdown.itemBreakdowns[idx];
            if (!b) return null;
            const itemRows: Array<[string, number, boolean?]> = [
              ['Valor da mercadoria (VMCV)', b.vmcv_usd, true],
              ['Custos de Origem', (estimate.acrescimos_usd || 0) * (b.vmcv_usd / (breakdown.vmcv_usd || 1)), false],
              ['Valor no embarque (VMLE)', b.vmle_usd, true],
              ['Frete Internacional', b.frete_usd, false],
              ['Seguro Internacional', b.seguro_usd, false],
              ['Valor desembaraçado (VMLD)', b.vmld_usd, true],
              ['I.I.', b.ii_usd, false],
              ['I.P.I.', b.ipi_usd, false],
              ['P.I.S.', b.pis_usd, false],
              ['COFINS', b.cofins_usd, false],
              ['I.C.M.S.', b.icms_usd, false],
              ['Despesas Nacionais (*)', b.despesas_usd, false],
              ['Total', b.total_usd, true],
            ];
            const custoUnitUsd = Number(item.quantidade) ? b.total_usd / Number(item.quantidade) : 0;
            const isLast = idx === items.length - 1;
            return (
              <section key={item.id} className="pdf-avoid-break" style={isLast ? sheetLast : sheet}>
                {/* Mini-header por item */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: 6, marginBottom: 10 }}>
                  {company?.logo_url ? (
                    <img src={company.logo_url} alt="" crossOrigin="anonymous" style={{ maxHeight: 22, maxWidth: 120, objectFit: 'contain' }} />
                  ) : (
                    <div style={{ fontWeight: 700, fontSize: 10 }}>{company?.name || ''}</div>
                  )}
                  <div style={{ fontSize: 9, color: '#555' }}>
                    <strong>{quote?.quote_number || ''}</strong> · Item {idx + 1} de {items.length}
                  </div>
                </div>

                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>Item {idx + 1} {item.ncm ? `- ${item.ncm}` : ''}</div>
                <div style={{ fontSize: 10, color: '#555', marginBottom: 8 }}>{item.nome}</div>
                <div style={{ fontSize: 9, color: '#555', marginBottom: 6 }}>
                  Destinação: <strong>{
                    ((item as any).destinacao
                      ?? ((item as any).ipi_na_base_icms === false ? 'revenda_industrializacao' : 'consumo_final')
                    ) === 'revenda_industrializacao'
                      ? 'Revenda / Industrialização (IPI fora da base do ICMS)'
                      : 'Consumo final (IPI integra a base do ICMS)'
                  }</strong>
                </div>

                <table className="pdf-avoid-break" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                  <tbody>
                    <tr><td style={td}>Peso</td><td style={tdR}>{fmtUSD(Number(item.peso))}</td>
                        <td style={td}>Quantidade</td><td style={tdR}>{item.quantidade}</td></tr>
                    <tr><td style={td}>Valor unit. mercadoria (US$)</td><td style={tdR}>{fmtUSD(Number(item.vmcv_unit_usd))}</td>
                        <td style={td}>Valor unit. mercadoria (R$)</td><td style={tdR}>{fmtBRL(Number(item.vmcv_unit_usd) * rate)}</td></tr>
                    <tr><td style={td}>Custo Unitário (US$)</td><td style={tdR}>{fmtUSD(custoUnitUsd)}</td>
                        <td style={td}>Custo Unitário (R$)</td><td style={tdR}>{fmtBRL(custoUnitUsd * rate)}</td></tr>
                  </tbody>
                </table>

                <div style={{ fontWeight: 700, fontSize: 10, margin: '6px 0 2px' }}>BASE DE CÁLCULO</div>
                <table className="pdf-avoid-break" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
                  <thead><tr><th style={th}></th><th style={{ ...th, textAlign: 'right' }}>Alíquota</th><th style={{ ...th, textAlign: 'right' }}>US$</th><th style={{ ...th, textAlign: 'right' }}>R$</th></tr></thead>
                  <tbody>
                    <tr><td style={td}>I.I.</td><td style={tdR}>{Number(item.aliq_ii).toFixed(2)}</td><td style={tdR}>{fmtUSD(b.vmld_usd)}</td><td style={tdR}>{fmtBRL(b.vmld_usd * rate)}</td></tr>
                    <tr><td style={td}>I.P.I.</td><td style={tdR}>{Number(item.aliq_ipi).toFixed(2)}</td><td style={tdR}>{fmtUSD(b.vmld_usd + b.ii_usd)}</td><td style={tdR}>{fmtBRL((b.vmld_usd + b.ii_usd) * rate)}</td></tr>
                    <tr><td style={td}>P.I.S.</td><td style={tdR}>{Number(item.aliq_pis).toFixed(2)}</td><td style={tdR}>{fmtUSD(b.vmld_usd)}</td><td style={tdR}>{fmtBRL(b.vmld_usd * rate)}</td></tr>
                    <tr><td style={td}>COFINS</td><td style={tdR}>{Number(item.aliq_cofins).toFixed(2)}</td><td style={tdR}>{fmtUSD(b.vmld_usd)}</td><td style={tdR}>{fmtBRL(b.vmld_usd * rate)}</td></tr>
                    <tr><td style={td}>I.C.M.S.</td><td style={tdR}>{Number(item.aliq_icms).toFixed(2)}</td><td style={tdR}>{fmtUSD(b.icms_usd + b.vmld_usd + b.ii_usd + b.ipi_usd + b.pis_usd + b.cofins_usd)}</td><td style={tdR}>-</td></tr>
                  </tbody>
                </table>

                <div style={{ fontWeight: 700, fontSize: 10, margin: '6px 0 2px' }}>CÁLCULO</div>
                <table className="pdf-avoid-break" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr><th style={th}></th><th style={{ ...th, textAlign: 'right' }}>US$</th><th style={{ ...th, textAlign: 'right' }}>R$</th><th style={{ ...th, textAlign: 'right' }}>%</th></tr></thead>
                  <tbody>
                    {itemRows.map(([label, val, bold]) => (
                      <tr key={label} style={bold ? { background: '#f5f5f5', fontWeight: 700 } : {}}>
                        <td style={td}>{label}</td>
                        <td style={tdR}>{fmtUSD(val)}</td>
                        <td style={tdR}>{fmtBRL(val * rate)}</td>
                        <td style={tdR}>{pct(val, totalUsd).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
        })}
        </div>
      </DialogContent>
    </Dialog>
  );
}