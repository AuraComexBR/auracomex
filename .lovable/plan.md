# Plano: Backup do Banco de Dados (Dump SQL Restaurável)

## Objetivo
Permitir que admins/diretores baixem um backup SQL restaurável da sua própria empresa, e que o superadmin baixe de qualquer empresa individualmente **ou de todas as empresas de uma vez**.

## Localização na UI
Dentro de **Configurações → Gerenciamento de Dados** (`DataManagementSection.tsx`), novo bloco no topo: **"Backup do Banco de Dados"**.

### Para admin/diretor
- Texto explicando o que o arquivo contém e como restaurar.
- Botão **"Baixar backup completo (SQL)"** — exporta apenas dados da própria empresa.

### Para superadmin (bloco adicional)
- Select de empresa + botão **"Baixar backup desta empresa"**.
- Botão destacado **"Baixar backup de TODAS as empresas"** (dump global consolidado num único arquivo `.sql`).
  - Aviso: "Pode demorar alguns minutos e gerar um arquivo grande."
  - Confirmação via `AlertDialog` antes de iniciar.
- Opcional: barra de progresso mostrando "Processando empresa X de N" durante a geração.

## Backend: Edge Function `backup-database`
Nova função em `supabase/functions/backup-database/index.ts`.

1. **Auth**: valida JWT via `getClaims()`.
2. **Autorização** (via service role em `user_roles`):
   - `admin` / `diretor` → só própria `company_id`.
   - `superadmin` → aceita `{ companyId: '<uuid>' }` ou `{ scope: 'all' }`.
   - Outros papéis → 403.
3. **Geração do dump**:
   - Whitelist de tabelas de domínio (todas as tabelas de negócio; exclui `signup_attempts`, `access_logs`, `email_send_log/state`, `email_unsubscribe_tokens`, `suppressed_emails`, `platform_settings`, `app_releases`, `user_release_reads`, `reference_counters`, `ncm_taxes_reference`, `pgmq.*`).
   - Para cada tabela, `SELECT *` com service role filtrando por `company_id` (ou sem filtro no modo `all`).
   - `profiles` e `user_roles` incluídos para usuários da(s) empresa(s).
   - Monta script SQL em ordem de dependências:
     ```text
     companies → profiles/user_roles → clients/ports/charge_catalog/
     company_bank_accounts/company_addons/company_subscriptions →
     quotes → quote_items/quote_charges/quote_partners/quote_comments →
     shipments → shipment_partners/shipment_audit_log/documents/tasks/
     shipment_status_options →
     charges/charge_lines →
     accounts_payable/accounts_receivable →
     cost_estimates/cost_estimate_items/cost_estimate_expenses →
     overhead_* → debit_notes/debit_note_items →
     notifications → support_tickets/support_ticket_messages →
     activity_log → company_siscomex_configs
     ```
   - Cada linha vira `INSERT INTO public.<tabela>(...) VALUES (...) ON CONFLICT (id) DO NOTHING;` dentro de `BEGIN;` … `COMMIT;`.
   - Modo `all`: um único arquivo com todas as empresas concatenadas, cada bloco separado por comentário `-- === COMPANY: <nome> (<uuid>) ===`.
4. **Escape SQL**: helper `sqlLiteral(v)` cobre `null`, boolean, number, string (escapa `'`), Date/ISO (`'...'::timestamptz`), arrays (`ARRAY[...]::type[]`), jsonb (`'...'::jsonb`).
5. **Streaming**: resposta como `ReadableStream` `text/sql` com `Content-Disposition: attachment; filename="aura-backup-<escopo>-<YYYYMMDD-HHmm>.sql"`.
6. **Cabeçalho** do arquivo: metadados (empresa(s), data, versão do app, instruções `psql <conn> -f arquivo.sql`).
7. **Log**: registra em `activity_log` (`type='backup_download'`) usuário, escopo e timestamp.

## Frontend
- Novo componente `src/components/settings/BackupSection.tsx` renderizado no topo do `DataManagementSection`.
- Usa `fetch` direto para o endpoint da function (`${SUPABASE_URL}/functions/v1/backup-database`) com `Authorization: Bearer <access_token>` para receber texto e disparar download via `Blob` + `URL.createObjectURL`.
- Estados: `idle | generating | done | error`, com botão desabilitado e spinner enquanto gera.
- Toasts de sucesso/erro. Aviso destacado: "Arquivo contém dados sensíveis. Armazene em local seguro."
- Superadmin: reaproveita `useQuery(['superadmin-companies'])` já existente para o select.

## Permissões
- Nenhuma tabela nova.
- Function usa service role e valida papel manualmente — RLS permanece intacta.
- Somente `admin`, `diretor`, `superadmin` acessam o bloco na UI e o endpoint.

## Fora de escopo
- Backup automático agendado.
- Histórico de backups em bucket.
- Exportações CSV por módulo.
- Restore automático dentro do app (usuário roda `psql` externamente).

## Arquivos afetados
- `supabase/functions/backup-database/index.ts` (novo)
- `src/components/settings/BackupSection.tsx` (novo)
- `src/components/settings/DataManagementSection.tsx` (inclui `<BackupSection />` no topo)
- `src/contexts/LanguageContext.tsx` (strings PT/EN)
