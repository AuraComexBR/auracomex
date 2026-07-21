import Link from 'next/link';

export default function Footer() {
  const ctaUrl = process.env.NEXT_PUBLIC_AURA_CTA_URL ?? 'https://auracomex.app';
  const ctaText =
    process.env.NEXT_PUBLIC_AURA_CTA_TEXT ??
    'Entregue um serviço de excelência aos seus clientes com o Aura Comex';

  return (
    <footer className="site-footer">
      <div className="container">
        <span>
          Aura Comex — visibilidade de embarque para agentes de carga que querem
          entregar excelência aos seus clientes.
          {' · '}
          <Link href="/feed.xml">RSS</Link>
        </span>
        <a className="footer-cta" href={ctaUrl}>
          {ctaText}
        </a>
      </div>
    </footer>
  );
}
