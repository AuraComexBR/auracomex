/**
 * Aprova um post (draft -> published) editando o front-matter do arquivo .mdx.
 * Uso: npm run aprovar -- <slug>
 */
import { getAllPosts, setPostStatus } from '../lib/posts';

const slug = process.argv[2];

if (!slug) {
  console.error('Uso: npm run aprovar -- <slug>');
  process.exit(1);
}

const post = getAllPosts().find((p) => p.slug === slug);

if (!post) {
  console.error(`Post com slug "${slug}" não encontrado.`);
  process.exit(1);
}

setPostStatus(slug, 'published');

console.log(`Post "${post.title}" aprovado e marcado como published.`);
console.log('Faça commit + push para publicar no ar (ou use a área /admin).');
