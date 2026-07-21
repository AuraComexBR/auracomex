import type { MetadataRoute } from 'next';
import { getPublishedPosts } from '@/lib/posts';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://auracomex.app/blog';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPublishedPosts();

  return [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    ...posts.map((post) => ({
      url: `${SITE_URL}/${post.slug}`,
      lastModified: post.date,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
