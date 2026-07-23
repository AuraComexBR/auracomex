// URLs de rastreio por transportadora courier — usado tanto no formulário de
// Logística (aba do embarque) quanto na lista de Embarques, pra permitir
// abrir o rastreio direto sem precisar entrar no processo.
const COURIER_TRACKING_URLS: Record<string, (n: string) => string> = {
  DHL: (n) => `https://www.dhl.com/br-pt/home/tracking.html?tracking-id=${encodeURIComponent(n)}&submit=1`,
  FEDEX: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  UPS: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  TNT: (n) => `https://www.tnt.com/express/pt_br/site/shipping-tools/tracking.html?searchType=con&cons=${encodeURIComponent(n)}`,
};

export function getCourierTrackingUrl(provider?: string | null, trackingNumber?: string | null): string | null {
  if (!provider || !trackingNumber) return null;
  const builder = COURIER_TRACKING_URLS[provider];
  return builder ? builder(trackingNumber.trim()) : null;
}
