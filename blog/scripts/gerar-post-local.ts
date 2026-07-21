/**
 * Testa a geração de um post localmente, sem precisar do servidor Next rodando.
 * Uso: npm run gerar-post   (precisa de ANTHROPIC_API_KEY no .env.local;
 * UNSPLASH_ACCESS_KEY é opcional, sem ela o post sai sem imagem de capa)
 */
import 'dotenv/config';
import { runGeneration } from '../lib/gerarPost';

async function main() {
  const result = await runGeneration({ generatedBy: 'auto', skipIfAutoExists: false });

  if ('skipped' in result && result.skipped) {
    console.log(`Pulado: ${result.reason}`);
    return;
  }

  if ('ok' in result && result.ok) {
    console.log(`\nPost gerado: content/posts/${result.filename}`);
    console.log(`Título: ${result.post.title}`);
    console.log(`Pilar: ${result.post.pillar}`);
    console.log(`Fonte: ${result.post.source_url}`);
    console.log(`Tempo de leitura: ${result.post.reading_time} min`);
    console.log(`Imagem de capa: ${result.post.cover_image ?? '(nenhuma — configure UNSPLASH_ACCESS_KEY)'}`);
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
