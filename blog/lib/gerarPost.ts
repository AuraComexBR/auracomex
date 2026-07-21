import { generatePost } from './anthropic';
import { fetchCoverImage } from './unsplash';
import {
  computeReadingTime,
  getPostsFromToday,
  savePost,
  slugify,
  type PostFrontMatter,
} from './posts';

/**
 * Lógica compartilhada de geração de post — usada pelo cron (/api/gerar-post),
 * pela área de gestão (/api/admin/gerar) e pelo script local (scripts/gerar-post-local.ts).
 */
export async function runGeneration(opts?: {
  generatedBy?: 'auto' | 'manual';
  skipIfAutoExists?: boolean;
}) {
  const generatedBy = opts?.generatedBy ?? 'auto';
  const todayPosts = getPostsFromToday();

  if (opts?.skipIfAutoExists && todayPosts.some((p) => p.generated_by === 'auto')) {
    return { skipped: true as const, reason: 'já existe post automático gerado hoje' };
  }

  const ctaUrl = process.env.NEXT_PUBLIC_AURA_CTA_URL ?? 'https://auracomex.app';
  const ctaText =
    process.env.NEXT_PUBLIC_AURA_CTA_TEXT ?? 'Teste o Aura Comex gratuitamente';

  const generated = await generatePost({
    avoidTopics: todayPosts.map((p) => `${p.title} — ${p.excerpt}`),
    ctaUrl,
    ctaText,
  });

  const cover = await fetchCoverImage(generated.image_query || generated.title);

  const frontMatter: PostFrontMatter = {
    title: generated.title,
    date: new Date().toISOString(),
    slug: slugify(generated.title),
    pillar: generated.pillar,
    excerpt: generated.excerpt,
    status: 'draft',
    source_url: generated.source_url,
    generated_by: generatedBy,
    reading_time: computeReadingTime(generated.content),
    ...(cover
      ? {
          cover_image: cover.url,
          cover_image_alt: cover.alt,
          cover_credit_name: cover.photographer_name,
          cover_credit_url: cover.photographer_url,
        }
      : {}),
  };

  const filename = savePost(frontMatter, generated.content);

  return { ok: true as const, filename, post: frontMatter };
}
