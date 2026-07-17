# Relatório de Melhorias — Auracomex

**Data:** 17/07/2026 · **Base analisada:** ~34.770 linhas TS/TSX · 120 componentes · 22 páginas · 16 hooks

---

## 🔴 PRIORIDADE ALTA (Segurança)

### 1. `.env` não está no `.gitignore`
O arquivo `.env` com as credenciais do Supabase está **commitado no GitHub**.
A chave anon é pública por design, mas o histórico do repo guarda tudo pra sempre.

**Correção:** adicionar ao `.gitignore`:
```
.env
.env.*
!.env.example
```
E criar um `.env.example` sem valores reais.

### 2. Edge functions sem validação de autenticação
Estas functions não verificam usuário/role:
- `siscomex-gateway` — gateway externo aberto
- `tracking` — ok se for público por design
- `payments-webhook` — ok (usa assinatura do Stripe, verificar se valida)
- `public-signup` — ok por design, mas precisa de rate limiting
- `process-email-queue` — deveria exigir service_role ou cron secret

**Correção:** adicionar verificação de JWT/role nas que não são públicas por design.

### 3. CORS `Access-Control-Allow-Origin: *` em todas as functions
Qualquer site pode chamar suas edge functions.
**Correção:** restringir ao domínio da app em produção.

### 4. Nenhuma validação de input (zod) nas edge functions
As functions aceitam qualquer payload. O frontend valida com zod, mas o backend não.
**Correção:** validar body com zod dentro de cada function.

---

## 🟡 PRIORIDADE MÉDIA (Qualidade/Manutenção)

### 5. `QuoteDetail.tsx` tem 3.109 linhas
Impossível de manter. Concentra abas, lógica financeira, PDF, estados.
**Correção:** quebrar em subcomponentes por aba (como já feito em `estimate/`).
Candidatos seguintes: `CostEstimateTab` (1.348), `FinancialTab` (911), `Registrations.tsx` (805).

### 6. Sem code splitting — bundle único gigante
34 rotas importadas de forma estática no `App.tsx`. Usuário baixa o app INTEIRO
(incluindo html2pdf, recharts, superadmin) só pra ver a tela de login.
**Correção:** usar `React.lazy()` + `Suspense` nas rotas:
```tsx
const Quotes = lazy(() => import("./pages/Quotes"));
```
Ganho estimado: 50–70% no carregamento inicial.

### 7. Acesso a dados espalhado (32 arquivos com `supabase.from` direto)
Metade usa React Query (48 arquivos), metade chama Supabase direto no componente.
Sem padrão = cache inconsistente e dificuldade de manutenção.
**Correção:** centralizar queries em hooks (`src/hooks/queries/`) e usar
React Query em tudo.

### 8. Quase zero testes (2 arquivos)
Vitest + Playwright estão configurados mas sem cobertura real.
**Correção:** priorizar testes nos fluxos críticos: cotação → embarque → financeiro.

### 9. Resquícios do Lovable
- `lovable-tagger` no `package.json` e `vite.config.ts`
- Pasta `.lovable/` no repo
**Correção:** remover dependência, limpar configs, apagar pasta.

---

## 🟢 PRIORIDADE BAIXA (Refinamento)

### 10. Duplicação em DebitNotes
`DebitNotesTab` (764 linhas) e `ClientDebitNotesTab` (485) compartilham muita lógica.
**Correção:** extrair lógica comum pra hook `useDebitNotes`.

### 11. `types.ts` desatualizado
O arquivo `src/integrations/supabase/types.ts` (3.105 linhas) foi gerado pelo
Lovable Cloud. Agora que o banco é seu:
```bash
supabase gen types typescript --project-id SEU_PROJECT_REF > src/integrations/supabase/types.ts
```

### 12. `(permissions as any)` no ProtectedRoute
Cast `as any` derrota o TypeScript justo no controle de permissões.
**Correção:** tipar `requiredPermission` como `keyof Permissions`.

### 13. README ainda é o padrão do Lovable
Substituir por documentação real do projeto (setup, deploy, arquitetura).

---

## ✅ PONTOS FORTES (já estão bons)

- Estrutura de pastas organizada por domínio (quotes, shipments, financial...)
- React Query configurado com staleTime sensato
- Só 1 `console.log` no código todo
- Zod no frontend para formulários
- shadcn/ui bem utilizado (componentes em `ui/` intactos)
- Rotas protegidas com verificação de permissão e must_change_password

---

## 📋 ORDEM SUGERIDA DE EXECUÇÃO

| # | Item | Esforço | Impacto |
|---|------|---------|---------|
| 1 | .gitignore + .env.example | 10 min | Alto |
| 2 | Remover lovable-tagger e .lovable | 15 min | Médio |
| 3 | Code splitting (React.lazy) | 1h | Alto |
| 4 | Auth nas edge functions | 2h | Alto |
| 5 | Regenerar types.ts | 10 min | Médio |
| 6 | CORS restrito | 30 min | Médio |
| 7 | Quebrar QuoteDetail.tsx | 1-2 dias | Alto |
| 8 | Padronizar React Query | 2-3 dias | Médio |
| 9 | Testes dos fluxos críticos | contínuo | Alto |
