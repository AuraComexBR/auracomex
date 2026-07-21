import Link from 'next/link';

export default function Header() {
  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="site-logo">
          Blog Aura Comex
        </Link>
        <nav>
          <a href={process.env.NEXT_PUBLIC_AURA_CTA_URL ?? 'https://auracomex.app'}>
            Aura Comex
          </a>
        </nav>
      </div>
    </header>
  );
}
