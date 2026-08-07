# Aura Comex — instruções para o Claude

SaaS de gestão de frete internacional (comex), em português. Usuário: Marcos Martini
(marcos.f.martini@gmail.com), superadmin da plataforma. Responder sempre em português.

## Stack e referências

- React 18 + TypeScript + Vite + shadcn/ui (Radix) + Tailwind + TanStack React Query + React Router
- Backend: Supabase (Postgres/Auth/Storage/Edge Functions, pg_cron) — projeto `pqiuxojgjmqhdajdhgqk`
- Testes: Vitest (`npx vitest run`)
- Repo GitHub: `AuraComexBR/auracomex`, branch de produção `main`
- Deploy: Vercel, auto-deploy no push pro `main` — projeto `auracomex`
  (id `prj_gS2iVXFhlHTqHspNQ79m2AsDz0wA`, team `team_72KuLwbJZBtnU2NFLrfHBomJ`)
- Deploy Hook manual (se o auto-deploy falhar): colar no navegador
  `https://api.vercel.com/v1/integrations/deploy/prj_gS2iVXFhlHTqHspNQ79m2AsDz0wA/5OG2kJBvaA`
  (o sandbox NÃO alcança api.vercel.com — pedir pro usuário abrir a URL no navegador dele)

## Fluxo de trabalho obrigatório

1. **Verificar tipos antes de qualquer deploy**: `npx tsc --noEmit -p tsconfig.app.json`.
   NUNCA usar `-p .` — o tsconfig.json raiz é solution-style com `files: []` e não checa nada.
2. **Deploy sempre**: toda mudança verificada é commitada e enviada pro `main` imediatamente
   (o usuário pediu "deploy sempre"). Antes de push, `git fetch origin main` pra checar divergência.
3. **Versionamento por assunto (uma versão "fechada" por conversa/assunto)**: dentro de um mesmo
   assunto (tipicamente uma conversa), o sequencial (`NN`) fica TRAVADO e cada deploy intermediário
   ganha uma letra: `26.8.64a`, `26.8.64b`, `26.8.64c`... Essas versões com letra são só pro bundle
   ir pro ar (deploy Vercel normal) — **NÃO inserir linha em `app_releases`** pra elas, é só rodar
   o deploy e confirmar via Vercel. O usuário avisa quando o assunto está resolvido/fechado; só
   nesse momento insere UMA linha em `app_releases` com a versão sem letra (o próximo sequencial
   "puro", ex. `26.8.65`) resumindo o que foi feito no assunto inteiro — não cada ajuste intermediário.
   Um assunto novo (nova conversa/tema) sempre começa do próximo sequencial sem letra e recomeça o
   ciclo de letras se precisar de vários ajustes.
   Formato da versão: `AA.M.NN[letra]` (ano.mês.sequencial — ex: `26.8.55`, `26.8.64b`).
   Colunas de `app_releases`: `version`, `title`, `summary`, `highlights` (jsonb array de strings),
   `is_major` (bool). Consultar a última versão ANTES de fechar um assunto:
   `SELECT version FROM app_releases ORDER BY created_at DESC LIMIT 1`.
   ATENÇÃO: a versão exibida na sidebar do app vem SÓ dessa tabela — não prova que o bundle novo
   está no ar. Confirmar deploys pela API do Vercel (`list_deployments`) e pelos valores reais na tela.
4. **Confirmar o deploy**: após push, checar via `list_deployments` (Vercel MCP) que apareceu um
   deployment novo com o SHA do commit e estado READY.

## Git no ambiente sandbox (FUSE) — workaround obrigatório

O repo é montado via FUSE e `rm`/`os.remove` em arquivos `.lock` do `.git/` falha com
"Operation not permitted". Antes de CADA operação git (fetch/add/commit/push), rodar:

```bash
cd /caminho/do/repo && python3 -c "
import os
for root, dirs, files in os.walk('.git'):
    for f in files:
        if f.endswith('.lock'):
            p = os.path.join(root, f)
            os.rename(p, p + '.bak')
"
```

Warnings tipo `unable to unlink '...lock'` ou `tmp_obj_...` são cosméticos e inofensivos —
o que importa é o resultado do commit/push. Confirmar com `git log --oneline -1 origin/main`
após um `git fetch`.

Commits com crase/caractere especial na mensagem: usar `git commit -F /tmp/msg.txt`.

## Armadilhas conhecidas do código (não reaprender do zero)

- **Duplicação de cálculo em `src/pages/Quotes.tsx`**: o Lucro Estimado da lista usa
  `computeQuoteProfitBrl` (mesma função da ordenação). Já existiu uma segunda cópia inline no
  `<TableCell>` que divergiu (faltava `per_wm`) — foi removida. NUNCA reintroduzir cópia inline;
  qualquer ajuste vai na função compartilhada.
- **Unidade `per_wm` (W/M)** = `Math.max(pesoTotal_ton, cbmTotal)`. Implementações de referência:
  `getChargeMultiplier` em `QuoteDetail.tsx` e `getMultiplier` em `QuotePdfPreviewDialog.tsx`.
- **`src/lib/estimateSync.ts` (`mapChargesToEstimate`)**: TODA taxa com `leg='freight'` tem
  `charge_type='freight'` no banco (charge_type espelha o leg, não distingue frete de seguro).
  Por isso `isSeguro` é checado ANTES de `isFrete` e `isFrete` exclui `isSeguro`. Não inverter.
- **Auto-sync Taxas→Estimativa** (`CostEstimateTab.tsx`, efeito com `lastSyncedRef`): roda a cada
  mount da aba. Bug nessa cadeia REVERTE silenciosamente correções manuais no banco — se um valor
  de `cost_estimates` "volta sozinho" pro errado, a causa é código, não cache.
- **PDF da estimativa (`EstimatePdfDialog.tsx`)**: `minHeight` das folhas é `294mm` (não 297mm) —
  margem contra arredondamento subpixel do html2canvas/jsPDF que gerava página em branco extra.
  Não usar `maxHeight`/`overflow:hidden` (risco de cortar conteúdo).
- Auto-save do app é no `onBlur` (não debounce durante digitação).

## Ferramentas MCP disponíveis

- Supabase MCP: `execute_sql`, `apply_migration`, `get_logs` etc. (projeto `pqiuxojgjmqhdajdhgqk`)
- Vercel MCP: `list_deployments`, `get_deployment_build_logs` etc.
- O sandbox NÃO tem acesso de rede irrestrito (curl pra APIs externas pode falhar com exit 56).
