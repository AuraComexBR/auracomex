import { NextResponse } from 'next/server';
import { getAllPosts } from '@/lib/posts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const posts = getAllPosts().map((p) => ({
    title: p.title,
    slug: p.slug,
    pillar: p.pillar,
    status: p.status,
    date: p.date,
    excerpt: p.excerpt,
    source_url: p.source_url,
    generated_by: p.generated_by,
    cover_image: p.cover_image,
    reading_time: p.reading_time,
  }));
  return NextResponse.json({ posts });
}
