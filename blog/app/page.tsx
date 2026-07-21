import Link from 'next/link';
import { getPublishedPosts, PILLARS, type Pillar } from '@/lib/posts';
import { PILLAR_LABELS } from '@/lib/pillars';
import PostCard from '@/components/PostCard';

const POSTS_PER_PAGE = 9;

function isPillar(value: string | undefined): value is Pillar {
  return !!value && (PILLARS as readonly string[]).includes(value);
}

export default function BlogIndexPage({
  searchParams,
}: {
  searchParams: { pilar?: string; page?: string };
}) {
  const allPosts = getPublishedPosts();

  const activePillar = isPillar(searchParams.pilar) ? searchParams.pilar : undefined;
  const filtered = activePillar ? allPosts.filter((p) => p.pillar === activePillar) : allPosts;

  const currentPage = Math.max(1, Number(searchParams.page) || 1);
  const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE));
  const pageStart = (currentPage - 1) * POSTS_PER_PAGE;
  const pagePosts = filtered.slice(pageStart, pageStart + POSTS_PER_PAGE);

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (activePillar) params.set('pilar', activePillar);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `/?${qs}` : '/';
  }

  return (
    <main className="container">
      <div className="blog-hero">
        <h1>Blog Aura Comex</h1>
        <p>
          Notícias e análises pra agentes de carga que querem manter o cliente
          informado e entregar um serviço de excelência.
        </p>
      </div>

      <div className="pillar-filter">
        <Link href="/" className={!activePillar ? 'active' : ''}>
          Todos
        </Link>
        {PILLARS.map((pillar) => (
          <Link
            key={pillar}
            href={`/?pilar=${pillar}`}
            className={activePillar === pillar ? 'active' : ''}
          >
            {PILLAR_LABELS[pillar]}
          </Link>
        ))}
      </div>

      {pagePosts.length === 0 ? (
        <p className="empty-state">Nenhum post publicado ainda nesse pilar.</p>
      ) : (
        <div className="post-grid">
          {pagePosts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) =>
            page === currentPage ? (
              <span key={page} className="current">
                {page}
              </span>
            ) : (
              <Link key={page} href={pageHref(page)}>
                {page}
              </Link>
            ),
          )}
        </div>
      )}
    </main>
  );
}
