export const ESTIMATE_LABELS = {
  vmcv: {
    short: 'Valor da mercadoria',
    sigla: 'VMCV',
    tooltip: 'FOB/EXW — preço pago ao fornecedor (VMCV)',
  },
  vmle: {
    short: 'Valor no embarque',
    sigla: 'VMLE',
    tooltip: 'Mercadoria + acréscimos − deduções (VMLE)',
  },
  vmld: {
    short: 'Valor desembaraçado',
    sigla: 'VMLD',
    tooltip: 'Valor no embarque + frete + seguro · base do II (VMLD)',
  },
} as const;

export type EstimateLabelKey = keyof typeof ESTIMATE_LABELS;