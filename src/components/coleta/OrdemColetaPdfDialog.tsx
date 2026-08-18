// Preview + geração do PDF da Ordem de Coleta. Segue o mesmo padrão de
// ClientDebitNotePdfDialog/QuotePdfPreviewDialog: conteúdo React real
// (não HTML gerado por string) num <div ref> visível dentro de um Dialog
// aberto — é o jeito comprovado de funcionar com generatePdfFromElement
// (html2canvas). Um <div> fora da tela criado via innerHTML já causou PDF
// em branco; não reintroduzir esse padrão.

import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { generatePdfFromElement } from '@/lib/pdf-utils';
import { salvarDocumentoOrdemColeta } from '@/lib/gerarDocumentoOrdemColeta';
import type { ColetaOrdemColeta, ColetaOrdemNotaFiscal, ColetaMotorista, ColetaCavalo, ColetaCarreta } from '@/hooks/useColeta';

interface ShipmentSummary {
  reference_number: string;
  container_number: string | null;
  master_bl: string | null;
  house_bl: string | null;
  duimp_number: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  companyId: string;
  companyName: string;
  companyLogoUrl: string | null;
  shipmentId: string;
  ordem: ColetaOrdemColeta;
  notasFiscais: ColetaOrdemNotaFiscal[];
  motorista: ColetaMotorista;
  cavalo: ColetaCavalo;
  carreta: ColetaCarreta | null;
  shipment: ShipmentSummary;
  clientName: string;
  uploadedBy: string | null;
}

export function OrdemColetaPdfDialog({
  open,
  onClose,
  onSaved,
  companyId,
  companyName,
  companyLogoUrl,
  shipmentId,
  ordem,
  notasFiscais,
  motorista,
  cavalo,
  carreta,
  shipment,
  clientName,
  uploadedBy,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  const dataAgendada = ordem.data_agendada ? new Date(ordem.data_agendada).toLocaleString('pt-BR') : '-';
  const filename = `${ordem.numero_documento ?? 'ordem-de-coleta'}.pdf`;

  const th: React.CSSProperties = { border: '1px solid #ccc', padding: 4, background: '#f0f0f0' };
  const td: React.CSSProperties = { border: '1px solid #ccc', padding: 4 };

  async function handleGerar() {
    if (!ref.current) return;
    setSaving(true);
    try {
      let numeroDocumento = ordem.numero_documento;
      if (!numeroDocumento) {
        const { data: numero, error } = await supabase.rpc('next_oc_number' as any, { p_company_id: companyId } as any);
        if (error) throw error;
        numeroDocumento = numero as string;
        await (supabase.from('coleta_ordens_coleta' as any).update({ numero_documento: numeroDocumento } as any).eq('id', ordem.id) as any);
      }

      // Baixa direto no navegador do usuário (mesmo comportamento dos
      // outros PDFs do app) e devolve o blob pra também salvar no storage.
      const pdfBlob = await generatePdfFromElement(ref.current, filename);

      await salvarDocumentoOrdemColeta({
        pdfBlob,
        filename,
        companyId,
        shipmentId,
        ordemId: ordem.id,
        uploadedBy,
      });

      toast.success('Documento gerado e salvo');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Erro ao gerar documento', { description: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Ordem de Coleta {ordem.numero_documento ?? ''}</DialogTitle>
        </DialogHeader>

        <div style={{ background: '#fff', padding: 24 }}>
          <div
            ref={ref}
            style={{ width: 720, background: '#fff', color: '#0A0A0E', fontFamily: 'Arial, sans-serif', fontSize: 12, margin: '0 auto', padding: 24 }}
          >
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              {companyLogoUrl && (
                <img src={companyLogoUrl} alt="" crossOrigin="anonymous" style={{ maxHeight: 60, maxWidth: 220, marginBottom: 8 }} />
              )}
              <div style={{ fontSize: 16, fontWeight: 'bold' }}>ORDEM DE COLETA</div>
              <div style={{ fontSize: 13 }}>Nº {ordem.numero_documento ?? '-'}</div>
              <div style={{ fontSize: 11, color: '#555' }}>Emitido por {companyName}</div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
              <tbody>
                <tr><td style={{ background: '#0D1E30', color: '#fff', padding: '4px 8px', fontWeight: 'bold' }}>IMPORTADOR</td></tr>
                <tr><td style={{ border: '1px solid #ccc', padding: '6px 8px' }}>{clientName}</td></tr>
              </tbody>
            </table>

            <div style={{ fontWeight: 'bold', margin: '10px 0 4px' }}>Dados do Transporte</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <tbody>
                <tr>
                  <th style={th}>Motorista</th>
                  <th style={th}>CNH</th>
                  <th style={th}>RG</th>
                  <th style={th}>Placa Cavalo</th>
                  <th style={th}>Placa Carreta</th>
                </tr>
                <tr>
                  <td style={td}>{motorista.nome}</td>
                  <td style={td}>{motorista.cnh ?? '-'}</td>
                  <td style={td}>{motorista.rg ?? '-'}</td>
                  <td style={td}>{cavalo.placa}</td>
                  <td style={td}>{carreta?.placa ?? '-'}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ fontWeight: 'bold', margin: '10px 0 4px' }}>Dados do Embarque</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <tbody>
                <tr>
                  <th style={th}>Referência</th>
                  <th style={th}>Contêiner</th>
                  <th style={th}>BL</th>
                  <th style={th}>DUIMP</th>
                  <th style={th}>Peso Bruto Apurado</th>
                </tr>
                <tr>
                  <td style={td}>{shipment.reference_number}</td>
                  <td style={td}>{ordem.container_number ?? shipment.container_number ?? '-'}</td>
                  <td style={td}>{shipment.master_bl ?? shipment.house_bl ?? '-'}</td>
                  <td style={td}>{shipment.duimp_number ?? '-'}</td>
                  <td style={td}>{ordem.peso_bruto_apurado ?? '-'}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ fontWeight: 'bold', margin: '10px 0 4px' }}>Agendamento</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <tbody>
                <tr>
                  <th style={th}>Terminal</th>
                  <th style={th}>Pátio</th>
                  <th style={th}>Data/Hora</th>
                </tr>
                <tr>
                  <td style={td}>{ordem.terminal ?? '-'}</td>
                  <td style={td}>{ordem.patio ?? '-'}</td>
                  <td style={td}>{dataAgendada}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ fontWeight: 'bold', margin: '10px 0 4px' }}>Dados dos Lacres</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
              <tbody>
                <tr>
                  <th style={th}>Encontrado</th>
                  <th style={th}>Adicional</th>
                  <th style={th}>IPA</th>
                  <th style={th}>Termo de Avaria</th>
                </tr>
                <tr>
                  <td style={td}>{ordem.lacre_encontrado ?? '-'}</td>
                  <td style={td}>{ordem.lacre_adicional ?? '-'}</td>
                  <td style={td}>{ordem.lacre_ipa ?? '-'}</td>
                  <td style={td}>{ordem.termo_avaria ?? '-'}</td>
                </tr>
              </tbody>
            </table>

            {notasFiscais.length > 0 && (
              <>
                <div style={{ fontWeight: 'bold', margin: '10px 0 4px' }}>Notas Fiscais</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                  <tbody>
                    <tr>
                      <th style={th}>Contêiner</th>
                      <th style={th}>Nota Fiscal</th>
                      <th style={th}>Série</th>
                      <th style={th}>Emissão</th>
                      <th style={th}>Lote</th>
                    </tr>
                    {notasFiscais.map((nf, i) => (
                      <tr key={i}>
                        <td style={td}>{ordem.container_number ?? shipment.container_number ?? '-'}</td>
                        <td style={td}>{nf.numero}</td>
                        <td style={td}>{nf.serie ?? '-'}</td>
                        <td style={td}>{nf.emissao ? new Date(nf.emissao).toLocaleDateString('pt-BR') : '-'}</td>
                        <td style={td}>{nf.lote ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div style={{ marginTop: 24, fontSize: 11, color: '#555' }}>
              Documento gerado pela Aura Comex em {new Date().toLocaleString('pt-BR')}. Este documento não
              substitui a autorização/agendamento oficial do terminal, apenas acompanha o motorista com os
              dados da coleta.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Fechar</Button>
          <Button onClick={handleGerar} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
            Gerar e salvar documento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
