import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export const PILLARS = [
  'rastreamento-visibilidade',
  'imprevistos-cadeia-logistica',
  'burocracia-prazos',
  'noticias-regulatorias',
] as const;

export type Pillar = (typeof PILLARS)[number];

export interface PostFrontMatter {
  title: string;
  date: string; // ISO date
  slug: string;
  pillar: Pillar;
  excerpt: string;
  status: 'draft' | 'published';
  source_url?: string;
  generated_by?: 'auto' | 'manual';
  reading_time?: number; // minutos
  cover_image?: string;
  cover_image_alt?: string;
  cover_credit_name?: string;
  cover_credit_url?: string;
}

export interface Post extends PostFrontMatter {
  content: string;
  filename: string;
}

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');

export function ensurePostsDir() {
  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }
}

export function getAllPosts(): Post[] {
  ensurePostsDir();
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.mdx'));

  return files
    .map((filename) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
      const { data, content } = matter(raw);
      return { ...(data as PostFrontMatter), content, filename };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPublishedPosts(): Post[] {
  return getAllPosts().filter((p) => p.status === 'published');
}

export function getDraftPosts(): Post[] {
  return getAllPosts().filter((p) => p.status === 'draft');
}

export function getPostBySlug(slug: string): Post | null {
  return getAllPosts().find((p) => p.slug === slug) ?? null;
}

/** Posts já gerados hoje (qualquer status) — usado para evitar duplicar assunto. */
export function getPostsFromToday(): Post[] {
  const today = new Date().toISOString().slice(0, 10);
  return getAllPosts().filter((p) => p.date.slice(0, 10) === today);
}

const WORDS_PER_MINUTE = 200;

export function computeReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function savePost(post: PostFrontMatter, content: string): string {
  ensurePostsDir();
  const filename = `${post.date.slice(0, 10)}-${post.slug}.mdx`;
  const fileContent = matter.stringify(content, post);
  fs.writeFileSync(path.join(POSTS_DIR, filename), fileContent, 'utf-8');
  return filename;
}

/** Muda o status de um post existente (draft <-> published). Usado pela área de gestão e pelo CLI. */
export function setPostStatus(slug: string, status: 'draft' | 'published') {
  const post = getAllPosts().find((p) => p.slug === slug);
  if (!post) {
    throw new Error(`Post "${slug}" não encontrado.`);
  }
  const filePath = path.join(POSTS_DIR, post.filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  data.status = status;
  fs.writeFileSync(filePath, matter.stringify(content, data), 'utf-8');
}
