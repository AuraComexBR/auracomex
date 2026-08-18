// Rótulos das categorias fixas de documento (document_type). Quando
// document_type = 'other', o nome de verdade vem de documents.custom_category
// (ver DocumentsTab.tsx) — os consumidores devem preferir custom_category
// quando presente e só cair neste mapa como fallback.
export const DOC_TYPE_LABELS: Record<string, string> = {
  bl: 'BL',
  invoice: 'Invoice',
  packing_list: 'Packing List',
  certificate_origin: 'Certificado de Origem',
  customs_declaration: 'Declaração Aduaneira',
  insurance: 'Seguro',
  dta: 'DTA',
  outros: 'Outros',
  other: 'Outro',
  debit_note_supplier: 'DN Fornecedor',
  ordem_coleta: 'Ordem de Coleta',
};
