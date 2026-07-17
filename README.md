# Aura Comex

Plataforma de logística internacional (International Logistics Platform) — gestão de cotações, embarques, financeiro e clientes para empresas de comércio exterior.

## Stack

- **Frontend:** React 18 + TypeScript + Vite
- **UI:** shadcn/ui + Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- **Dados:** TanStack React Query
- **Pagamentos:** Stripe
- **Validação:** Zod
- **Testes:** Vitest + Playwright

## Setup local

Pré-requisitos: Node.js 18+ e npm.

```sh
# 1. Clonar o repositório
git clone <URL_DO_REPO>
cd auracomex

# 2. Configurar variáveis de ambiente
# Copie .env.example para .env e preencha com as credenciais do Supabase
# (Dashboard -> Settings -> API)

# 3. Instalar dependências
npm install

# 4. Rodar em desenvolvimento
npm run dev
```

App disponível em `http://localhost:8080`.

## Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (HMR) |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |
| `npm run lint` | ESLint |
| `npm run test` | Testes (Vitest) |
| `npm run test:watch` | Testes em modo watch |

## Estrutura

```
src/
├── components/       # Componentes por domínio
│   ├── quotes/       # Cotações
│   ├── shipments/    # Embarques
│   ├── financial/    # Financeiro
│   ├── superadmin/   # Painel admin
│   └── ui/           # shadcn/ui (não editar manualmente)
├── contexts/         # AuthContext, LanguageContext
├── hooks/            # Hooks customizados (usePermissions, etc)
├── integrations/     # Cliente e tipos do Supabase
├── lib/              # Utilitários
└── pages/            # Páginas (rotas)

supabase/
├── functions/        # Edge Functions (Deno)
└── migrations/       # Migrações SQL versionadas
```

## Banco de dados

O banco roda no Supabase. Migrações ficam em `supabase/migrations/`.

```sh
# Criar nova migração
supabase migration new nome_descritivo

# Aplicar no banco remoto
supabase db push

# Regenerar tipos TypeScript após mudanças no schema
supabase gen types typescript --project-id <PROJECT_REF> > src/integrations/supabase/types.ts
```

## Edge Functions

```sh
# Deploy de todas as functions
supabase functions deploy --project-ref <PROJECT_REF>

# Deploy de uma function específica
supabase functions deploy nome-da-function --project-ref <PROJECT_REF>
```

Secrets (Stripe, Resend, etc) são configuradas em: Dashboard → Edge Functions → Secrets.

## Acesso externo em desenvolvimento

Para expor o servidor local via Cloudflare Tunnel:

```sh
cloudflared tunnel --url http://localhost:8080
```

O `vite.config.ts` já permite hosts `*.trycloudflare.com`.

## Multi-tenancy

O isolamento entre empresas é feito via RLS (Row Level Security) no PostgreSQL:

- Cada tabela de dados tem `company_id`
- As policies filtram por `my_company_id()` (empresa ativa no profile do usuário)
- Superadmin gerencia empresas em `/admin` e "entra" numa empresa para operá-la
- Funções `is_superadmin()` e `my_company_id()` são SECURITY DEFINER (evita recursão em RLS)
