import { notFound } from 'next/navigation';
import Image from 'next/image';
import type { Metadata } from 'next';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getPostBySlug, getPublishedPosts } from '@/lib/posts';
import { PILLAR_LABELS } from '@/lib/pillars';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://auracomex.app/blog';

export function generateStaticParams() {
  return getPublishedPosts().map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post || post.status !== 'published') return {};

  const url = `${SITE_URL}/${post.slug}`;

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt,
      url,
      publishedTime: post.date,
      images: post.cover_image ? [{ url: post.cover_image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  };
}

export default function PostPage({ params }: { params: { slug: string } }) {
  const post = getPostBySlug(params.slug);

  if (!post || post.status !== 'published') {
    notFound();
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post!.title,
    description: post!.excerpt,
    datePublished: post!.date,
    image: post!.cover_image ? [post!.cover_image] : undefined,
    author: { '@type': 'Organization', name: 'Aura Comex' },
    publisher: { '@type': 'Organization', name: 'Aura Comex' },
    mainEntityOfPage: `${SITE_URL}/${post!.slug}`,
  };

  return (
    <main className="container">
      <article>
        <div className="post-header">
          <span className="pillar-badge">{PILLAR_LABELS[post!.pillar] ?? post!.pillar}</span>
          <h1>{post!.title}</h1>
          <div className="post-meta">
            <span>{new Date(post!.date).toLocaleDateString('pt-BR')}</span>
            {post!.reading_time ? <span>· {post!.reading_time} min de leitura</span> : null}
          </div>
        </div>

        {post!.cover_image && (
          <>
            <div className="post-cover">
              <Image
                src={post!.cover_image}
                alt={post!.cover_image_alt ?? post!.title}
                fill
                style={{ objectFit: 'cover' }}
                sizes="(max-width: 768px) 100vw, 720px"
                priority
              />
            </div>
            {post!.cover_credit_name && (
              <p className="post-cover-credit">
                Foto por{' '}
                <a href={post!.cover_credit_url} target="_blank" rel="noreferrer">
                  {post!.cover_credit_name}
                </a>{' '}
                no Unsplash
              </p>
            )}
          </>
        )}

        <div className="post-body">
          <MDXRemote source={post!.content} />
        </div>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}
