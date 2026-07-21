'use client';

import { useEffect, useState } from 'react';
import { PILLAR_LABELS } from '@/lib/pillars';

interface AdminPost {
  title: string;
  slug: string;
  pillar: string;
  status: 'draft' | 'published';
  date: string;
  excerpt: string;
  source_url?: string;
  generated_by?: string;
  cover_image?: string;
  reading_time?: number;
}

// basePath (/blog, definido em next.config.js) não é adicionado automaticamente
// pelo fetch() — só pelo next/link. Por isso precisamos prefixar na mão aqui.
const API_BASE = '/blog/api/admin';

export default function AdminPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`${API_BASE}/posts`);
    const data = await res.json();
    setPosts(data.posts ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(slug: string, status: 'draft' | 'published') {
    setBusy(slug);
    await fetch(`${API_BASE}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, status }),
    });
    setBusy(null);
    await load();
  }

  async function gerarAgora() {
    setBusy('gerar');
    setMessage('Gerando post... isso leva alguns segundos (busca na web + escrita).');
    try {
      const res = await fetch(`${API_BASE}/gerar`, { method: 'POST' });
      const data = await res.json();
      if (data.error) {
        setMessage(`Erro: ${data.error}`);
      } else if (data.skipped) {
        setMessage(`Pulado: ${data.reason}`);
      } else {
        setMessage(`Post gerado: "${data.post?.title}" — revise abaixo e aprove se estiver bom.`);
      }
    } catch (err: any) {
      setMessage(`Erro: ${err.message}`);
    }
    setBusy(null);
    await load();
  }

  const drafts = posts.filter((p) => p.status === 'draft');
  const published = posts.filter((p) => p.status === 'published');

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'sans-serif' }}>
      <h1>Área de gestão — Blog Aura Comex</h1>

      <button
        onClick={gerarAgora}
        disabled={busy === 'gerar'}
        style={{
          padding: '0.6rem 1.2rem',
          marginBottom: '1rem',
          cursor: busy === 'gerar' ? 'not-allowed' : 'pointer',
        }}
      >
        {busy === 'gerar' ? 'Gerando...' : 'Gerar novo post agora'}
      </button>

      {message && (
        <p style={{ background: '#f0f0f0', padding: '0.75rem', borderRadius: 6 }}>{message}</p>
      )}

      {loading ? (
        <p>Carregando...</p>
      ) : (
        <>
          <h2>Rascunhos ({drafts.length})</h2>
          <PostTable posts={drafts} busy={busy} onApprove={(slug) => setStatus(slug, 'published')} />

          <h2 style={{ marginTop: '2rem' }}>Publicados ({published.length})</h2>
          <PostTable
            posts={published}
            busy={busy}
            onUnpublish={(slug) => setStatus(slug, 'draft')}
          />
        </>
      )}
    </main>
  );
}

function PostTable({
  posts,
  busy,
  onApprove,
  onUnpublish,
}: {
  posts: AdminPost[];
  busy: string | null;
  onApprove?: (slug: string) => void;
  onUnpublish?: (slug: string) => void;
}) {
  if (posts.length === 0) return <p>Nenhum post aqui.</p>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid #ccc' }}>
          <th style={{ padding: '0.5rem' }}>Capa</th>
          <th>Título</th>
          <th>Pilar</th>
          <th>Origem</th>
          <th>Data</th>
          <th>Fonte</th>
          <th>Ação</th>
        </tr>
      </thead>
      <tbody>
        {posts.map((post) => (
          <tr key={post.slug} style={{ borderBottom: '1px solid #eee' }}>
            <td style={{ padding: '0.5rem' }}>
              {post.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.cover_image}
                  alt=""
                  width={64}
                  height={40}
                  style={{ objectFit: 'cover', borderRadius: 4 }}
                />
              ) : (
                '—'
              )}
            </td>
            <td>{post.title}</td>
            <td>{PILLAR_LABELS[post.pillar as keyof typeof PILLAR_LABELS] ?? post.pillar}</td>
            <td>{post.generated_by === 'auto' ? 'Automático' : 'Manual'}</td>
            <td>{new Date(post.date).toLocaleDateString('pt-BR')}</td>
            <td>
              {post.source_url ? (
                <a href={post.source_url} target="_blank" rel="noreferrer">
                  link
                </a>
              ) : (
                '—'
              )}
            </td>
            <td>
              {onApprove && (
                <button disabled={busy === post.slug} onClick={() => onApprove(post.slug)}>
                  Aprovar
                </button>
              )}
              {onUnpublish && (
                <button disabled={busy === post.slug} onClick={() => onUnpublish(post.slug)}>
                  Despublicar
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
