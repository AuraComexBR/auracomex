-- coleta_veiculos ainda não tem uso real (0 linhas) — cavalo e carreta trocam de
-- combinação no dia a dia, então precisam ser cadastros independentes, não um só
-- registro "veículo".
drop table if exists public.coleta_veiculos cascade;

create table public.coleta_cavalos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  client_id uuid not null references public.clients(id),
  placa text not null,
  cor text,
  modelo text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coleta_carretas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  client_id uuid not null references public.clients(id),
  placa text not null,
  tipo text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.coleta_ordens_coleta
  drop column if exists veiculo_id,
  add column cavalo_id uuid references public.coleta_cavalos(id),
  add column carreta_id uuid references public.coleta_carretas(id);

create index idx_coleta_cavalos_company on public.coleta_cavalos(company_id);
create index idx_coleta_cavalos_client on public.coleta_cavalos(client_id);
create index idx_coleta_carretas_company on public.coleta_carretas(company_id);
create index idx_coleta_carretas_client on public.coleta_carretas(client_id);
create index idx_coleta_ordens_cavalo on public.coleta_ordens_coleta(cavalo_id);
create index idx_coleta_ordens_carreta on public.coleta_ordens_coleta(carreta_id);

create trigger set_updated_at before update on public.coleta_cavalos
  for each row execute function public.update_updated_at_column();
create trigger set_updated_at before update on public.coleta_carretas
  for each row execute function public.update_updated_at_column();

alter table public.coleta_cavalos enable row level security;
alter table public.coleta_carretas enable row level security;

create policy tenant_all on public.coleta_cavalos
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());
create policy tenant_all on public.coleta_carretas
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());
