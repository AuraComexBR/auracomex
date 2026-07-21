import Image from 'next/image';
import Link from 'next/link';
import type { Post } from '@/lib/posts';
import { PILLAR_LABELS } from '@/lib/pillars';

export default function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/${post.slug}`} className="post-card">
      <div className="post-card-image">
        {post.cover_image ? (
          <Image
            src={post.cover_image}
            alt={post.cover_image_alt ?? post.title}
            fill
            style={{ objectFit: 'cover' }}
            sizes="(max-width: 640px) 100vw, 33vw"
          />
        ) : null}
      </div>
      <div className="post-card-body">
        <span className="pillar-badge">{PILLAR_LABELS[post.pillar] ?? post.pillar}</span>
        <h2>{post.title}</h2>
        <p>{post.excerpt}</p>
        <div className="post-meta">
          <span>{new Date(post.date).toLocaleDateString('pt-BR')}</span>
          {post.reading_time ? <span>· {post.reading_time} min de leitura</span> : null}
        </div>
      </div>
    </Link>
  );
}
