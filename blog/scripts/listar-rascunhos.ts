/**
 * Lista todos os posts em rascunho para revisão semanal.
 * Uso: npm run listar-rascunhos
 */
import { getDraftPosts } from '../lib/posts';

const drafts = getDraftPosts();

if (drafts.length === 0) {
  console.log('Nenhum rascunho pendente.');
  process.exit(0);
}

console.log(`${drafts.length} rascunho(s) pendente(s):\n`);

for (const post of drafts) {
  console.log(`- [${post.pillar}] ${post.title}`);
  console.log(`  arquivo: content/posts/${post.filename}`);
  console.log(`  data: ${post.date}`);
  console.log(`  fonte: ${post.source_url ?? 'manual'}`);
  console.log(`  aprovar com: npm run aprovar -- ${post.slug}\n`);
}
