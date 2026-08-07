// Rótulo do "Carrier" muda de acordo com o modal — o dado salvo é sempre o
// mesmo campo (carrier), só muda como ele é chamado na tela. Compartilhado
// entre a aba Logística (interna) e o tracking do cliente (público).
export const CARRIER_LABEL_BY_MODE: Record<string, string> = {
  ocean_fcl: 'Armador',
  ocean_lcl: 'Co-Loader',
  air: 'Cia Aérea',
  road: 'Transportadora',
  multimodal: 'Armador',
};
