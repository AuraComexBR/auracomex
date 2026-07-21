# Blog Aura Comex

Blog em Next.js + MDX, servido em `auracomex.app/blog` via rewrite (multi-zones),
com um post automático gerado 1x/dia pela API da Anthropic.

## 1. Setup local

```bash
npm install
cp .env.example .env.local
# preencha ANTHROPIC_API_KEY no .env.local
npm run dev
```

Acesse `http://localhost:3000/blog`.

## 2. Testar a geração de post SEM deploy

```bash
npm run gerar-post
```

Isso chama a Anthropic API (com web search), gera um post e salva em
`content/posts/AAAA-MM-DD-slug.mdx` com `status: draft`. Rode isso antes de
automatizar de verdade, para validar a qualidade do conteúdo.

## 3. Fluxo de revisão (rascunhos)

Todo post — automático ou manual — nasce com `status: draft` e fica em
`content/posts/*.mdx`. Ele **não aparece no blog público** até virar `published`.

**Opção A — pelo navegador (`/admin`):**

1. Configure `ADMIN_USER` e `ADMIN_PASSWORD` no `.env.local` (e depois na Vercel).
2. Acesse `http://localhost:3000/blog/admin` (local) ou `auracomex.app/blog/admin`
   (produção). O navegador pede usuário/senha (HTTP Basic Auth).
3. Lá dá pra ver rascunhos e publicados, aprovar/despublicar com um clique, e
   gerar um post novo na hora com o botão "Gerar novo post agora".

Em produção, aprovar pelo `/admin` já escreve direto no arquivo do deploy —
mas como o filesystem da Vercel é efêmero, isso **não persiste** entre deploys.
Pra manter o histórico versionado, ainda é bom rodar `git pull` do conteúdo
gerado de vez em quando (ou aprovar localmente e dar push — opção B).

**Opção B — por linha de comando (fonte da verdade = git):**

```bash
npm run listar-rascunhos          # lista os pendentes
npm run aprovar -- <slug>         # muda status para published
git add content/posts && git commit -m "aprova posts" && git push
```

Publicar = editar o front-matter (`status: published`) e dar push. Sem CMS,
sem banco — o repo é a fonte da verdade.

## 4. Deploy na Vercel

1. `vercel` (ou conecte o repo pelo dashboard) — crie um projeto **separado**
   do principal, ex: `auracomex-blog`.
2. Configure as env vars no projeto (Settings → Environment Variables):
   - `ANTHROPIC_API_KEY`
   - `CRON_SECRET` (gere um valor aleatório, ex: `openssl rand -hex 32`)
   - `NEXT_PUBLIC_AURA_CTA_URL`
   - `NEXT_PUBLIC_AURA_CTA_TEXT`
   - `ADMIN_USER` / `ADMIN_PASSWORD` (login da área de gestão `/admin`)
   - `UNSPLASH_ACCESS_KEY` (imagem de capa — opcional)
   - `NEXT_PUBLIC_SITE_URL=https://auracomex.app/blog` (SEO/RSS/sitemap)
3. O `vercel.json` já tem o cron configurado para rodar 1x/dia às 9h UTC
   (6h em Brasília), chamando `/api/gerar-post`. A Vercel autentica a chamada
   sozinha usando `CRON_SECRET`.
4. Confirme a URL do projeto (ex: `auracomex-blog.vercel.app`) e ajuste o
   `assetPrefix` em `next.config.js` se o nome do projeto for diferente.

### Cron no plano Hobby

O plano Hobby permite crons com frequência mínima de 1x/dia — o que já está
configurado aqui, então não precisa de upgrade.

## 5. Rewrite no projeto principal (auracomex.app)

No repositório do projeto **principal** (não este), adicione/edite o
`vercel.json` na raiz:

```json
{
  "rewrites": [
    { "source": "/blog", "destination": "https://auracomex-blog.vercel.app/blog" },
    { "source": "/blog/:path*", "destination": "https://auracomex-blog.vercel.app/blog/:path*" }
  ]
}
```

Troque `auracomex-blog.vercel.app` pela URL real do projeto do blog depois do
deploy. Isso faz `auracomex.app/blog/*` servir o conteúdo deste projeto sem
subdomínio.

## 6. Imagens, SEO e descoberta

- **Imagem de capa:** cada post gerado busca uma foto no Unsplash (grátis, precisa
  de `UNSPLASH_ACCESS_KEY` — crie em unsplash.com/developers). Sem a chave, o post
  sai sem imagem e o layout lida com isso normalmente.
- **SEO:** cada post tem `<title>`, meta description, Open Graph e Twitter Card
  próprios (usa a imagem de capa), além de dado estruturado (JSON-LD `Article`)
  pro Google entender que é um artigo. `sitemap.xml` e `robots.txt` são gerados
  automaticamente em `/blog/sitemap.xml` e `/blog/robots.txt`.
  - **Atenção:** `robots.txt` convencionalmente precisa estar na raiz do domínio
    (`auracomex.app/robots.txt`), não em `/blog/robots.txt`. Se o projeto
    principal já tiver um `robots.txt` próprio, referencie o sitemap do blog
    nele: `Sitemap: https://auracomex.app/blog/sitemap.xml`.
- **RSS:** feed em `/blog/feed.xml`, linkado no rodapé.
- **Design:** paleta e tipografia em `app/globals.css` (variáveis CSS no topo) —
  são cores provisórias, troque pelas oficiais do Aura Comex quando tiver o
  guia de marca.
- Configure `NEXT_PUBLIC_SITE_URL=https://auracomex.app/blog` na Vercel (produção)
  pra sitemap/RSS/Open Graph usarem a URL certa.

## 7. Geração manual (via Cowork ou curl)

A rota também aceita POST, então dá pra disparar manualmente quando quiser
escrever/gerar algo fora do horário do cron:

```bash
curl -X POST https://auracomex-blog.vercel.app/api/gerar-post \
  -H "Authorization: Bearer $CRON_SECRET"
```

Ela verifica os posts já gerados no dia (`generated_by: auto`) e evita gerar
dois posts automáticos no mesmo dia — mas não impede posts manuais adicionais.

## Estrutura

```
blog/
├── app/
│   ├── page.tsx                 # listagem + filtro de pilar + paginação — /blog
│   ├── [slug]/page.tsx          # post individual (SEO, JSON-LD) — /blog/<slug>
│   ├── admin/page.tsx           # área de gestão — /blog/admin
│   ├── sitemap.ts               # /blog/sitemap.xml
│   ├── robots.ts                # /blog/robots.txt
│   ├── feed.xml/route.ts        # /blog/feed.xml (RSS)
│   ├── globals.css              # paleta, tipografia, layout
│   └── api/
│       ├── gerar-post/route.ts  # gera post via cron (protegido por CRON_SECRET)
│       └── admin/                # posts, status, gerar (protegidos por Basic Auth)
├── components/                   # Header, Footer, PostCard
├── content/posts/*.mdx          # posts (front-matter: status draft|published)
├── lib/
│   ├── anthropic.ts             # prompt + chamada à API
│   ├── unsplash.ts              # busca da imagem de capa
│   ├── pillars.ts               # rótulos dos 4 pilares (fonte única)
│   ├── gerarPost.ts             # lógica compartilhada de geração
│   └── posts.ts                 # leitura/escrita dos .mdx
├── middleware.ts                 # Basic Auth em /admin e /api/admin/*
├── scripts/                      # gerar-post local, listar-rascunhos, aprovar
└── vercel.json                   # cron 1x/dia
```

## Pilares de conteúdo

1. Rastreamento e visibilidade de carga
2. Imprevistos na cadeia logística internacional
3. Burocracia e prazos (Siscomex, documentação)
4. Notícias regulatórias com impacto operacional (câmbio, tarifas)

Todo post automático se encaixa em um destes 4, conecta a notícia a uma dor
prática de quem embarca carga, e termina com CTA para o Aura Comex.
