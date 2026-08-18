// Gera o PDF da ordem de coleta (documento próprio da Aura, entregue ao
// motorista — não é o certificado oficial do terminal). Reaproveita
// generatePdfFromElement (mesmo motor html2pdf.js usado no resto do app) e o
// bucket/insert padrão de `documents` (mesmo caminho da DocumentsTab).

import { generatePdfFromElement } from '@/lib/pdf-utils';
import { supabase } from '@/integrations/supabase/client';
import { DOCS_BUCKET } from '@/lib/storage';
import type { ColetaOrdemColeta, ColetaOrdemNotaFiscal, ColetaMotorista, ColetaVeiculo } from '@/hooks/useColeta';

interface ShipmentSummary {
  reference_number: string;
  container_number: string | null;
  master_bl: string | null;
  house_bl: string | null;
  duimp_number: string | null;
}

interface GerarDocumentoParams {
  companyId: string;
  companyName: string;
  shipmentId: string;
  ordem: ColetaOrdemColeta;
  notasFiscais: ColetaOrdemNotaFiscal[];
  motorista: ColetaMotorista | null;
  veiculo: ColetaVeiculo | null;
  shipment: ShipmentSummary;
  clientName: string; // importador (ex: Metropoly)
  uploadedBy: string | null;
}

function renderOrdemColetaHtml(p: GerarDocumentoParams): string {
  const dataAgendada = p.ordem.data_agendada ? new Date(p.ordem.data_agendada).toLocaleString('pt-BR') : '-';

  const notasFiscaisRows = p.notasFiscais
    .map(
      (nf) => `
      <tr>
        <td>${p.shipment.container_number ?? '-'}</td>
        <td>${nf.numero}</td>
        <td>${nf.serie ?? '-'}</td>
        <td>${nf.emissao ? new Date(nf.emissao).toLocaleDateString('pt-BR') : '-'}</td>
        <td>${nf.lote ?? '-'}</td>
      </tr>`
    )
    .join('');

  return `
  <div style="font-family: Arial, sans-serif; font-size: 12px; color: #0A0A0E; padding: 24px; width: 720px;">
    <div style="text-align:center; margin-bottom: 16px;">
      <div style="font-size: 16px; font-weight: bold;">ORDEM DE COLETA</div>
      <div style="font-size: 13px;">Nº ${p.ordem.numero_documento ?? '-'}</div>
      <div style="font-size: 11px; color:#555;">Emitido por ${p.companyName}</div>
    </div>

    <table style="width:100%; border-collapse: collapse; margin-bottom: 8px;">
      <tr><td style="background:#0D1E30; color:#fff; padding:4px 8px; font-weight:bold;">IMPORTADOR</td></tr>
      <tr><td style="border:1px solid #ccc; padding:6px 8px;">${p.clientName}</td></tr>
    </table>

    <div style="font-weight:bold; margin: 10px 0 4px;">Dados do Transporte</div>
    <table style="width:100%; border-collapse: collapse; text-align:center;">
      <tr style="background:#f0f0f0;">
        <th style="border:1px solid #ccc; padding:4px;">Motorista</th>
        <th style="border:1px solid #ccc; padding:4px;">CNH</th>
        <th style="border:1px solid #ccc; padding:4px;">RG</th>
        <th style="border:1px solid #ccc; padding:4px;">Placa Cavalo</th>
        <th style="border:1px solid #ccc; padding:4px;">Placa Carreta</th>
      </tr>
      <tr>
        <td style="border:1px solid #ccc; padding:4px;">${p.motorista?.nome ?? '-'}</td>
        <td style="border:1px solid #ccc; padding:4px;">${p.motorista?.cnh ?? '-'}</td>
        <td style="border:1px solid #ccc; padding:4px;">${p.motorista?.rg ?? '-'}</td>
        <td style="border:1px solid #ccc; padding:4px;">${p.veiculo?.placa_cavalo ?? '-'}</td>
        <td style="border:1px solid #ccc; padding:4px;">${p.veiculo?.placa_carreta ?? '-'}</td>
      </tr>
    </table>

    <div style="font-weight:bold; margin: 10px 0 4px;">Dados do Embarque</div>
    <table style="width:100%; border-collapse: collapse; text-align:center;">
      <tr style="background:#f0f0f0;">
        <th style="border:1px solid #ccc; padding:4px;">Referência</th>
        <th style="border:1px solid #ccc; padding:4px;">Contêiner</th>
        <th style="border:1px solid #ccc; padding:4px;">BL</th>
        <th style="border:1px solid #ccc; padding:4px;">DUIMP</th>
        <th style="border:1px solid #ccc; padding:4px;">Peso Bruto Apurado</th>
      </tr>
      <tr>
        <td style="border:1px solid #ccc; padding:4px;">${p.shipment.reference_number}</td>
        <td style="border:1px solid #ccc; padding:4px;">${p.shipment.container_number ?? '-'}</td>
        <td style="border:1px solid #ccc; padding:4px;">${p.shipment.master_bl ?? p.shipment.house_bl ?? '-'}</td>
        <td style="border:1px solid #ccc; padding:4px;">${p.shipment.duimp_number ?? '-'}</td>
        <td style="border:1px solid #ccc; padding:4px;">${p.ordem.peso_bruto_apurado ?? '-'}</td>
      </tr>
    </table>

    <div style="font-weight:bold; margin: 10px 0 4px;">Agendamento</div>
    <table style="width:100%; border-collapse: collapse; text-align:center;">
      <tr style="background:#f0f0f0;">
        <th style="border:1px solid #ccc; padding:4px;">Terminal</th>
        <th style="border:1px solid #ccc; padding:4px;">Pátio</th>
        <th style="border:1px solid #ccc; padding:4px;">Data/Hora</th>
      </tr>
      <tr>
        <td style="border:1px solid #ccc; padding:4px;">${p.ordem.terminal ?? '-'}</td>
        <td style="border:1px solid #ccc; padding:4px;">${p.ordem.patio ?? '-'}</td>
        <td style="border:1px solid #ccc; padding:4px;">${dataAgendada}</td>
      </tr>
    </table>

    <div style="font-weight:bold; margin: 10px 0 4px;">Dados dos Lacres</div>
    <table style="width:100%; border-collapse: collapse; text-align:center;">
      <tr style="background:#f0f0f0;">
        <th style="border:1px solid #ccc; padding:4px;">Encontrado</th>
        <th style="border:1px solid #ccc; padding:4px;">Adicional</th>
        <th style="border:1px solid #ccc; padding:4px;">IPA</th>
        <th style="border:1px solid #ccc; padding:4px;">Termo de Avaria</th>
      </tr>
      <tr>
        <td style="border:1px solid #ccc; padding:4px;">${p.ordem.lacre_encontrado ?? '-'}</td>
        <td style="border:1px solid #ccc; padding:4px;">${p.ordem.lacre_adicional ?? '-'}</td>
        <td style="border:1px solid #ccc; padding:4px;">${p.ordem.lacre_ipa ?? '-'}</td>
        <td style="border:1px solid #ccc; padding:4px;">${p.ordem.termo_avaria ?? '-'}</td>
      </tr>
    </table>

    ${
      p.notasFiscais.length > 0
        ? `
    <div style="font-weight:bold; margin: 10px 0 4px;">Notas Fiscais</div>
    <table style="width:100%; border-collapse: collapse; text-align:center;">
      <tr style="background:#f0f0f0;">
        <th style="border:1px solid #ccc; padding:4px;">Contêiner</th>
        <th style="border:1px solid #ccc; padding:4px;">Nota Fiscal</th>
        <th style="border:1px solid #ccc; padding:4px;">Série</th>
        <th style="border:1px solid #ccc; padding:4px;">Emissão</th>
        <th style="border:1px solid #ccc; padding:4px;">Lote</th>
      </tr>
      ${notasFiscaisRows}
    </table>`
        : ''
    }

    <div style="margin-top: 24px; font-size: 11px; color:#555;">
      Documento gerado automaticamente pela Aura Comex em ${new Date().toLocaleString('pt-BR')}.
      Este documento não substitui a autorização/agendamento oficial do terminal, apenas acompanha
      o motorista com os dados da coleta.
    </div>
  </div>`;
}

export async function gerarDocumentoOrdemColeta(
  p: GerarDocumentoParams
): Promise<{ documentId: string; path: string }> {
  const html = renderOrdemColetaHtml(p);

  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  try {
    const filename = `${p.ordem.numero_documento ?? 'ordem-de-coleta'}.pdf`;
    const pdfBlob = await generatePdfFromElement(container, filename, { download: false });

    const path = `${p.companyId}/${p.shipmentId}/${Date.now()}_${filename}`;
    const { error: uploadError } = await supabase.storage.from(DOCS_BUCKET).upload(path, pdfBlob, {
      contentType: 'application/pdf',
    });
    if (uploadError) throw uploadError;

    const { data: docRow, error: docError } = await (supabase
      .from('documents')
      .insert({
        shipment_id: p.shipmentId,
        company_id: p.companyId,
        document_type: 'ordem_coleta',
        name: filename,
        file_url: path,
        uploaded_by: p.uploadedBy,
      } as any)
      .select('id')
      .single() as any);
    if (docError) throw docError;

    const { error: updateError } = await (supabase
      .from('coleta_ordens_coleta' as any)
      .update({ document_id: docRow.id } as any)
      .eq('id', p.ordem.id) as any);
    if (updateError) throw updateError;

    return { documentId: docRow.id, path };
  } finally {
    document.body.removeChild(container);
  }
}
