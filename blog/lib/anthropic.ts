import Anthropic from '@anthropic-ai/sdk';
import { PILLARS, type Pillar } from './posts';
import { PILLAR_LABELS } from './pillars';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface GeneratedPost {
  title: string;
  pillar: Pillar;
  excerpt: string;
  content: string; // corpo em markdown
  source_url: string;
  image_query: string; // termo de busca em inglês, pra achar a foto de capa no Unsplash
}

/**
 * Pede ao Claude para buscar uma notícia recente de comex/logística, conectá-la
 * a um dos 4 pilares e escrever um post original (nunca copiando o texto da fonte),
 * terminando com um CTA natural para o Aura Comex.
 */
export async function generatePost(params: {
  avoidTopics: string[]; // títulos/resumos de posts já publicados hoje, pra não duplicar
  ctaUrl: string;
  ctaText: string;
}): Promise<GeneratedPost> {
  const { avoidTopics, ctaUrl, ctaText } = params;

  const pillarsList = PILLARS.map((p) => `- ${p}: ${PILLAR_LABELS[p]}`).join('\n');

  const avoidBlock =
    avoidTopics.length > 0
      ? `Assuntos já publicados HOJE (não repita, escolha outra notícia ou outro ângulo):\n${avoidTopics
          .map((t) => `- ${t}`)
          .join('\n')}`
      : 'Nenhum post foi publicado hoje ainda.';

  const systemPrompt = `Você é o redator do blog do Aura Comex, um sistema de monitoramento e visibilidade de embarque.

O LEITOR É O AGENTE DE CARGA (freight forwarder) — não o embarcador final. Ele lida
com vários clientes ao mesmo tempo, e o problema dele não é só "minha carga atrasou",
é "eu preciso avisar meu cliente antes que ele me pergunte, e preciso parecer no
controle da operação". O Aura Comex é a ferramenta que dá esse controle e essa
visibilidade — o agente usa o Aura pra prestar um serviço de excelência e se
diferenciar aos olhos do cliente dele.

O objetivo do blog é gerar tráfego qualificado: cada post deve conectar uma notícia
real a uma dor prática do agente de carga na gestão do relacionamento com os
clientes dele, e terminar com uma chamada natural para o Aura Comex. Não é um blog
de notícias genérico — é conteúdo com propósito comercial sutil.

Regras obrigatórias:
1. Use a ferramenta de busca na web para achar UMA notícia recente (últimas 48h, se possível) de comércio exterior/logística internacional relevante para o Brasil.
2. A notícia deve se encaixar em um destes 4 pilares:
${pillarsList}
3. NUNCA copie frases da fonte — reescreva o contexto inteiramente com suas próprias palavras.
4. Conecte a notícia a uma dor prática e concreta do AGENTE DE CARGA em atender bem
   seus clientes (ex: como comunicar um atraso antes que o cliente cobre, como provar
   que está no controle mesmo com um imprevisto, como evitar surpresa de burocracia
   que pega o cliente de surpresa). O tom é sempre "isso te ajuda a parecer no
   controle e a entregar um serviço de excelência pro seu cliente", nunca "isso
   resolve a dor de quem embarca a carga".
5. Termine com um CTA natural (não forçado) para o Aura Comex, usando o texto "${ctaText}" e o link ${ctaUrl}. O CTA deve reforçar a ideia de usar o Aura pra entregar mais visibilidade e excelência ao cliente do agente — não apenas "rastreie sua carga".
6. Tom: profissional, direto, sem jargão vazio. Post curto (300-500 palavras).
7. ${avoidBlock}

Responda em JSON válido, sem texto fora do JSON, no formato:
{
  "title": "...",
  "pillar": "um dos 4 valores exatos: rastreamento-visibilidade | imprevistos-cadeia-logistica | burocracia-prazos | noticias-regulatorias",
  "excerpt": "resumo de 1-2 frases",
  "content": "corpo do post em markdown, já incluindo o CTA no final",
  "source_url": "url da notícia usada como base",
  "image_query": "2-4 palavras em INGLÊS descrevendo uma imagem genérica que ilustra o tema (ex: 'cargo ship port', 'customs paperwork', 'shipping containers'), para buscar uma foto de capa"
}`;

  const response = await client.messages.create({
    // Sonnet é bem mais barato que Opus e dá conta tranquilo desse tipo de
    // tarefa (busca + redação curta). Opus só valeria a pena se a qualidade
    // do texto estivesse claramente abaixo do necessário.
    model: 'claude-sonnet-5',
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: systemPrompt,
        // Cache do prompt de sistema: se você gerar mais de um post em um
        // teste rápido (ex: pelo botão do /admin), as chamadas seguintes
        // dentro de ~5min pagam bem menos por reaproveitar esse bloco.
        // (cast: a versão do SDK instalada ainda não tipa cache_control aqui)
        cache_control: { type: 'ephemeral' },
      } as any,
    ],
    tools: [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        // Limita a no máximo 2 buscas por post — evita loops de busca que
        // inflam o custo sem melhorar a qualidade do texto.
        max_uses: 2,
      } as any,
    ],
    messages: [
      {
        role: 'user',
        content:
          'Busque a notícia e gere o post agora, seguindo exatamente o formato JSON pedido.',
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude não retornou texto na resposta.');
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Não foi possível extrair JSON da resposta: ${textBlock.text}`);
  }

  const parsed = JSON.parse(jsonMatch[0]);

  if (!PILLARS.includes(parsed.pillar)) {
    throw new Error(`Pilar inválido retornado pelo modelo: ${parsed.pillar}`);
  }

  return parsed as GeneratedPost;
}
