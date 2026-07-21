import type { Metadata } from 'next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://auracomex.app/blog';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Blog Aura Comex — para agentes de carga que querem entregar excelência',
    template: '%s | Blog Aura Comex',
  },
  description:
    'Notícias e análises sobre rastreamento de carga, burocracia do Siscomex e imprevistos na cadeia logística — pra agentes de carga que querem manter o cliente informado e no controle.',
  openGraph: {
    type: 'website',
    siteName: 'Blog Aura Comex',
    locale: 'pt_BR',
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
