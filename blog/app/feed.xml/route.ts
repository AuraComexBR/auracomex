import { NextResponse } from 'next/server';
import { getPublishedPosts } from '@/lib/posts';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://auracomex.app/blog';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const posts = getPublishedPosts();

  const items = posts
    .map(
      (post) => `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${SITE_URL}/${post.slug}</link>
      <guid>${SITE_URL}/${post.slug}</guid>
      <description>${escapeXml(post.excerpt)}</description>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
    </item>`,
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Blog Aura Comex</title>
    <link>${SITE_URL}</link>
    <description>Notícias e análises pra agentes de carga que querem entregar um serviço de excelência aos seus clientes.</description>
    <language>pt-BR</language>${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
